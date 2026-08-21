import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { getSupabase } from "@/lib/supabase";
import { fetchKalshiMarkets, fetchPolymarkets, fetchPredictItMarkets, formatMarketsForClaude, LiveMarket } from "@/lib/markets";
import { getModelInsightsBlock } from "@/lib/model-insights";
import { getCategoryContext } from "@/lib/research/index";
import { getPolymarketCLOB } from "@/lib/polymarket-clob";
import DailyPicksEmail from "@/emails/DailyPicksEmail";

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

// --- Email ---

async function sendPicksDigest(picks: Record<string, unknown>[], dateLabel: string) {
  if (!process.env.RESEND_API_KEY) return;
  const supabase = getSupabase();
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
        if (!primary?.email_address) return;
        const catFilter = prefsByUser.get(user_id) ?? null;
        const userPicks = catFilter?.length ? picks.filter((p) => catFilter.includes(p.category as string)) : picks;
        if (!userPicks.length) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const html = await render(DailyPicksEmail({ picks: userPicks as any, dateLabel }));
        await resend.emails.send({
          from: "FadeMe.ai <picks@fademe.ai>",
          to: primary.email_address,
          subject: `Your ${userPicks.length} AI picks for ${dateLabel}`,
          html,
        });
      } catch (e) { console.error("Failed to send picks digest:", e); }
    })
  );
  console.log(`Picks digest sent to ${subs.length} subscribers`);
}

// --- Step 1: Screener (Haiku) ---
// Quickly identifies the 8 most promising markets for deep analysis.

