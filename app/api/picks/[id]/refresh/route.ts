import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score?: number;
}

async function tavilySearch(query: string, days?: number): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY || !query) return [];
  try {
    const body: Record<string, unknown> = {
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: 8,
      include_answer: false,
    };
    if (days) body.days = days;
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

function formatResults(results: TavilyResult[]): string {
  return results
    .map((r) => {
      const date = r.published_date ? r.published_date.slice(0, 10) : "date unknown";
      let domain = "";
      try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch { domain = r.url; }
      return `[${date}] ${r.title} (${domain})\n${r.content.slice(0, 500)}`;
    })
    .join("\n\n---\n\n");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data: pick, error: fetchErr } = await getSupabase()
    .from("daily_picks")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  const pickDate = pick.pick_date as string;
  const pickDateLabel = new Date(pickDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  // Calculate days between pick date and today so we only pull
  // pre-resolution context (articles published before or on the pick date).
  const todayMs = Date.now();
  const pickMs = new Date(pickDate + "T12:00:00").getTime();
  const daysSincePick = Math.max(1, Math.ceil((todayMs - pickMs) / 86_400_000));

  // Search for context that was available AS OF the pick date by capping
  // the lookback to articles published before the pick resolved.
  const prePickDays = daysSincePick + 7; // articles from the week before the pick
  const [r1, r2] = await Promise.all([
    tavilySearch(`${pick.event} ${pick.platform} prediction market analysis`, prePickDays),
    tavilySearch(`${pick.event} background context history`, prePickDays),
  ]);

  const seen = new Set<string>();
  const merged: TavilyResult[] = [];
  for (const r of [...r1, ...r2]) {
    if (!seen.has(r.url)) { seen.add(r.url); merged.push(r); }
  }

  // Filter to only articles published on or before the pick date so we
  // don't include outcome/resolution news in the analysis.
  const prePickResults = merged
    .filter((r) => {
      if (!r.published_date) return true;
      return r.published_date.slice(0, 10) <= pickDate;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10);

  const newsContext = prePickResults.length > 0
    ? [
        `=== BACKGROUND CONTEXT (articles published on or before ${pickDate}) ===`,
        `Use this to reason about what was knowable when the pick was made. Ignore any outcome information.`,
        ``,
        formatResults(prePickResults),
      ].join("\n")
    : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages: [{
      role: "user",
      content: `You are an expert prediction market analyst writing the analysis that was delivered to subscribers on ${pickDateLabel} — BEFORE this market resolved.

Your job is to reconstruct the forward-looking investment thesis: why did this pick have edge AT THE TIME it was made? Write in present tense as if the market is still open and the outcome is unknown.

PICK DETAILS (as of ${pickDateLabel}):
- Event: ${pick.event}
- Platform: ${pick.platform}
- Position: ${pick.position}
- Market price: ${pick.odds} (${pick.implied_probability}¢ implied probability)
- Our grade: ${pick.grade} | Recommendation: ${pick.recommendation}

BACKGROUND CONTEXT (published before the pick date — use this to ground your reasoning):
${newsContext || "No pre-pick context found — reason from market structure and base rates only."}

CRITICAL RULES:
- Write as if the outcome is UNKNOWN. Do not reference or imply the result.
- Every claim must be grounded in the background context above OR in structural market logic.
- The bull case should explain why the market is underpricing this outcome.
- The bear case should explain the strongest counterargument a skeptic would make.
- market_inefficiency should explain specifically WHY the crowd got the price wrong.

Return ONLY a JSON object (no markdown):
{
  "summary": "string (2-3 sentences — why this pick has edge, written in present tense before resolution)",
  "bullCase": "string (strongest forward-looking argument FOR this position)",
  "bearCase": "string (strongest argument AGAINST — what could make this pick wrong)",
  "keyRisks": ["string", "string", "string"],
  "marketInefficiency": "string (1-2 sentences — specifically why the crowd is mispricing this)",
  "recommendationReason": "string (1 sentence — core reason for the recommendation)",
  "trueOdds": number (0-100 — your probability estimate as a percentage, e.g. 62 for 62%),
  "edgeScore": number (MUST equal trueOdds minus impliedProbability exactly, in percentage points),
  "grade": "string — S if edgeScore >= 20, A if >= 10, B if >= 5, C if >= 2, D if > 0, F if <= 0",
  "confidenceLevel": "string (Low, Medium, High, Very High)"
}`,
    }],
  });

  const text = (response.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  let updated: Record<string, unknown>;
  try {
    updated = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    return NextResponse.json({ error: "Failed to parse refreshed analysis" }, { status: 422 });
  }

  const { error: updateErr } = await getSupabase()
    .from("daily_picks")
    .update({
      summary: updated.summary,
      bull_case: updated.bullCase,
      bear_case: updated.bearCase,
      key_risks: updated.keyRisks,
      market_inefficiency: updated.marketInefficiency,
      recommendation_reason: updated.recommendationReason,
      true_odds: updated.trueOdds,
      edge_score: updated.edgeScore,
      grade: updated.grade,
      confidence_level: updated.confidenceLevel,
    })
    .eq("id", id);

  if (updateErr) {
    console.error("Failed to update pick:", updateErr);
    return NextResponse.json({ error: "Failed to save refreshed analysis" }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated });
}
