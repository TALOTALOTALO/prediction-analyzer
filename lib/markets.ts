import { createSign } from "crypto";

export interface LiveMarket {
  platform: string;
  question: string;
  marketId?: string;       // Kalshi ticker or Polymarket event slug
  contract?: string;
  yesPrice: number;        // 0-100 (cents)
  noPrice?: number;        // 0-100 (cents)
  volume?: number;         // USD
  liquidity?: number;      // USD
  closesAt?: string;       // ISO date
  category?: string;
  conditionId?: string;    // Polymarket only — hex condition ID for CLOB API
  clobTokenIds?: string[]; // Polymarket only — YES/NO token IDs for order book
}

// --- Kalshi ---
function kalshiSign(privateKeyPem: string, timestampMs: number, method: string, path: string): string {
  const msg = `${timestampMs}${method}${path}`;
  const signer = createSign("RSA-SHA256");
  signer.update(msg);
  return signer.sign(privateKeyPem, "base64");
}

export async function fetchKalshiMarkets(): Promise<LiveMarket[]> {
  try {
    const keyId = process.env.KALSHI_API_KEY_ID;
    const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY;
    // api.kalshi.com covers all categories; api.elections.kalshi.com is elections-only
    const basePath = "/trade-api/v2/markets";
    const query = "?limit=200&status=open";
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (keyId && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
      const ts = Date.now();
      headers["KALSHI-ACCESS-KEY"] = keyId;
      headers["KALSHI-ACCESS-TIMESTAMP"] = String(ts);
      // Kalshi signs only the base path, not query string
      headers["KALSHI-ACCESS-SIGNATURE"] = kalshiSign(privateKey, ts, "GET", basePath);
    }

    const res = await fetch(`https://api.kalshi.com${basePath}${query}`, { headers });
    if (!res.ok) {
      console.error(`Kalshi API error: ${res.status} ${await res.text().then(t => t.slice(0, 200))}`);
      return [];
    }
    const data = await res.json();

    return (data.markets ?? [])
      .filter((m: Record<string, unknown>) => {
        // yes_bid and yes_ask are integers in cents (0-100); filter out illiquid/settled markets
        const yesAsk = (m.yes_ask as number) ?? 0;
        return yesAsk > 1 && yesAsk < 99;
      })
      .slice(0, 60)
      .map((m: Record<string, unknown>) => {
        // Use mid-price (bid+ask)/2 for best estimate of implied probability
        const yesBid = (m.yes_bid as number) ?? 0;
        const yesAsk = (m.yes_ask as number) ?? 0;
        const yesPrice = yesBid > 0 && yesAsk > 0 ? Math.round((yesBid + yesAsk) / 2) : ((m.last_price as number) ?? yesAsk);
        return {
          platform: "Kalshi",
          question: (m.title as string) ?? (m.event_ticker as string) ?? "Unknown",
          marketId: (m.ticker as string) ?? undefined,
          yesPrice,
          noPrice: 100 - yesPrice,
          volume: (m.volume_24h as number) ?? 0,
          liquidity: (m.open_interest as number) ?? 0,
          closesAt: m.close_time as string,
          category: (m.category as string) ?? "General",
        };
      });
  } catch (e) {
    console.error("Kalshi fetch exception:", e);
    return [];
  }
}

