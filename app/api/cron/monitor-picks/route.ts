// Runs every 4 hours. Checks open picks against current market prices and flags
// any that have moved significantly since they were published.

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createSign } from "crypto";

export const maxDuration = 60;

interface OpenPick {
  id: string;
  platform: string;
  market_id: string | null;
  position: string;
  implied_probability: number;
  recommendation: string;
  event: string;
  pick_date: string;
}

// Threshold: flag if price moved this many percentage points against the thesis
const ALERT_THRESHOLD = 12;

function kalshiSign(pem: string, ts: number, method: string, path: string): string {
  const signer = createSign("RSA-SHA256");
  signer.update(`${ts}${method}${path}`);
  return signer.sign(pem, "base64");
}

async function fetchKalshiPrice(ticker: string): Promise<number | null> {
  try {
    const keyId = process.env.KALSHI_API_KEY_ID;
    const rawKey = process.env.KALSHI_PRIVATE_KEY;
    const path = `/trade-api/v2/markets/${ticker}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (keyId && rawKey) {
      const pem = rawKey.replace(/\\n/g, "\n");
      const ts = Date.now();
      headers["KALSHI-ACCESS-KEY"] = keyId;
      headers["KALSHI-ACCESS-TIMESTAMP"] = String(ts);
      headers["KALSHI-ACCESS-SIGNATURE"] = kalshiSign(pem, ts, "GET", path);
    }
    // Use api.kalshi.com (all categories), not api.elections.kalshi.com (elections only)
    const res = await fetch(`https://api.kalshi.com${path}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const m = data.market;
    return m ? (m.last_price ?? m.yes_bid ?? null) : null;
  } catch { return null; }
}

async function fetchPolymarketPrice(eventSlug: string): Promise<number | null> {
  // market_id is stored as the parent event slug — must query /events, not /markets
  try {
    const res = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(eventSlug)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const ev = data?.[0];
    if (!ev) return null;
    // For single-market events use the first market's YES price;
    // for bracket events return the highest-priced market (the current favourite)
    const markets = (ev.markets as Array<Record<string, unknown>>) ?? [];
    if (!markets.length) return null;
    let bestPrice = 0;
    for (const m of markets) {
      try {
        const prices = JSON.parse((m.outcomePrices as string) ?? '["0","0"]');
        const p = Math.round(parseFloat(prices[0] ?? "0") * 100);
        if (p > bestPrice) bestPrice = p;
      } catch { /* skip */ }
    }
    return bestPrice > 0 ? bestPrice : null;
  } catch { return null; }
}

async function getCurrentPrice(pick: OpenPick): Promise<number | null> {
  if (!pick.market_id) return null;
  if (pick.platform === "Kalshi") return fetchKalshiPrice(pick.market_id);
  if (pick.platform === "Polymarket") return fetchPolymarketPrice(pick.market_id);
  return null;
}

// Returns how far the price has moved against the recommended position
function movementAgainstThesis(pick: OpenPick, currentPrice: number): number {
  const isLong = pick.recommendation === "BUY";
  const delta = currentPrice - pick.implied_probability;
  // For BUY picks: negative delta = price fell = bad for thesis
  // For FADE picks: positive delta = price rose = bad for thesis (you shorted)
  return isLong ? -delta : delta;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only monitor picks from the last 14 days that haven't resolved yet
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: openPicks, error } = await getSupabase()
    .from("daily_picks")
    .select("id, platform, market_id, position, implied_probability, recommendation, event, pick_date")
    .is("result", null)
    .gte("pick_date", since)
    .not("market_id", "is", null);

  if (error) {
    console.error("Monitor cron: failed to fetch open picks:", error);
    return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });
  }

  const picks = (openPicks ?? []) as OpenPick[];
  if (!picks.length) {
    return NextResponse.json({ message: "No open picks to monitor", count: 0 });
  }

  const results = await Promise.all(
    picks.map(async (pick) => {
      const currentPrice = await getCurrentPrice(pick);
      if (currentPrice === null) return { id: pick.id, status: "price_unavailable" };

      const movementAgainst = movementAgainstThesis(pick, currentPrice);
      const isAlerted = movementAgainst >= ALERT_THRESHOLD;

      if (isAlerted) {
        // Write the alert to the DB so the UI can surface it
        await getSupabase()
          .from("daily_picks")
          .update({
            current_price: currentPrice,
            price_alert: true,
            price_alert_at: new Date().toISOString(),
          })
          .eq("id", pick.id);

        console.log(`Monitor alert: ${pick.event} — moved ${movementAgainst.toFixed(1)}pp against thesis (was ${pick.implied_probability}%, now ${currentPrice}%)`);
        return { id: pick.id, status: "alerted", event: pick.event, movementAgainst };
      }

      // Update current price without alert
      await getSupabase()
        .from("daily_picks")
        .update({ current_price: currentPrice })
        .eq("id", pick.id);

      return { id: pick.id, status: "ok", currentPrice };
    })
  );

  const alerts = results.filter((r) => r.status === "alerted");
  console.log(`Monitor cron: checked ${picks.length} open picks, ${alerts.length} alerts triggered`);

  return NextResponse.json({
    checked: picks.length,
    alerts: alerts.length,
    alertedPicks: alerts,
  });
}
