import { tavilySearch, formatTavilyResults, dedup } from "./tavily";

const COIN_IDS: Record<string, string> = {
  bitcoin: "bitcoin", btc: "bitcoin",
  ethereum: "ethereum", eth: "ethereum",
  solana: "solana", sol: "solana",
  xrp: "ripple", ripple: "ripple",
  cardano: "cardano", ada: "cardano",
  dogecoin: "dogecoin", doge: "dogecoin",
  "shiba inu": "shiba-inu", shib: "shiba-inu",
  avalanche: "avalanche-2", avax: "avalanche-2",
  polygon: "matic-network", matic: "matic-network",
  chainlink: "chainlink", link: "chainlink",
};

function extractCoinId(question: string): string | null {
  const q = question.toLowerCase();
  for (const [kw, id] of Object.entries(COIN_IDS)) {
    if (q.includes(kw)) return id;
  }
  return null;
}

interface CoinPrice {
  usd?: number;
  usd_24h_change?: number;
  usd_market_cap?: number;
  usd_7d_change?: number;
}

export async function getCryptoContext(event: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const coinId = extractCoinId(event);
  const lines: string[] = [];

  if (coinId) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_7d_vol=true`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json() as Record<string, CoinPrice>;
        const coin = data[coinId];
        if (coin?.usd) {
          lines.push(
            `=== LIVE CRYPTO PRICE — ${coinId.toUpperCase()} (CoinGecko) ===`,
            `Price: $${coin.usd.toLocaleString()}`,
            `24h Change: ${coin.usd_24h_change?.toFixed(2) ?? "?"}%`,
            `Market Cap: $${coin.usd_market_cap ? (coin.usd_market_cap / 1e9).toFixed(2) + "B" : "?"}`,
          );
        }
      }
    } catch { /* non-fatal */ }
  }

  const [priceNews, regNews, onchain] = await Promise.all([
    tavilySearch(`${event} price analysis technical target ${today}`, 7),
    tavilySearch(`${event} regulatory SEC CFTC government ETF approval`, 14),
    tavilySearch(`${event} on-chain metrics whale activity exchange flows`, 14),
  ]);

  const top = dedup([priceNews, regNews, onchain]).slice(0, 8);
  if (top.length) {
    lines.push("", `=== CRYPTO MARKET INTELLIGENCE (${today}) ===`, formatTavilyResults(top));
  }

  return lines.join("\n");
}
