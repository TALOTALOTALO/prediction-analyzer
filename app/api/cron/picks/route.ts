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

  const supabase = getSupabase();

  // Fetch all active subscriber user IDs + their category preferences in parallel
  const [{ data: subs }, { data: allPrefs }] = await Promise.all([
    supabase.from("subscriptions").select("user_id").in("status", ["active", "trialing"]),
    supabase.from("user_preferences").select("user_id, category_filter"),
  ]);

  if (!subs || subs.length === 0) return;

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) return;

  const prefsByUser = new Map<string, string[] | null>(
    (allPrefs ?? []).map((p) => [p.user_id as string, p.category_filter as string[] | null])
  );

  // Fetch emails and send per-user filtered digest
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
        const email = primary?.email_address;
        if (!email) return;

        // Filter picks by this user's category preference (null = all picks)
        const catFilter = prefsByUser.get(user_id) ?? null;
        const userPicks = catFilter && catFilter.length > 0
          ? picks.filter((p) => catFilter.includes(p.category as string))
          : picks;

        if (userPicks.length === 0) return; // no picks match their filter — skip

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const html = await render(DailyPicksEmail({ picks: userPicks as any, dateLabel }));
        await resend.emails.send({
          from: "FadeMe.ai <picks@fademe.ai>",
          to: email,
          subject: `Your ${userPicks.length} AI picks for ${dateLabel}`,
          html,
        });
      } catch (e) {
        console.error(`Failed to send picks digest:`, e);
      }
    })
  );

  console.log(`Picks digest sent to ${subs.length} subscribers`);
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
        include_answer: false,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return (data.results ?? [])
      .map((r: { title: string; content: string }) => `[${r.title}]: ${r.content.slice(0, 400)}`)
      .join("\n\n");
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

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4000,
      messages: [{
      role: "user",
      content: `You are an expert prediction market analyst. Today is ${todayLabel}.

You have been given REAL LIVE market prices from Kalshi, Polymarket, and PredictIt — these are actual current prices you can trade right now. You also have Tavily research with breaking news context to help identify mispricings.

LIVE DATA:
${marketIntel}

Analyze the real markets above. Cross-reference their current prices with the news context to identify genuine mispricings where the market probability diverges significantly from true probability. Only include picks with grade A or better — genuine edge plays backed by specific evidence.

CRITICAL RULES FOR ANALYSIS QUALITY:
- Every claim in bullCase, bearCase, keyRisks, and summary MUST be grounded in the provided live data or Tavily research above. Do NOT invent risks or cite companies, products, events, or people that are not mentioned in the data provided.
- Your training data has a knowledge cutoff and may be months out of date. Treat any claim from your training data as potentially stale — only assert things you can verify from the Tavily context above.
- Do NOT reference products, companies, or events that may have shut down, pivoted, or changed since your training cutoff unless the Tavily research explicitly confirms they are still relevant today.
- If you cannot find a specific, current bear case in the provided data, describe the structural/logical bear case (e.g. "resolution criteria may be interpreted differently") rather than citing a potentially-outdated real-world actor.

Return ONLY a valid JSON array (no markdown, no explanation). Include between 3 and 6 picks:
[
  {
    "platform": "string",
    "event": "string (specific market title)",
    "position": "string (YES, NO, or specific option)",
    "odds": "string (e.g. 65¢, +200, 65%)",
    "impliedProbability": number (0-100, the current market price as a percentage — e.g. 42 for a market priced at 42¢ or 42%, NOT 0.42),
    "trueOdds": number (0-100, your best estimate of the actual probability this resolves in the position's favor — e.g. 62 if you estimate 62% true probability, NOT 0.62),
    "edgeScore": number (MUST equal trueOdds minus impliedProbability exactly, in percentage points — e.g. if impliedProbability is 42 and trueOdds is 62, edgeScore MUST be 20.0. Do NOT normalize or scale this number.),
    "grade": "string — derived ONLY from edgeScore: S if edgeScore >= 20, A if edgeScore >= 10. Do not include picks below 10pp edge.",
    "gradeLabel": "string (e.g. 'Exceptional Edge' for S, 'Strong Value' for A)",
    "recommendation": "string (BUY if position has positive edge, FADE if you recommend betting the opposite side)",
    "recommendationReason": "string (1 sentence)",
    "summary": "string (2-3 sentences)",
    "bullCase": "string",
    "bearCase": "string",
    "keyRisks": ["string", "string", "string"],
    "marketInefficiency": "string",
    "confidenceLevel": "string (High or Very High)",
    "category": "string (Elections, Politics, Sports, Culture, Crypto, Commodities, Climate, Economics, Mentions, Finance, Tech & Science)",
    "marketId": "string or null — COPY THE EXACT ID STRING from the market data line that says 'ID: ...' — do NOT shorten, truncate, or reformat it. For Kalshi this is the ticker e.g. KXBTC-25DEC31-B50000. For Polymarket this is the full event slug including any random suffix e.g. us-announces-end-of-iranian-blockade-byptptpt-20260713152715080. Reproduce it character-for-character. null only if no ID was provided in the market data."
  }
]

Order by edgeScore descending. Be rigorous — if fewer than 3 picks meet the 10pp minimum edge threshold, return what you have. Always include marketId when the market data line contains an ID field — copy it exactly.`,
    }],
    });
  } catch (err) {
    console.error("Claude API error in picks cron:", err);
    return NextResponse.json({ error: "Claude API failed", detail: String(err) }, { status: 502 });
  }

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
    market_id: (p as Record<string, unknown>).marketId ?? null,
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
