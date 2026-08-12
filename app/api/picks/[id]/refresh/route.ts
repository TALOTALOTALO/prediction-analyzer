import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function tavilySearch(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY || !query) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: 8,
        include_answer: true,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const snippets = (data.results ?? [])
      .map((r: { title: string; content: string }) => `- ${r.title}: ${r.content.slice(0, 400)}`)
      .join("\n");
    const answer = data.answer ? `Summary: ${data.answer}\n\n` : "";
    return `${answer}${snippets}`;
  } catch {
    return "";
  }
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

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const [specific, breaking] = await Promise.all([
    tavilySearch(`${pick.event} prediction market news today`),
    tavilySearch(`${pick.category ?? "news"} breaking news today`),
  ]);

  const newsContext = [
    specific && `=== MARKET-SPECIFIC CONTEXT ===\n${specific}`,
    breaking && `=== BREAKING NEWS ===\n${breaking}`,
  ].filter(Boolean).join("\n\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages: [{
      role: "user",
      content: `You are an expert prediction market analyst. Today is ${today}.

Re-analyze this prediction market pick using the latest news context below.

PICK DETAILS:
- Event: ${pick.event}
- Platform: ${pick.platform}
- Position: ${pick.position}
- Odds: ${pick.odds} (${pick.implied_probability}¢ implied)
- Current grade: ${pick.grade} | Recommendation: ${pick.recommendation}

LIVE NEWS CONTEXT (current as of today — use this, NOT your training data):
${newsContext || "No live context available — use only what is logically derivable."}

CRITICAL RULES:
- Every claim MUST be grounded in the live news context above or timeless structural logic.
- Do NOT reference specific companies, products, or events that you cannot verify are currently active from the news context above (e.g. do not cite products that may have been discontinued).
- If a specific bear/bull case actor cannot be verified as still relevant, describe it structurally instead.

Return ONLY a JSON object with updated analysis fields (no markdown):
{
  "summary": "string (2-3 sentences — updated overall assessment)",
  "bullCase": "string (strongest current argument FOR this position, grounded in live context)",
  "bearCase": "string (strongest current argument AGAINST this position, grounded in live context)",
  "keyRisks": ["string", "string", "string"],
  "recommendationReason": "string (1 sentence — updated key reason)",
  "trueOdds": number (0-100 scale — your probability estimate as a percentage, e.g. 62 for 62%, NOT 0.62),
  "edgeScore": number (MUST equal trueOdds minus impliedProbability exactly, in percentage points),
  "grade": "string — derived ONLY from edgeScore: S if edgeScore >= 20, A if edgeScore >= 10, B if >= 5, C if >= 2, D if > 0, F if <= 0",
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
