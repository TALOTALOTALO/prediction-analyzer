export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score?: number;
}

export async function tavilySearch(query: string, days = 7, maxResults = 6): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY || !query) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: maxResults,
        include_answer: false,
        days,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

export function formatTavilyResults(results: TavilyResult[]): string {
  return results
    .map((r) => {
      const date = r.published_date ? r.published_date.slice(0, 10) : "date unknown";
      let domain = "";
      try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch { domain = r.url; }
      return `[${date}] ${r.title} (${domain})\n${r.content.slice(0, 450)}`;
    })
    .join("\n\n---\n\n");
}

export function dedup(results: TavilyResult[][]): TavilyResult[] {
  const seen = new Set<string>();
  const merged: TavilyResult[] = [];
  for (const r of results.flat()) {
    if (!seen.has(r.url)) { seen.add(r.url); merged.push(r); }
  }
  return merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
