// Polymarket CLOB API — order book depth and smart money trade flow.
// No API key required for read-only market data.

interface CLOBOrder { price: string; size: string; }
interface CLOBBook { bids?: CLOBOrder[]; asks?: CLOBOrder[]; }
interface CLOBTrade { price?: string; size?: string; side?: string; timestamp?: string; match_time?: string; }

export async function getPolymarketCLOB(conditionId: string, clobTokenIds: string[]): Promise<string> {
  if (!conditionId || !clobTokenIds?.length) return "";

  const yesToken = clobTokenIds[0];
  const lines: string[] = ["=== POLYMARKET ORDER BOOK & SMART MONEY FLOW ==="];

  try {
    const [bookRes, tradesRes] = await Promise.all([
      fetch(`https://clob.polymarket.com/book?token_id=${yesToken}`, { headers: { Accept: "application/json" } }),
      fetch(`https://clob.polymarket.com/trades?market=${conditionId}&limit=30`, { headers: { Accept: "application/json" } }),
    ]);

    if (bookRes.ok) {
      const book: CLOBBook = await bookRes.json();
      const bids = (book.bids ?? []).slice(0, 5);
      const asks = (book.asks ?? []).slice(0, 5);

      if (bids.length || asks.length) {
        const topBid = bids[0] ? (parseFloat(bids[0].price) * 100).toFixed(1) + "¢" : "?";
        const topAsk = asks[0] ? (parseFloat(asks[0].price) * 100).toFixed(1) + "¢" : "?";
        lines.push(`Spread: ${topBid} bid / ${topAsk} ask`);

        const bidDepth = bids.reduce((s, o) => s + parseFloat(o.size), 0);
        const askDepth = asks.reduce((s, o) => s + parseFloat(o.size), 0);
        lines.push(`Order book depth: $${Math.round(bidDepth).toLocaleString()} bids / $${Math.round(askDepth).toLocaleString()} offers`);

        const large = [...bids, ...asks].filter((o) => parseFloat(o.size) >= 1000);
        if (large.length) {
          const formatted = large.map((o) => `$${Math.round(parseFloat(o.size)).toLocaleString()} @ ${(parseFloat(o.price) * 100).toFixed(1)}¢`);
          lines.push(`Large limit orders (≥$1k): ${formatted.join(", ")} — potential smart money positioning`);
        }
      }
    }

    if (tradesRes.ok) {
      const body = await tradesRes.json();
      const trades = (body.data ?? body ?? []) as CLOBTrade[];

      if (trades.length >= 3) {
        // Recent price direction
        const prices = trades.slice(0, 10).map((t) => parseFloat(t.price ?? "0")).filter((p) => p > 0);
        if (prices.length >= 2) {
          const delta = ((prices[0] - prices[prices.length - 1]) * 100).toFixed(1);
          const dir = parseFloat(delta) > 0 ? "↑" : parseFloat(delta) < 0 ? "↓" : "→";
          lines.push(`\nRecent price drift (last ${prices.length} trades): ${dir} ${delta}¢`);
        }

        // Large individual trades — smart money signal
        const large = trades.filter((t) => parseFloat(t.size ?? "0") >= 500).slice(0, 5);
        if (large.length) {
          lines.push("Large recent trades (smart money signal):");
          large.forEach((t) => {
            const size = Math.round(parseFloat(t.size ?? "0"));
            const price = (parseFloat(t.price ?? "0") * 100).toFixed(1);
            lines.push(`  ${t.side ?? "?"} $${size.toLocaleString()} @ ${price}¢`);
          });
        }
      }
    }
  } catch { /* non-fatal — CLOB data is additive */ }

  return lines.length > 1 ? lines.join("\n") : "";
}
