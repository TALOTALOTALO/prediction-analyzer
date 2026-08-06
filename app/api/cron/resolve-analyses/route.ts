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

    const res = await fetch(`https://api.elections.kalshi.com${path}`, { headers });
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
    const res = await fetch(`https://gamma-api.polymarket.com/markets?id=${marketId}`);
    if (!res.ok) return null;
    const data: Record<string, unknown>[] = await res.json();
    const market = data?.[0];
    if (!market || market.active !== false) return null;

    let prices: string[];
    try {
      prices = JSON.parse((market.outcomePrices as string) ?? '["0.5","0.5"]');
    } catch {
      return null;
    }
    const yesPrice = parseFloat(prices[0] ?? "0.5");
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

  // Fetch unresolved analyses that have a market_id
  const { data: pending, error } = await getSupabase()
    .from("analyses")
    .select("id, platform, market_id, position, recommendation")
    .is("outcome", null)
    .not("market_id", "is", null);

  if (error) {
    console.error("Resolve analyses fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: "No pending analyses", resolved: 0 });
  }

  let resolved = 0;

  for (const analysis of pending) {
    const marketId = analysis.market_id as string;
    const platform = analysis.platform as string;

    let marketResult: "yes" | "no" | null = null;

    if (platform === "Kalshi") {
      marketResult = await checkKalshiResult(marketId);
    } else if (platform === "Polymarket") {
      marketResult = await checkPolymarketResult(marketId);
    }

    if (!marketResult) continue;

    const rec = (analysis.recommendation as string)?.toUpperCase();
    const pos = (analysis.position as string)?.toUpperCase();

    // Determine if prediction was correct:
    // BUY on YES position = correct if market resolves yes
    // FADE on YES position = correct if market resolves no
    // BUY on NO position = correct if market resolves no
    // FADE on NO position = correct if market resolves yes
    let outcome: "correct" | "incorrect" | null = null;
    if (rec === "BUY") {
      outcome = (pos === "NO" ? marketResult === "no" : marketResult === "yes") ? "correct" : "incorrect";
    } else if (rec === "FADE") {
      outcome = (pos === "NO" ? marketResult === "yes" : marketResult === "no") ? "correct" : "incorrect";
    }

    if (!outcome) continue;

    const { error: updateErr } = await getSupabase()
      .from("analyses")
      .update({ outcome })
      .eq("id", analysis.id);

    if (updateErr) {
      console.error(`Failed to resolve analysis ${analysis.id}:`, updateErr);
    } else {
      resolved++;
    }
  }

  return NextResponse.json({ message: "Resolution complete", resolved, checked: pending.length });
}
