import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { createSign } from "crypto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RATE_LIMIT = 20;

async function checkRateLimit(userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await getSupabase()
    .from("analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);
  return (count ?? 0) < RATE_LIMIT;
}

async function fetchNewsContext(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY || !query) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${query} prediction market odds news`,
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const snippets = (data.results ?? [])
      .map((r: { title: string; content: string }) => `- ${r.title}: ${r.content.slice(0, 300)}`)
      .join("\n");
    const answer = data.answer ? `Summary: ${data.answer}\n\n` : "";
    return `${answer}Recent news and context:\n${snippets}`;
  } catch {
    return "";
  }
}

function kalshiSign(privateKeyPem: string, timestampMs: number, method: string, path: string): string {
  const msg = `${timestampMs}${method}${path}`;
  const signer = createSign("RSA-SHA256");
  signer.update(msg);
  return signer.sign(privateKeyPem, "base64");
}

function parseMarketUrl(rawUrl: string): { platform: "Kalshi" | "Polymarket"; marketId: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("kalshi.com") && segments[0] === "markets" && segments[1]) {
      return { platform: "Kalshi", marketId: segments[1].toUpperCase() };
    }

    if (host.includes("polymarket.com") && segments.length >= 1) {
      // /event/{event-slug}/{market-slug} or /market/{condition-id}
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) return { platform: "Polymarket", marketId: lastSegment };
    }

    return null;
  } catch {
    return null;
  }
}

interface MarketData {
  event: string;
  position: string;
  odds: string;
  impliedProbability: number;
  expirationDate: string;
  category: string;
  marketId: string;
  platform: string;
  rawText: string;
}

async function fetchKalshiMarket(ticker: string): Promise<MarketData | null> {
  try {
    const keyId = process.env.KALSHI_API_KEY_ID;
    const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY;
    const path = `/trade-api/v2/markets/${ticker}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (keyId && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
      const ts = Date.now();
      headers["KALSHI-ACCESS-KEY"] = keyId;
      headers["KALSHI-ACCESS-TIMESTAMP"] = String(ts);
      headers["KALSHI-ACCESS-SIGNATURE"] = kalshiSign(privateKey, ts, "GET", path);
    }

    const res = await fetch(`https://api.elections.kalshi.com${path}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const m = data.market;
    if (!m) return null;

    const lastPrice: number = m.last_price ?? m.yes_bid ?? 50;
    const impliedProbability = lastPrice; // Kalshi prices are in cents = direct probability %

    return {
      platform: "Kalshi",
      event: m.title ?? ticker,
      position: "YES",
      odds: `${lastPrice}¢`,
      impliedProbability,
      expirationDate: m.close_time ? new Date(m.close_time).toLocaleDateString("en-US") : "unknown",
      category: m.category ?? "Other",
      marketId: ticker,
      rawText: `Ticker: ${ticker}. Status: ${m.status ?? "unknown"}. Yes bid: ${m.yes_bid ?? "?"}¢, Yes ask: ${m.yes_ask ?? "?"}¢.`,
    };
  } catch {
    return null;
  }
}

async function fetchPolymarketMarket(slug: string): Promise<MarketData | null> {
  try {
    const res = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const data: Record<string, unknown>[] = await res.json();
    const m = data?.[0];
    if (!m) return null;

    let yesPrice = 0.5;
    try {
      const prices = JSON.parse((m.outcomePrices as string) ?? '["0.5","0.5"]');
      yesPrice = parseFloat(prices[0] ?? "0.5");
    } catch { /* keep default */ }

    const impliedProbability = Math.round(yesPrice * 100);

    return {
      platform: "Polymarket",
      event: (m.question as string) ?? slug,
      position: "YES",
      odds: `${impliedProbability}%`,
      impliedProbability,
      expirationDate: m.endDate ? new Date(m.endDate as string).toLocaleDateString("en-US") : "unknown",
      category: "Other",
      marketId: (m.conditionId as string) ?? slug,
      rawText: `Volume: $${m.volume ?? "?"}. Liquidity: $${m.liquidity ?? "?"}. Active: ${m.active ?? "?"}.`,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimit(userId))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before analyzing another bet." },
      { status: 429 }
    );
  }

  let isActive = false;
  try {
    const { data: sub, error: dbError } = await getSupabase()
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    isActive = sub?.status === "active" || sub?.status === "trialing";
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  if (!isActive) {
    const { error: claimErr } = await getSupabase()
      .from("free_analysis_claims")
      .insert({ user_id: userId });

    if (claimErr) {
      if (claimErr.code === "23505") {
        return NextResponse.json({ error: "Subscribe to analyze more bets", upgradeRequired: true }, { status: 403 });
      }
      const { count, error: countErr } = await getSupabase()
        .from("analyses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countErr) {
        return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
      }
      if ((count ?? 0) >= 1) {
        return NextResponse.json({ error: "Subscribe to analyze more bets", upgradeRequired: true }, { status: 403 });
      }
    }
  }

  try {
    const body = await req.json();
    const { url } = body as { url: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const parsed = parseMarketUrl(url.trim());
    if (!parsed) {
      return NextResponse.json(
        { error: "Unsupported URL. Paste a Kalshi (kalshi.com/markets/...) or Polymarket (polymarket.com/event/...) link." },
        { status: 400 }
      );
    }

    let marketData: MarketData | null = null;
    if (parsed.platform === "Kalshi") {
      marketData = await fetchKalshiMarket(parsed.marketId);
    } else {
      marketData = await fetchPolymarketMarket(parsed.marketId);
    }

    if (!marketData) {
      return NextResponse.json(
        { error: "Could not fetch market data. Make sure the URL points to a valid, active market." },
        { status: 422 }
      );
    }

    const newsContext = await fetchNewsContext(marketData.event);

    const detected = {
      platform: marketData.platform,
      event: marketData.event,
      position: marketData.position,
      odds: marketData.odds,
      impliedProbability: marketData.impliedProbability,
      stake: "unknown",
      potentialPayout: "unknown",
      expirationDate: marketData.expirationDate,
      category: marketData.category,
      rawText: marketData.rawText,
      marketId: marketData.marketId,
    };

    const analysisPrompt = `You are an expert prediction market analyst with access to real-time information. Analyze this bet and return a detailed assessment.

Bet details fetched directly from the ${marketData.platform} API:
${JSON.stringify(detected, null, 2)}

${newsContext ? `LIVE CONTEXT (use this to inform your probability estimate — this is current information as of today):\n${newsContext}\n` : ""}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "grade": "string (S, A, B, C, D, or F)",
  "gradeLabel": "string (e.g. 'Exceptional Edge', 'Strong Value', 'Slight Value', 'Fair Value', 'Slight Fade', 'Hard Pass')",
  "edgeScore": number (0-100, your estimated true probability vs implied probability delta, scaled to 0-100),
  "trueOdds": number (0-100, your best estimate of the actual probability this resolves YES),
  "recommendation": "string (BUY, HOLD, or FADE)",
  "recommendationReason": "string (1 sentence — the key reason for your recommendation)",
  "summary": "string (2-3 sentences — overall assessment of this bet)",
  "bullCase": "string (strongest argument FOR this position)",
  "bearCase": "string (strongest argument AGAINST this position)",
  "keyRisks": ["string", "string", "string"] (3 specific risks to be aware of),
  "marketInefficiency": "string (any notable pricing inefficiency or why the market may be mispriced)",
  "confidenceLevel": "string (Low, Medium, High, Very High)",
  "entryStrategy": "string (exactly when to pull the trigger — current conditions, price thresholds, or signals to watch for before entering)",
  "exitStrategy": "string (exactly when to walk away — what news, price movement, or event would make this bet invalid and you should cut your position)"
}

Grading scale:
S = Strong mispricing in your favor (5%+ edge), exceptional opportunity
A = Clear value bet (3-5% edge), good opportunity
B = Slight value (1-3% edge), worth considering
C = Roughly fair value (< 1% edge), proceed with caution
D = Slight negative value, market has edge over you
F = Significant negative value, avoid

Be rigorous and realistic. Most bets should grade C or lower.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysisResponse = await (client.messages.create as any)({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const analysisText = (analysisResponse.content as Array<{ type: string; text?: string }>)
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      return NextResponse.json({ error: "Failed to generate analysis" }, { status: 422 });
    }

    after(async () => {
      const { error: dbErr } = await getSupabase().from("analyses").insert({
        user_id: userId,
        platform: detected.platform,
        event: detected.event,
        position: detected.position,
        odds: detected.odds,
        implied_probability: detected.impliedProbability,
        stake: detected.stake,
        potential_payout: detected.potentialPayout,
        expiration_date: detected.expirationDate,
        category: detected.category,
        grade: analysis.grade,
        grade_label: analysis.gradeLabel,
        edge_score: analysis.edgeScore,
        true_odds: analysis.trueOdds,
        recommendation: analysis.recommendation,
        recommendation_reason: analysis.recommendationReason,
        summary: analysis.summary,
        bull_case: analysis.bullCase,
        bear_case: analysis.bearCase,
        key_risks: analysis.keyRisks,
        market_inefficiency: analysis.marketInefficiency,
        confidence_level: analysis.confidenceLevel,
        entry_strategy: analysis.entryStrategy,
        exit_strategy: analysis.exitStrategy,
        has_live_context: !!newsContext,
        market_id: detected.marketId,
      });
      if (dbErr) console.error("Failed to save url analysis:", dbErr);
    });

    return NextResponse.json({ detected, analysis, hasLiveContext: !!newsContext });
  } catch (error) {
    console.error("Analyze URL error:", error);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
