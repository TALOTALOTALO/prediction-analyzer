import { getWeatherContext } from "./weather";
import { getSportsContext } from "./sports";
import { getPoliticsContext } from "./politics";
import { getCryptoContext } from "./crypto";

const WEATHER_KEYWORDS = ["temperature", "high temp", "degrees", "°f", "°c", "rainfall", "precipitation", "snow", "rain", "wind speed", "humidity"];
const CRYPTO_KEYWORDS = ["bitcoin", "ethereum", "btc", "eth", "solana", "sol", "xrp", "crypto", "defi", "nft", "blockchain"];

export async function getCategoryContext(event: string, category?: string): Promise<string> {
  const cat = (category ?? "").toLowerCase();
  const q = event.toLowerCase();

  const tasks: Promise<string>[] = [];

  if (WEATHER_KEYWORDS.some((kw) => q.includes(kw))) tasks.push(getWeatherContext(event));
  if (cat === "sports") tasks.push(getSportsContext(event));
  if (cat === "elections" || cat === "politics") tasks.push(getPoliticsContext(event));
  if (cat === "crypto" || CRYPTO_KEYWORDS.some((kw) => q.includes(kw))) tasks.push(getCryptoContext(event));

  if (tasks.length === 0) return "";

  const results = await Promise.all(tasks);
  return results.filter(Boolean).join("\n\n");
}