async function screenMarkets(markets: LiveMarket[], insightsBlock: string): Promise<number[]> {
  if (markets.length <= 8) return markets.map((_, i) => i);

  const formatted = formatMarketsForClaude(markets);
  const prompt = `You are a prediction market screener. Below are ${markets.length} live markets. Your job is to identify the 8 markets with the HIGHEST potential for mispricing — where the current price most likely diverges from true probability.

Score each market on edge potential. Prioritize:
- Markets priced 25–75% (most uncertainty, most edge potential)
- High volume (≥$10k) — liquid markets are more reliable signals
- Markets with clear fundamental anchors (measurable outcomes, verifiable data)
- Markets where news/data could change the pricing

${insightsBlock ? `HISTORICAL PERFORMANCE CONTEXT:\n${insightsBlock}\n` : ""}
MARKETS (indexed 0 to ${markets.length - 1}):
${formatted}

Return ONLY a JSON array of the 8 best market indices (0-based integers), ordered by edge potential descending. No explanation. Example: [3, 12, 0, 7, 19, 4, 22, 11]`;

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("");
    const indices = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) as number[];
    // Clamp to valid range
    return indices.filter((i) => typeof i === "number" && i >= 0 && i < markets.length).slice(0, 8);
  } catch {
    // Fallback: pick 8 markets closest to 50% (most uncertain)
    return markets
      .map((m, i) => ({ i, dist: Math.abs(m.yesPrice - 50) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8)
      .map((x) => x.i);
  }
}

// --- Step 2: Deep single-market analysis (Opus) ---

interface RawPick {
  platform: string;
  event: string;
  position: string;
  odds: string;
  impliedProbability: number;
  trueOdds: number;
  edgeScore: number;
  grade: string;
  gradeLabel: string;
  recommendation: string;
  recommendationReason: string;
  summary: string;
  bullCase: string;
  bearCase: string;
  keyRisks: string[];
  marketInefficiency: string;
  confidenceLevel: string;
  category: string;
  marketId: string | null;
}

async function analyzeMarket(
  market: LiveMarket,
  categoryContext: string,
  clobContext: string,
  generalNews: string,
  insightsBlock: string,
  todayLabel: string,
): Promise<RawPick | null> {
  const todayDate = new Date().toISOString().split("T")[0];
  const marketText = `Platform: ${market.platform}
Question: ${market.question}${market.contract ? ` → ${market.contract}` : ""}
YES: ${market.yesPrice}¢ / NO: ${market.noPrice ?? 100 - market.yesPrice}¢
Volume: $${market.volume ? Math.round(market.volume).toLocaleString() : "unknown"}
Liquidity: $${market.liquidity ? Math.round(market.liquidity).toLocaleString() : "unknown"}
Closes: ${market.closesAt?.slice(0, 10) ?? "unknown"}
Market ID: ${market.marketId ?? "none"}`;

  const sections = [
    `You are an expert prediction market analyst. Today is ${todayLabel} (${todayDate}).`,
    insightsBlock ? `FADEME PERFORMANCE MEMORY — use to calibrate edge estimates:\n${insightsBlock}` : "",
    `MARKET TO ANALYZE:\n${marketText}`,
    categoryContext ? `CATEGORY-SPECIFIC INTELLIGENCE:\n${categoryContext}` : "",
    clobContext ? `${clobContext}` : "",
    generalNews ? `GENERAL MARKET NEWS:\n${generalNews}` : "",
  ].filter(Boolean).join("\n\n");

  const prompt = `${sections}

TEMPORAL GROUNDING: Today is ${todayDate}. News articles prefixed [YYYY-MM-DD] that predate the event are forward-looking predictions, not outcomes. Only conclude a market is resolved if an article explicitly states it resolved AFTER the event date.

ANALYSIS RULES:
- Every claim MUST be grounded in the data above or timeless structural logic. Do NOT invent facts.
- If citing a company, person, or event as a catalyst — verify it is still current and relevant from the context above.
- The grading scale: S = edge ≥ 20pp, A = edge 10-20pp. Only return a pick if you find genuine edge ≥ 10pp.
- edgeScore MUST equal trueOdds minus impliedProbability exactly (can be negative if you'd FADE).

Return a single JSON object for this market if there is genuine edge, or the string "NO_EDGE" if the market is fairly priced. No markdown.

{
  "platform": "string",
  "event": "string (market question)",
  "position": "string (YES, NO, or specific option)",
  "odds": "string (e.g. 65¢, 65%)",
  "impliedProbability": number (0-100, current market YES price),
  "trueOdds": number (0-100, your estimated true probability),
  "edgeScore": number (MUST equal trueOdds minus impliedProbability),
  "grade": "string (S if edgeScore >= 20, A if edgeScore >= 10 — no other grades)",
  "gradeLabel": "string (Exceptional Edge for S, Strong Value for A)",
  "recommendation": "string (BUY if edgeScore > 0, FADE if edgeScore < 0)",
  "recommendationReason": "string (1 sentence)",
  "summary": "string (2-3 sentences)",
  "bullCase": "string",
  "bearCase": "string",
  "keyRisks": ["string", "string", "string"],
  "marketInefficiency": "string",
  "confidenceLevel": "string (High or Very High)",
  "category": "string (Elections, Politics, Sports, Culture, Crypto, Commodities, Climate, Economics, Mentions, Finance, Tech & Science)",
  "marketId": "string or null — copy exact ID from market data above"
}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (client.messages.create as any)({
      model: "claude-opus-4-7",
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });
    const text = (res.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    if (clean === "NO_EDGE" || clean.startsWith("NO_EDGE")) return null;
    return JSON.parse(clean) as RawPick;
  } catch { return null; }
}

// --- Step 3: Devil's advocate (Haiku) ---
// Challenges each pick to surface overlooked risks before it goes live.

async function devilsAdvocate(picks: RawPick[], todayDate: string): Promise<RawPick[]> {
  if (!picks.length) return picks;

  const picksSummary = picks.map((p, i) =>
    `[${i}] ${p.event} | Position: ${p.position} | Edge: ${p.edgeScore}pp | Recommendation: ${p.recommendation}\nBull: ${p.bullCase}\nBear: ${p.bearCase}`
  ).join("\n\n");

  const prompt = `You are a contrarian analyst auditing prediction market picks for a publishing system. Today is ${todayDate}.

Below are ${picks.length} proposed picks. For each, identify any FATAL FLAW that would invalidate the edge claim — things like:
- The market may already have resolved (event already happened)
- The bull case relies on stale or unverified information
- The edge claimed is too high to be believable given the market's liquidity
- The position direction is wrong (the recommended side clearly has negative edge)
- The event is inherently unpredictable (pure luck, no informational edge)

Return a JSON array of indices to KEEP (i.e. picks that survive scrutiny). Example: [0, 2] means keep picks 0 and 2, remove pick 1.
Only remove a pick if you have strong reason to believe it is flawed. When in doubt, keep it.

PICKS TO AUDIT:
${picksSummary}

Return ONLY the JSON array of indices to keep. No explanation.`;

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("");
    const keepIndices = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) as number[];
    return picks.filter((_, i) => keepIndices.includes(i));
  } catch {
    return picks; // if devil's advocate fails, keep all picks
  }
}

// --- Main handler ---

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await getSupabase().from("daily_picks").select("id").eq("pick_date", today).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ message: "Picks already generated for today", date: today });
  }

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  // Fetch all market data and context in parallel
  const [kalshiMarkets, polyMarkets, predictItMarkets, generalNews, insightsBlock] = await Promise.all([
    fetchKalshiMarkets(),
    fetchPolymarkets(),
    fetchPredictItMarkets(),
    (async () => {
      if (!process.env.TAVILY_API_KEY) return "";
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: `prediction market news mispriced opportunities ${today}`,
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
      } catch { return ""; }
    })(),
    getModelInsightsBlock(),
  ]);

  const allMarkets = [...kalshiMarkets, ...polyMarkets, ...predictItMarkets];
  if (allMarkets.length === 0) {
    console.error("All market data sources returned empty — aborting");
    return NextResponse.json({ error: "No market data available" }, { status: 503 });
  }

  // Step 1: Screener — identify 8 most promising candidates
  const candidateIndices = await screenMarkets(allMarkets, insightsBlock);
  const candidates = candidateIndices.map((i) => allMarkets[i]);
  console.log(`Screener selected ${candidates.length} candidates from ${allMarkets.length} markets`);

  // Step 2: Fetch category-specific context + CLOB for each candidate in parallel
  const enrichedCandidates = await Promise.all(
    candidates.map(async (m) => {
      const [categoryContext, clobContext] = await Promise.all([
        getCategoryContext(m.question, m.category),
        m.platform === "Polymarket" && m.conditionId && m.clobTokenIds?.length
          ? getPolymarketCLOB(m.conditionId, m.clobTokenIds)
          : Promise.resolve(""),
      ]);
      return { market: m, categoryContext, clobContext };
    })
  );

  // Step 3: Deep analysis — one Opus call per candidate (run in batches of 4 to avoid rate limits)
  const rawPicks: RawPick[] = [];
  for (let i = 0; i < enrichedCandidates.length; i += 4) {
    const batch = enrichedCandidates.slice(i, i + 4);
    const batchResults = await Promise.all(
      batch.map(({ market, categoryContext, clobContext }) =>
        analyzeMarket(market, categoryContext, clobContext, generalNews, insightsBlock, todayLabel)
      )
    );
    rawPicks.push(...batchResults.filter((p): p is RawPick => p !== null));
  }

  // Server-side edge enforcement — prompt-only rules aren't reliable
  const edgePicks = rawPicks.filter((p) => {
    const edge = typeof p.edgeScore === "number" ? p.edgeScore : parseFloat(String(p.edgeScore ?? "0"));
    return Math.abs(edge) >= 10;
  });

  if (!edgePicks.length) {
    console.log("No picks met the 10pp edge threshold after deep analysis");
    return NextResponse.json({ success: true, date: today, count: 0, message: "No qualifying picks today" });
  }

  // Step 4: Devil's advocate — remove picks with fatal flaws
  const survivingPicks = await devilsAdvocate(edgePicks, today);
  console.log(`Devil's advocate: ${edgePicks.length} picks in → ${survivingPicks.length} survived`);

  if (!survivingPicks.length) {
    return NextResponse.json({ success: true, date: today, count: 0, message: "All picks failed devil's advocate review" });
  }

  // Sort by absolute edge descending, cap at 6
  const finalPicks = survivingPicks
    .sort((a, b) => Math.abs(b.edgeScore) - Math.abs(a.edgeScore))
    .slice(0, 6);

  const rows = finalPicks.map((p) => ({
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
    market_id: p.marketId ?? null,
  }));

  const { error } = await getSupabase().from("daily_picks").insert(rows);
  if (error) {
    console.error("Failed to save picks:", error);
    return NextResponse.json({ error: "Failed to save picks", detail: error.message }, { status: 500 });
  }

  sendPicksDigest(rows, todayLabel).catch((e) => console.error("Email digest failed:", e));
  console.log(`Picks cron: ${finalPicks.length} picks saved for ${today}`);

  return NextResponse.json({ success: true, date: today, count: finalPicks.length });
}
