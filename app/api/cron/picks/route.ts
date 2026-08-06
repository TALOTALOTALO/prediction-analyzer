import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { getSupabase } from "@/lib/supabase";
import { fetchKalshiMarkets, fetchPolymarkets, fetchPredictItMarkets, formatMarketsForClaude } from "@/lib/markets";
import DailyPicksEmail from "@/emails/DailyPicksEmail";

export const maxDuration = 300; // 5 min — Tavily + Claude adaptive thinking needs room

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendPicksDigest(picks: Record<string, unknown>[], dateLabel: string) {
  if (!process.env.RESEND_API_KEY) return;

  // Fetch all active subscriber user IDs from Supabase
  const { data: subs } = await getSupabase()
    .from("subscriptions")
    .select("user_id")
    .eq("status", "active");

  if (!subs || subs.length === 0) return;

  // Fetch emails from Clerk for each subscriber
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) return;

  const emails: string[] = [];
  await Promise.all(
    subs.map(async ({ user_id }: { user_id: string }) => {
      try {
        const res = await fetch(`https://api.clerk.com/v1/users/${user_id}`, {
          headers: { Authorization: `Bearer ${clerkSecretKey}` },
        });
        if (!res.ok) return;
        const user = await res.json();
        const primary = user.email_addresses?.find(
          (e: { id: string; email_address: string }) => e.id === user.primary_email_address_id
        );
        if (primary?.email_address) emails.push(primary.email_address);
      } catch {
        // skip failed lookups
      }
    })
  );

  if (emails.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html = await render(DailyPicksEmail({ picks: picks as any, dateLabel }));

  // Resend allows up to 50 recipients per call — batch if needed
  const batchSize = 50;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    await resend.emails.send({
      from: "FadeMe.ai <picks@fademe.ai>",
      to: batch,
      subject: `Your ${picks.length} AI picks for ${dateLabel}`,
      html,
    });
  }

  console.log(`Picks digest sent to ${emails.length} subscribers`);
}

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

  // Fetch live markets + Tavily news context in parallel
  const [kalshiMarkets, polyMarkets, predictItMarkets, newsContext, marketNews] = await Promise.all([
    fetchKalshiMarkets(),
    fetchPolymarkets(),
    fetchPredictItMarkets(),
    tavilySearch(`prediction market news mispriced opportunities today ${today}`),
    tavilySearch(`politics economics finance breaking news events ${today}`),
  ]);

  const allMarkets = [...kalshiMarkets, ...polyMarkets, ...predictItMarkets];

  if (allMarkets.length === 0 && !newsContext && !marketNews) {
    console.error("All market data sources returned empty — aborting to avoid hallucinated picks");
    return NextResponse.json({ error: "No market data available" }, { status: 503 });
  }

  const liveMarketsText = formatMarketsForClaude(allMarkets);

  const marketIntel = `=== LIVE MARKET PRICES (${allMarkets.length} markets) ===
${liveMarketsText}

=== RESEARCH & NEWS CONTEXT ===
${newsContext}

${marketNews}`;

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
      content: `You are an expert prediction market analyst. Today is ${todayLabel}.

You have been given REAL LIVE market prices from Kalshi, Polymarket, and PredictIt — these are actual current prices you can trade right now. You also have Tavily research with breaking news context to help identify mispricings.

LIVE DATA:
${marketIntel}

Analyze the real markets above. Cross-reference their current prices with the news context to identify genuine mispricings where the market probability diverges significantly from true probability. Only include picks with grade A or better — genuine edge plays backed by specific evidence.

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

  if (rows.length === 0) {
    return NextResponse.json({ success: true, date: today, count: 0, message: "No picks generated" });
  }

  const { error } = await getSupabase().from("daily_picks").insert(rows);
  if (error) {
    console.error("Failed to save picks:", error);
    return NextResponse.json({ error: "Failed to save picks", detail: error.message, code: error.code }, { status: 500 });
  }

  // Send email digest to all active subscribers (non-blocking)
  sendPicksDigest(rows, todayLabel).catch((e) => console.error("Email digest failed:", e));

  return NextResponse.json({ success: true, date: today, count: rows.length });
}
