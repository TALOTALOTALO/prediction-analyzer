import { tavilySearch, formatTavilyResults, dedup } from "./tavily";

export async function getSportsContext(event: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  const [injuries, lines, preview] = await Promise.all([
    tavilySearch(`${event} injury report roster status questionable out ${today}`, 3),
    tavilySearch(`${event} betting odds line movement sharp money consensus pick`, 7),
    tavilySearch(`${event} preview analysis matchup prediction`, 7),
  ]);

  const top = dedup([injuries, lines, preview]).slice(0, 9);
  if (!top.length) return "";

  return [
    `=== SPORTS INTELLIGENCE (${today}) ===`,
    `Injury reports, line movement, and sharp consensus — signals most predictive of market mispricings.`,
    ``,
    formatTavilyResults(top),
  ].join("\n");
}
