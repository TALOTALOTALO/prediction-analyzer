import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function tavilySearch(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return "";
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
      .map((r: { title: string; content: string }) => `[${r.title}]: ${r.content.slice(0, 400)}`)
      .join("\n\n");
    const answer = data.answer ? `Summary: ${data.answer}\n\n` : "";
    return `${answer}${snippets}`;
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Skip if picks already exist for today
  const { data: existing } = await getSupabase()
    .from("daily_picks")
    .select("id")
    .eq("pick_date", today)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: "Picks already generated for today", date: today });
  }

  // Parallel Tavily searches across market categories
  const [politics, sports, economics, general] = await Promise.all([
    tavilySearch(`Kalshi Polymarket prediction market politics best value odds ${today}`),
    tavilySearch(`Kalshi sports prediction market mispriced odds today ${today}`),
    tavilySearch(`Polymarket economics finance crypto prediction market opportunities ${today}`),
    tavilySearch(`prediction market best bets high conviction plays underpriced ${today}`),
  ]);

  const marketIntel = [
    `=== POLITICS ===\n${politics}`,
    `=== SPORTS ===\n${sports}`,
    `=== ECONOMICS & FINANCE ===\n${economics}`,
    `=== GENERAL MARKETS ===\n${general}`,
  ].join("\n\n---\n\n");

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages: [{
      role: "user",
      content: `You are an expert prediction market analyst. Today is ${todayLabel}. Based on the live market intelligence below, identify the best prediction market opportunities currently available.

LIVE MARKET INTELLIGENCE:
${marketIntel}

Select the top plays from Kalshi, Polymarket, PredictIt, or similar platforms that appear mispriced or represent clear value. Only include picks with grade A or better — genuine edge plays, not just interesting markets.

Return ONLY a valid JSON array (no markdown, no explanation). Include between 3 and 6 picks:
[
  {
    "platform": "string",
    "event": "string (specific market title)",
    "position": "string (YES, NO, or specific option)",
    "odds": "string (e.g. 65¢, +200, 65%)",
    "impliedProbability": number,
    "category": "string (Politics, Sports, Finance, Economics, Entertainment, Other)",
    "grade": "string (S or A only)",
    "gradeLabel": "string (e.g. 'Exceptional Edge', 'Strong Value')",
    "edgeScore": number,
    "trueOdds": number,
    "recommendation": "string (BUY or FADE)",
    "recommendationReason": "string (1 sentence)",
    "summary": "string (2-3 sentences)",
    "bullCase": "string",
    "bearCase": "string",
    "keyRisks": ["string", "string", "string"],
    "marketInefficiency": "string",
    "confidenceLevel": "string (High or Very High)"
  }
]

Order by edge score descending. Be rigorous — if fewer than 3 strong picks exist, return what you have.`,
    }],
  });

  const text = (response.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  let picks: Record<string, unknown>[];
  try {
    picks = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    if (!Array.isArray(picks)) throw new Error("Not an array");
  } catch {
    console.error("Failed to parse picks response:", text.slice(0, 500));
    return NextResponse.json({ error: "Failed to parse picks" }, { status: 422 });
  }

  const rows = picks.map((p) => ({
    pick_date: today,
    platform: p.platform,
    event: p.event,
    position: p.position,
    odds: p.odds,
    implied_probability: p.impliedProbability,
    category: p.category,
    grade: p.grade,
    grade_label: p.gradeLabel,
    edge_score: p.edgeScore,
    true_odds: p.trueOdds,
    recommendation: p.recommendation,
    recommendation_reason: p.recommendationReason,
    summary: p.summary,
    bull_case: p.bullCase,
    bear_case: p.bearCase,
    key_risks: p.keyRisks,
    market_inefficiency: p.marketInefficiency,
    confidence_level: p.confidenceLevel,
  }));

  const { error } = await getSupabase().from("daily_picks").insert(rows);
  if (error) {
    console.error("Failed to save picks:", error);
    return NextResponse.json({ error: "Failed to save picks" }, { status: 500 });
  }

  return NextResponse.json({ success: true, date: today, count: rows.length });
}
