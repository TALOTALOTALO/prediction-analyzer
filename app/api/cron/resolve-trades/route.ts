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

async function checkPolymarketResult(marketId: string): Promise<"yes" | "no" | null> {
  try {
    // New picks store the parent event slug; legacy picks stored condition IDs (hex)
    const isSlug = /^[a-z0-9-]+$/.test(marketId) && !marketId.startsWith("0x");

    if (isSlug) {
      // Slugs are event slugs — query events endpoint to get child markets
      const evRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(marketId)}`);
      if (evRes.ok) {
        const events: Record<string, unknown>[] = await evRes.json();
        const ev = events?.[0];
        if (ev) {
          const markets = ev.markets as Array<Record<string, unknown>> | undefined;
          const firstMarket = markets?.[0];
          if (firstMarket) {
            let prices: string[];
            try { prices = JSON.parse((firstMarket.outcomePrices as string) ?? '["0.5","0.5"]'); }
            catch { prices = ["0.5", "0.5"]; }
            const yesPrice = parseFloat(prices[0] ?? "0.5");
            const isClosed = ev.closed === true;
            // Use event-level endDate (resolution deadline) not market-level endDate (trading close)
            const endDate = (ev.endDate as string) || (firstMarket.endDate as string);
            const endDatePassed = endDate ? new Date(endDate) < new Date() : false;
            const isSettled = isClosed || (endDatePassed && (yesPrice >= 0.95 || yesPrice <= 0.05));
            if (isSettled) {
              if (yesPrice >= 0.95) return "yes";
              if (yesPrice <= 0.05) return "no";
            }
            return null;
          }
        }
      }
    }

    // Fallback: legacy condition ID lookup via markets endpoint
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
    const endDatePassed = endDate ? new Date(endDate) < new Date() : false;
    const isSettled = isClosed || (endDatePassed && (yesPrice >= 0.95 || yesPrice <= 0.05));
    if (!isSettled) return null;
    if (yesPrice >= 0.95) return "yes";
    if (yesPrice <= 0.05) return "no";
    return null;
  } catch {
    return null;
  }
}

function calculatePayout(stake: number, entryPrice: number, result: "won" | "lost" | "void"): number {
  if (result === "void") return stake;
  if (result === "lost") return 0;
  return parseFloat((stake * (100 / entryPrice)).toFixed(2));
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all pending paper trades with their pick info
  const { data: pending, error } = await getSupabase()
    .from("paper_trades")
    .select("id, virtual_stake, position, entry_price, daily_picks(platform, market_id)")
    .is("result", null);

  if (error) {
    console.error("Resolve trades fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch pending trades" }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: "No pending paper trades", resolved: 0 });
  }

  let resolved = 0;

  await Promise.allSettled(
    pending.map(async (trade) => {
      const pickRaw = trade.daily_picks;
      const pick = (Array.isArray(pickRaw) ? pickRaw[0] ?? null : pickRaw) as { platform: string; market_id: string | null } | null;
      if (!pick?.market_id) return;

      let marketResult: "yes" | "no" | null = null;
      if (pick.platform === "Kalshi") {
        marketResult = await checkKalshiResult(pick.market_id);
      } else if (pick.platform === "Polymarket") {
        marketResult = await checkPolymarketResult(pick.market_id);
      }
      if (!marketResult) return;

      const tradeWon =
        (trade.position === "YES" && marketResult === "yes") ||
        (trade.position === "NO" && marketResult === "no");

      const tradeResult: "won" | "lost" = tradeWon ? "won" : "lost";
      const virtualPayout = calculatePayout(Number(trade.virtual_stake), Number(trade.entry_price), tradeResult);

      const { error: updateErr } = await getSupabase()
        .from("paper_trades")
        .update({ result: tradeResult, virtual_payout: virtualPayout })
        .eq("id", trade.id);

      if (updateErr) {
        console.error(`Failed to resolve trade ${trade.id}:`, updateErr);
      } else {
        resolved++;
      }
    })
  );

  // Also resolve manual_trades that have a market_id
  const { data: manualPending, error: manualErr } = await getSupabase()
    .from("manual_trades")
    .select("id, platform, market_id, position")
    .is("result", null)
    .not("market_id", "is", null);

  if (manualErr) {
    console.error("Resolve manual trades fetch error:", manualErr);
  }

  let manualResolved = 0;
  if (manualPending && manualPending.length > 0) {
    await Promise.allSettled(
      manualPending.map(async (trade) => {
        const marketId = trade.market_id as string;
        const platform = trade.platform as string;

        let marketResult: "yes" | "no" | null = null;
        if (platform === "Kalshi") {
          marketResult = await checkKalshiResult(marketId);
        } else if (platform === "Polymarket") {
          marketResult = await checkPolymarketResult(marketId);
        }
        if (!marketResult) return;

        const tradeWon =
          (trade.position === "YES" && marketResult === "yes") ||
          (trade.position === "NO" && marketResult === "no");

        const tradeResult: "won" | "lost" = tradeWon ? "won" : "lost";

        const { error: updateErr } = await getSupabase()
          .from("manual_trades")
          .update({ result: tradeResult })
          .eq("id", trade.id);

        if (updateErr) {
          console.error(`Failed to resolve manual trade ${trade.id}:`, updateErr);
        } else {
          manualResolved++;
        }
      })
    );
  }

  return NextResponse.json({
    message: "Resolution complete",
    resolved,
    checked: pending.length,
    manualResolved,
    manualChecked: manualPending?.length ?? 0,
  });
}
