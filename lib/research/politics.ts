import { tavilySearch, formatTavilyResults, dedup } from "./tavily";

export async function getPoliticsContext(event: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  const [polls, models, news] = await Promise.all([
    tavilySearch(`${event} polling average aggregate RCP Silver Bulletin`, 14),
    tavilySearch(`${event} FiveThirtyEight model forecast probability prediction`, 30),
    tavilySearch(`${event} election news endorsement fundraising campaign update ${today}`, 7),
  ]);

  const top = dedup([polls, models, news]).slice(0, 9);
  if (!top.length) return "";

  return [
    `=== POLITICAL INTELLIGENCE (${today}) ===`,
    `Polling aggregates, forecast models, and key campaign developments.`,
    ``,
    formatTavilyResults(top),
  ].join("\n");
}