// --- Polymarket ---
export async function fetchPolymarkets(): Promise<LiveMarket[]> {
  try {
    const res = await fetch(
      "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false",
      { headers: { "Content-Type": "application/json" } }
    );
    if (!res.ok) return [];
    const data: Record<string, unknown>[] = await res.json();

    return data
      .filter((m) => {
        // Use event-level liquidity when available — bracket liquidity is often tiny even on
        // well-traded events (e.g. $200 bracket liquidity inside a $37k event)
        const parentEvent = (m.events as Array<Record<string, unknown>>)?.[0];
        const eventLiq = parentEvent
          ? ((parentEvent.liquidityNum as number) ?? parseFloat((parentEvent.liquidity as string) ?? "0"))
          : 0;
        const bracketLiq = (m.liquidityNum as number) ?? parseFloat((m.liquidity as string) ?? "0");
        const effectiveLiq = Math.max(eventLiq, bracketLiq);

        const end = m.endDate as string;
        if (effectiveLiq < 500) return false;
        if (!end) return false;
        const daysOut = (new Date(end).getTime() - Date.now()) / 86400000;
        return daysOut > 0 && daysOut < 90;
      })
      .slice(0, 50)
      .map((m): LiveMarket | null => {
        let prices: string[];
        try {
          prices = JSON.parse((m.outcomePrices as string) ?? '["0.5","0.5"]');
          if (!Array.isArray(prices)) prices = ["0.5", "0.5"];
        } catch {
          prices = ["0.5", "0.5"];
        }
        const yesPrice = Math.round(parseFloat(prices[0] ?? "0.5") * 100);
        // polymarket.com/event/{slug} requires the PARENT EVENT slug (from events[0].slug),
        // NOT the market slug. Market slugs differ from event slugs and break direct links.
        // Event slug format: {title-slug}-{random}-{timestamp}
        const parentEvent = (m.events as Array<Record<string, unknown>>)?.[0];
        const eventSlug = parentEvent?.slug as string | undefined;
        if (!eventSlug) return null; // skip markets with no parent event slug

        // Prefer event-level volume/liquidity so bracket markets show the full event's depth,
        // not just one bracket's thin slice (e.g. $9k bracket vs $37k total event)
        const eventVolume = parentEvent
          ? ((parentEvent.volumeNum as number) ?? parseFloat((parentEvent.volume as string) ?? "0"))
          : 0;
        const eventLiq = parentEvent
          ? ((parentEvent.liquidityNum as number) ?? parseFloat((parentEvent.liquidity as string) ?? "0"))
          : 0;
        const bracketVolume = (m.volumeNum as number) ?? parseFloat((m.volume as string) ?? "0");
        const bracketLiq = (m.liquidityNum as number) ?? parseFloat((m.liquidity as string) ?? "0");

        let clobTokenIds: string[] | undefined;
        try {
          const raw = m.clobTokenIds as string | undefined;
          if (raw) clobTokenIds = JSON.parse(raw);
        } catch { /* non-fatal */ }

        return {
          platform: "Polymarket",
          question: m.question as string,
          marketId: eventSlug,
          yesPrice,
          noPrice: 100 - yesPrice,
          volume: Math.max(eventVolume, bracketVolume),
          liquidity: Math.max(eventLiq, bracketLiq),
          closesAt: m.endDate as string,
          category: (parentEvent?.category as string) ?? "General",
          conditionId: (m.conditionId as string) ?? undefined,
          clobTokenIds,
        };
      })
      .filter((m): m is LiveMarket => m !== null)
      .slice(0, 30);
  } catch {
    return [];
  }
}

// --- PredictIt ---
interface PredictItContract {
  name: string;
  lastTradePrice: number | null;
  bestBuyYesCost: number | null;
  bestBuyNoCost: number | null;
}
interface PredictItMarket {
  name: string;
  contracts: PredictItContract[];
}

export async function fetchPredictItMarkets(): Promise<LiveMarket[]> {
  try {
    const res = await fetch("https://www.predictit.org/api/marketdata/all/", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();

    const markets: LiveMarket[] = [];
    for (const m of (data.markets ?? []) as PredictItMarket[]) {
      for (const c of m.contracts ?? []) {
        const yesPrice = c.bestBuyYesCost ?? c.lastTradePrice;
        const noPrice = c.bestBuyNoCost;
        if (!yesPrice || yesPrice <= 0) continue;
        // Skip near-certain contracts (>95¢) — not interesting
        if (yesPrice >= 0.95) continue;

        markets.push({
          platform: "PredictIt",
          question: m.name,
          contract: c.name !== m.name ? c.name : undefined,
          yesPrice: Math.round(yesPrice * 100),
          noPrice: noPrice ? Math.round(noPrice * 100) : undefined,
          category: "Politics",
        });
      }
    }

    // Sort by how close to 50¢ (most interesting/uncertain markets)
    return markets
      .sort((a, b) => Math.abs(a.yesPrice - 50) - Math.abs(b.yesPrice - 50))
      .slice(0, 50);
  } catch {
    return [];
  }
}

// --- Formatter ---
export function formatMarketsForClaude(markets: LiveMarket[]): string {
  if (markets.length === 0) return "No live market data available.";

  const byPlatform: Record<string, LiveMarket[]> = {};
  for (const m of markets) {
    (byPlatform[m.platform] ??= []).push(m);
  }

  return Object.entries(byPlatform)
    .map(([platform, ms]) => {
      const lines = ms.map((m) => {
        const contract = m.contract ? ` → ${m.contract}` : "";
        const price = `YES: ${m.yesPrice}¢${m.noPrice !== undefined ? ` / NO: ${m.noPrice}¢` : ""}`;
        const vol = m.volume ? ` | Vol: $${Math.round(m.volume).toLocaleString()}` : "";
        const liq = m.liquidity ? ` | Liq: $${Math.round(m.liquidity).toLocaleString()}` : "";
        const closes = m.closesAt ? ` | Closes: ${m.closesAt.slice(0, 10)}` : "";
        const id = m.marketId ? ` | ID: ${m.marketId}` : "";
        return `  • ${m.question}${contract}\n    ${price}${vol}${liq}${closes}${id}`;
      });
      return `=== ${platform.toUpperCase()} ===\n${lines.join("\n")}`;
    })
    .join("\n\n");
}
