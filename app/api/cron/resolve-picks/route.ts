import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createSign } from "crypto";

export const maxDuration = 60;

function kalshiSign(privateKeyPem: string, timestampMs: number, method: string, path: string): string {
  const msg = `${timestampMs}${method}${path}`;
  const signer = createSign("RSA-SHA256");
  signer.update(msg);
  return signer.sign(privateKeyPem, "base64");
}

async function checkKalshiResult(ticker: string): Promise<"yes" | "no" | null> {
  try {
    const keyId = process.env.KALSHI_API_KEY_ID;
    const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY;
    const path = `/trade-api/v2/markets/${ticker}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (keyId && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
      const ts = Date.now();
      headers["KALSHI-ACCESS-KEY"] = keyId;
      headers["KALSHI-ACCESS-TIMESTAMP"] = String(ts);
      headers["KALSHI-ACCESS-SIGNATURE"] = kalshiSign(privateKey, ts, "GET", path);
    }

    const res = await fetch(`https://api.kalshi.com${path}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.market?.result as string | null;
    if (result === "yes" || result === "no") return result;
    return null;
  } catch {
    return null;
  }
}

function getMarketPrice(market: Record<string, unknown>): number {
  let prices: string[];
  try { prices = JSON.parse((market.outcomePrices as string) ?? '["0.5","0.5"]'); }
  catch { prices = ["0.5", "0.5"]; }
  return parseFloat(prices[0] ?? "0.5");
}

// For multi-bracket Polymarket events the parent event slug is stored as market_id,
// but markets[0] may be a different bracket than the one our pick was on.
// Score each market against the pick question and prefer the best match;
// fall back to markets[0] only when there is a single market or no match.
function findTargetMarket(
  markets: Array<Record<string, unknown>>,
  pickQuestion?: string
): Record<string, unknown> {
  if (markets.length === 1 || !pickQuestion) return markets[0];

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const pickTokens = new Set(normalize(pickQuestion).split(" ").filter(t => t.length > 3));

  let bestMarket = markets[0];
  let bestScore = -1;

  for (const m of markets) {
    const mq = normalize((m.question as string) ?? "");
    const mqTokens = mq.split(" ").filter(t => t.length > 3);
    const overlap = mqTokens.filter(t => pickTokens.has(t)).length;
    const score = overlap / Math.max(pickTokens.size, mqTokens.length, 1);
    if (score > bestScore) { bestScore = score; bestMarket = m; }
  }

  return bestMarket;
}

async function checkPolymarketResult(marketId: string, pickQuestion?: string): Promise<"yes" | "no" | null> {
  try {
    // New picks store the parent event slug; legacy picks stored hex condition IDs
    const isSlug = /^[a-z0-9-]+$/.test(marketId) && !marketId.startsWith("0x");

    if (isSlug) {
      // Event slugs must be resolved via the events endpoint, not markets
      const evRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(marketId)}`);
      if (evRes.ok) {
        const events: Record<string, unknown>[] = await evRes.json();
        const ev = events?.[0];
        if (ev) {
          const markets = ev.markets as Array<Record<string, unknown>> | undefined;
          if (markets && markets.length > 0) {
            const targetMarket = findTargetMarket(markets, pickQuestion);
            const yesPrice = getMarketPrice(targetMarket);

            // Polymarket NEVER sets active=false — they use closed=true as the settlement signal.
            // Guard price-based resolution behind endDate to prevent premature resolution of
            // long-dated markets that are just priced low (e.g. 3¢ YES ≠ resolved "no").
            // 48h buffer: oracles (especially weather) can lag 24-48h after the resolution day.
            // Threshold 0.99/0.01: pre-event prices on short-odds markets (e.g. NO at 100¢ before
            // the actual temperature is posted) were being misread as final outcomes at 0.95/0.05.
            const isClosed = ev.closed === true;
            // Use event-level endDate (resolution deadline) not market-level endDate (trading close)
            const endDate = (ev.endDate as string) || (targetMarket.endDate as string);
            const endDatePassed = endDate ? new Date(endDate).getTime() + 48 * 60 * 60 * 1000 < Date.now() : false;
            const isSettled = isClosed || (endDatePassed && (yesPrice >= 0.99 || yesPrice <= 0.01));

            if (isSettled) {
              if (yesPrice >= 0.99) return "yes";
              if (yesPrice <= 0.01) return "no";
            }
            return null;
          }
        }
      }
    }

    // Fallback: legacy condition ID or market slug
    const query = isSlug ? `slug=${marketId}` : `id=${marketId}`;
    const res = await fetch(`https://gamma-api.polymarket.com/markets?${query}`);
    if (!res.ok) return null;
    const data: Record<string, unknown>[] = await res.json();
    const market = data?.[0];
    if (!market) return null;

    let prices: string[];
    try { prices = JSON.parse((market.outcomePrices as string) ?? '["0.5","0.5"]'); }
    catch { return null; }
    const yesPrice = parseFloat(prices[0] ?? "0.5");
    const isClosed = market.closed === true;
    const endDate = market.endDate as string | null;
    const endDatePassed = endDate ? new Date(endDate).getTime() + 48 * 60 * 60 * 1000 < Date.now() : false;
    const isSettled = isClosed || (endDatePassed && (yesPrice >= 0.99 || yesPrice <= 0.01));
    if (!isSettled) return null;
    if (yesPrice >= 0.99) return "yes";
    if (yesPrice <= 0.01) return "no";
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pending, error } = await getSupabase()
    .from("daily_picks")
    .select("id, platform, market_id, position, recommendation, event")
    .is("result", null)
    .not("market_id", "is", null);

  if (error) {
    console.error("Resolve picks fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: "No pending picks", resolved: 0 });
  }

  let resolved = 0;

  await Promise.allSettled(
    pending.map(async (pick) => {
      const marketId = pick.market_id as string;
      const platform = pick.platform as string;

      let marketResult: "yes" | "no" | null = null;
      if (platform === "Kalshi") {
        marketResult = await checkKalshiResult(marketId);
      } else if (platform === "Polymarket") {
        marketResult = await checkPolymarketResult(marketId, pick.event as string | undefined);
      }
      if (!marketResult) return;

      const rec = (pick.recommendation as string)?.toUpperCase();
      const pos = (pick.position as string)?.toUpperCase();

      let result: "won" | "lost" | null = null;
      if (rec === "BUY") {
        result = (pos === "NO" ? marketResult === "no" : marketResult === "yes") ? "won" : "lost";
      } else if (rec === "FADE") {
        result = (pos === "NO" ? marketResult === "yes" : marketResult === "no") ? "won" : "lost";
      }
      if (!result) return;

      const { error: updateErr } = await getSupabase()
        .from("daily_picks")
        .update({ result })
        .eq("id", pick.id);

      if (updateErr) {
        console.error(`Failed to resolve pick ${pick.id}:`, updateErr);
      } else {
        resolved++;
      }
    })
  );

  return NextResponse.json({ message: "Resolution complete", resolved, checked: pending.length });
}
