import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSign } from "crypto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function kalshiSign(privateKeyPem: string, timestampMs: number, method: string, path: string): string {
  const msg = `${timestampMs}${method}${path}`;
  const signer = createSign("RSA-SHA256");
  signer.update(msg);
  return signer.sign(privateKeyPem, "base64");
}

function parseMarketUrl(rawUrl: string): { platform: "Kalshi" | "Polymarket"; marketId: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("kalshi.com") && segments[0] === "markets" && segments.length >= 2) {
      const marketTicker = segments[segments.length - 1];
      return { platform: "Kalshi", marketId: marketTicker.toUpperCase() };
    }

    if (host.includes("polymarket.com") && segments.length >= 1) {
      if (segments[0] === "event" && segments[1]) {
        return { platform: "Polymarket", marketId: segments[1] };
      }
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) return { platform: "Polymarket", marketId: lastSegment };
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchKalshiPrice(ticker: string): Promise<{ market: string; price: number } | null> {
  try {
    const path = `/trade-api/v2/markets/${ticker}`;
    const keyId = process.env.KALSHI_API_KEY_ID;
    const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY;
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
    const m = data.market as Record<string, unknown> | undefined;
    if (!m) return null;
    const yesBid = m.yes_bid as number | null | undefined;
    const yesAsk = m.yes_ask as number | null | undefined;
    const lastPrice = m.last_price as number | null | undefined;
    const price =
      yesBid != null && yesAsk != null
        ? Math.round((yesBid + yesAsk) / 2)
        : (yesAsk ?? lastPrice ?? null);
    if (price === null) return null;
    return { market: (m.title as string) ?? ticker, price };
  } catch {
    return null;
  }
}

async function fetchPolymarketPrice(slug: string): Promise<{ market: string; price: number } | null> {
  try {
    const evRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`);
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
          const yesPrice = Math.round(parseFloat(prices[0] ?? "0.5") * 100);
          return { market: (firstMarket.question as string) ?? slug, price: yesPrice };
        }
      }
    }

    const res = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const data: Record<string, unknown>[] = await res.json();
    const m = data?.[0];
    if (!m) return null;
    let prices: string[];
    try { prices = JSON.parse((m.outcomePrices as string) ?? '["0.5","0.5"]'); }
    catch { return null; }
    const yesPrice = Math.round(parseFloat(prices[0] ?? "0.5") * 100);
    return { market: (m.question as string) ?? slug, price: yesPrice };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { imageBase64?: string; mimeType?: string; url?: string };
  const { imageBase64, mimeType, url } = body;

  // URL mode
  if (url && typeof url === "string" && !imageBase64) {
    const parsed = parseMarketUrl(url.trim());
    if (!parsed) {
      return NextResponse.json(
        { error: "Unsupported URL. Paste a Kalshi (kalshi.com/markets/...) or Polymarket (polymarket.com/event/...) link." },
        { status: 400 }
      );
    }

    let result: { market: string; price: number } | null = null;
    if (parsed.platform === "Kalshi") {
      result = await fetchKalshiPrice(parsed.marketId);
    } else {
      result = await fetchPolymarketPrice(parsed.marketId);
    }

    if (!result) {
      return NextResponse.json(
        { error: "Could not fetch market data. Make sure the URL points to a valid, active market." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      platform: parsed.platform,
      market: result.market,
      position: "YES",
      entry_price: result.price,
      stake: null,
      market_id: parsed.marketId,
    });
  }

  // Image mode
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "Provide either imageBase64 or url" }, { status: 400 });
  }

  const validMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const imageMimeType = (validMimes.includes(mimeType ?? "") ? mimeType : "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: imageMimeType, data: imageBase64 },
            },
            {
              type: "text",
              text: `Parse this prediction market bet screenshot and return ONLY a JSON object with no markdown:

{
  "platform": string or null ("Kalshi", "Polymarket", "PredictIt", "FanDuel", etc.),
  "market": string or null (the event/question name),
  "position": string or null ("YES" or "NO"),
  "entry_price": number or null (price in cents 1-99, e.g. 65 for 65¢ or 65%),
  "stake": number or null (dollars wagered, e.g. 100),
  "market_id": string or null (ticker or condition ID if visible)
}

Set unknown fields to null. Do not guess.`,
            },
          ],
        },
      ],
    });

    const text = (response.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    const result = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    return NextResponse.json(result);
  } catch (e) {
    console.error("Parse trade image error:", e);
    return NextResponse.json({ error: "Failed to parse image" }, { status: 500 });
  }
}
