import { createSign } from "crypto";

// ─── Kalshi ───────────────────────────────────────────────────────────────────

function kalshiSign(privateKeyPem: string, timestampMs: number, method: string, path: string): string {
  const msg = `${timestampMs}${method}${path}`;
  const signer = createSign("RSA-SHA256");
  signer.update(msg);
  return signer.sign(privateKeyPem, "base64");
}

export async function checkKalshiResult(ticker: string): Promise<"yes" | "no" | null> {
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

// ─── Polymarket ───────────────────────────────────────────────────────────────

function getMarketPrice(market: Record<string, unknown>): number {
  let prices: string[];
  try { prices = JSON.parse((market.outcomePrices as string) ?? '["0.5","0.5"]'); }
  catch { prices = ["0.5", "0.5"]; }
  return parseFloat(prices[0] ?? "0.5");
}

// Scores each child market against the pick question so multi-bracket events
// (e.g. temperature ranges, view-count tiers, transfer destinations) resolve
// against the correct bracket instead of defaulting to markets[0].
// Filter: length > 1 keeps short-but-distinguishing tokens like "28", "139".
export function findTargetMarket(
  markets: Array<Record<string, unknown>>,
  pickQuestion?: string
): Record<string, unknown> {
  if (markets.length === 1 || !pickQuestion) return markets[0];
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const pickTokens = new Set(normalize(pickQuestion).split(" ").filter(t => t.length > 1));
  let bestMarket = markets[0];
  let bestScore = -1;
  for (const m of markets) {
    const mqTokens = normalize((m.question as string) ?? "").split(" ").filter(t => t.length > 1);
    const overlap = mqTokens.filter(t => pickTokens.has(t)).length;
    const score = overlap / Math.max(pickTokens.size, mqTokens.length, 1);
    if (score > bestScore) { bestScore = score; bestMarket = m; }
  }
  return bestMarket;
}

export async function checkPolymarketResult(
  marketId: string,
  pickQuestion?: string
): Promise<"yes" | "no" | null> {
  try {
    const isSlug = /^[a-z0-9-]+$/.test(marketId) && !marketId.startsWith("0x");

    if (isSlug) {
      const evRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(marketId)}`);
      if (evRes.ok) {
        const events: Record<string, unknown>[] = await evRes.json();
        const ev = events?.[0];
        if (ev) {
          const markets = ev.markets as Array<Record<string, unknown>> | undefined;
          if (markets && markets.length > 0) {
            const targetMarket = findTargetMarket(markets, pickQuestion);
            const yesPrice = getMarketPrice(targetMarket);
            const isClosed = ev.closed === true;
            // Use event-level endDate (resolution deadline) not market-level endDate (trading close).
            // 48h buffer: oracles (especially weather) can lag 24-48h after the resolution day.
            // 0.99/0.01 threshold: prevents premature resolution on short-odds markets priced at
            // e.g. 95¢ before the actual data is posted.
            const endDate = (ev.endDate as string) || (targetMarket.endDate as string);
            const endDatePassed = endDate
              ? new Date(endDate).getTime() + 48 * 60 * 60 * 1000 < Date.now()
              : false;
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
    const endDatePassed = endDate
      ? new Date(endDate).getTime() + 48 * 60 * 60 * 1000 < Date.now()
      : false;
    const isSettled = isClosed || (endDatePassed && (yesPrice >= 0.99 || yesPrice <= 0.01));
    if (!isSettled) return null;
    if (yesPrice >= 0.99) return "yes";
    if (yesPrice <= 0.01) return "no";
    return null;
  } catch {
    return null;
  }
}

// ─── Win/loss determination ───────────────────────────────────────────────────

// BUY: you're buying the stated position. Win if that position's outcome happens.
// FADE: you're fading the market's overconfidence by taking the stated position.
//   The position field always stores the TRADE direction, so FADE resolves
//   identically to BUY — you win if your position matches the market outcome.
export function determineResult(
  recommendation: string,
  position: string,
  marketResult: "yes" | "no"
): "won" | "lost" | null {
  const rec = recommendation.toUpperCase();
  const pos = position.toUpperCase();
  if (rec === "BUY" || rec === "FADE") {
    const won = pos === "NO" ? marketResult === "no" : marketResult === "yes";
    return won ? "won" : "lost";
  }
  return null;
}

// ─── Payout calculator (paper trades) ────────────────────────────────────────

export function calculatePayout(
  stake: number,
  entryPrice: number,
  result: "won" | "lost" | "void"
): number {
  if (result === "void") return stake;
  if (result === "lost") return 0;
  return parseFloat((stake * (100 / entryPrice)).toFixed(2));
}
