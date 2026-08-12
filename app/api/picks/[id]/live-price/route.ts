import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { createSign } from "crypto";

function kalshiSign(
  privateKeyPem: string,
  timestampMs: number,
  method: string,
  path: string
): string {
  const msg = `${timestampMs}${method}${path}`;
  const signer = createSign("RSA-SHA256");
  signer.update(msg);
  return signer.sign(privateKeyPem, "base64");
}

async function fetchKalshiPrice(ticker: string): Promise<number | null> {
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

    // Kalshi prices are integers in 0-100 (cents) — no conversion needed
    const market = data.market as Record<string, unknown> | undefined;
    if (!market) return null;

    const yesBid = market.yes_bid as number | null | undefined;
    const yesAsk = market.yes_ask as number | null | undefined;
    const lastPrice = market.last_price as number | null | undefined;

    // Use mid-price when bid/ask are available, otherwise last_price
    const raw = (yesBid != null && yesAsk != null)
      ? Math.round((yesBid + yesAsk) / 2)
      : (yesAsk ?? lastPrice ?? null);

    if (raw === null || raw === undefined) return null;
    return raw;
  } catch {
    return null;
  }
}

async function fetchPolymarketPrice(marketId: string): Promise<number | null> {
  try {
    const isSlug = /^[a-z0-9-]+$/.test(marketId) && !marketId.startsWith("0x");
    const query = isSlug ? `slug=${marketId}` : `id=${marketId}`;
    const res = await fetch(`https://gamma-api.polymarket.com/markets?${query}`);
    if (!res.ok) return null;

    const data: Record<string, unknown>[] = await res.json();
    const market = data?.[0];
    if (!market) return null;

    let prices: string[];
    try {
      prices = JSON.parse((market.outcomePrices as string) ?? '["0.5","0.5"]');
    } catch {
      return null;
    }

    const yesPrice = parseFloat(prices[0] ?? "0.5");
    return Math.round(yesPrice * 100);
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data: pick, error } = await getSupabase()
    .from("daily_picks")
    .select("platform, market_id, implied_probability")
    .eq("id", id)
    .single();

  if (error || !pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  const platform = pick.platform as string | null;
  const marketId = pick.market_id as string | null;
  const originalPrice = pick.implied_probability as number | null;

  if (!platform || !marketId || (platform !== "Kalshi" && platform !== "Polymarket")) {
    return NextResponse.json({ currentPrice: null });
  }

  let currentPrice: number | null = null;
  if (platform === "Kalshi") {
    currentPrice = await fetchKalshiPrice(marketId);
  } else if (platform === "Polymarket") {
    currentPrice = await fetchPolymarketPrice(marketId);
  }

  if (currentPrice === null) {
    return NextResponse.json({ currentPrice: null });
  }

  const change =
    originalPrice !== null && originalPrice !== undefined
      ? currentPrice - Math.round(originalPrice)
      : null;

  return NextResponse.json({
    currentPrice,
    originalPrice: originalPrice !== null && originalPrice !== undefined ? Math.round(originalPrice) : null,
    change,
  });
}
