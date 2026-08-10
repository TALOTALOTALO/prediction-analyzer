export function getMarketUrl(platform: string, marketId: string | null, eventTitle?: string): string {
  const encoded = eventTitle ? encodeURIComponent(eventTitle) : "";
  if (platform === "Kalshi") {
    if (marketId) {
      const series = marketId.split("-")[0].toLowerCase();
      if (series) return `https://kalshi.com/markets/${series}`;
    }
    return encoded ? `https://kalshi.com/explore?s=${encoded}` : "https://kalshi.com/explore";
  }
  if (platform === "Polymarket") {
    if (marketId) return `https://polymarket.com/event/${marketId}`;
    return encoded ? `https://polymarket.com/markets?s=${encoded}` : "https://polymarket.com/markets";
  }
  if (platform === "PredictIt") {
    return "https://www.predictit.org/markets";
  }
  return "#";
}
