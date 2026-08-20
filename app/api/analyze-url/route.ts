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

function categoryQueries(event: string, category: string | undefined, today: string): [string, string, string] {
  const year = today.slice(0, 4);
  const cat = (category ?? "").toLowerCase();
  const outcome = `${event} result outcome winner ${year}`;
  const recent = `${event} latest news update ${today}`;
  if (cat === "elections" || cat === "politics") return [outcome, recent, `${event} poll polling forecast`];
  if (cat === "sports") return [outcome, recent, `${event} injury lineup stats`];
  if (cat === "crypto" || cat === "finance" || cat === "economics") return [outcome, recent, `${event} regulatory price market analysis`];
  return [outcome, recent, `${event} prediction market Kalshi Polymarket odds`];
}

async function fetchNewsContext(event: string, category?: string): Promise<string> {
  if (!event) return "";
  const today = new Date().toISOString().split("T")[0];
  const [q1, q2, q3] = categoryQueries(event, category, today);
  const [r1, r2, r3] = await Promise.all([
    tavilySearch(q1, 14),
    tavilySearch(q2, 30),
    tavilySearch(q3, 60),
  ]);
  const seen = new Set<string>();
  const merged: TavilyResult[] = [];
  for (const r of [...r1, ...r2, ...r3]) {
    if (!seen.has(r.url)) { seen.add(r.url); merged.push(r); }
  }
  merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = merged.slice(0, 12);
  if (top.length === 0) return "";
  return [
    `=== LIVE RESEARCH (fetched ${today}) ===`,
    `Each result is prefixed with its publication date [YYYY-MM-DD]. An article published BEFORE the event date is forward-looking — it describes predictions, not confirmed outcomes. Use these dates as your primary temporal anchor.`,
    ``,
    formatResults(top),
  ].join("\n");
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

    if (host.includes("kalshi.com") && segments[0] === "markets" && segments.length >= 2) {
      // URL format: /markets/{event-ticker}/{event-slug}/{market-ticker}
      // The last segment is the actual market ticker
      const marketTicker = segments[segments.length - 1];
      return { platform: "Kalshi", marketId: marketTicker.toUpperCase() };
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

function buildKalshiHeaders(path: string): Record<string, string> {
  const keyId = process.env.KALSHI_API_KEY_ID;
  const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (keyId && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    const ts = Date.now();
    headers["KALSHI-ACCESS-KEY"] = keyId;
    headers["KALSHI-ACCESS-TIMESTAMP"] = String(ts);
    headers["KALSHI-ACCESS-SIGNATURE"] = kalshiSign(privateKey, ts, "GET", path);
  }
  return headers;
}

async function fetchKalshiMarket(ticker: string): Promise<MarketData | null> {
  try {
    // First try direct market lookup (works when ticker is a specific market like TICKER-OUTCOME)
    const singlePath = `/trade-api/v2/markets/${ticker}`;
    const singleRes = await fetch(`https://api.elections.kalshi.com${singlePath}`, {
      headers: buildKalshiHeaders(singlePath),
    });

    if (singleRes.ok) {
      const data = await singleRes.json();
      const m = data.market;
      if (m) {
        const lastPrice: number = m.last_price ?? m.yes_bid ?? 50;
        return {
          platform: "Kalshi",
          event: m.title ?? ticker,
          position: "YES",
          odds: `${lastPrice}¢`,
          impliedProbability: lastPrice,
          expirationDate: m.close_time ? new Date(m.close_time).toLocaleDateString("en-US") : "unknown",
          category: m.category ?? "Other",
          marketId: ticker,
          rawText: `Ticker: ${ticker}. Status: ${m.status ?? "unknown"}. Yes bid: ${m.yes_bid ?? "?"}¢, Yes ask: ${m.yes_ask ?? "?"}¢.`,
        };
      }
    }

    // Fall back: treat ticker as an event ticker and fetch all markets in the event.
    // Kalshi event pages (e.g. /markets/kxeculpgame/.../kxeculpgame-26aug09guacse) use this format.
    const eventPath = `/trade-api/v2/markets?event_ticker=${ticker}&status=open&limit=20`;
    const eventRes = await fetch(`https://api.elections.kalshi.com${eventPath}`, {
      headers: buildKalshiHeaders(eventPath),
    });
    if (!eventRes.ok) return null;
    const eventData = await eventRes.json();
    const markets: Record<string, unknown>[] = eventData.markets ?? [];
    if (markets.length === 0) return null;

    // Build a combined summary of all outcomes (e.g. Team A wins, Tie, Team B wins)
    const title = (markets[0].title as string) ?? ticker;
    const closeTime = markets[0].close_time as string | undefined;
    const outcomes = markets.map((m) => {
      const label = (m.yes_sub_title as string) ?? (m.ticker as string);
      const yesBid = Math.round(parseFloat((m.yes_bid_dollars as string) ?? "0") * 100);
      const yesAsk = Math.round(parseFloat((m.yes_ask_dollars as string) ?? "0") * 100);
      return `${label}: ${yesBid}¢–${yesAsk}¢`;
    });
    // Use the most expensive YES bid as the primary implied probability (likely favourite)
    const bestMarket = markets.reduce((best, m) => {
      const bid = parseFloat((m.yes_bid_dollars as string) ?? "0");
      return bid > parseFloat((best.yes_bid_dollars as string) ?? "0") ? m : best;
    }, markets[0]);
    const bestYesBid = Math.round(parseFloat((bestMarket.yes_bid_dollars as string) ?? "0") * 100);
    const bestLabel = (bestMarket.yes_sub_title as string) ?? "YES";

    return {
      platform: "Kalshi",
      event: title,
      position: bestLabel,
      odds: `${bestYesBid}¢`,
      impliedProbability: bestYesBid,
      expirationDate: closeTime ? new Date(closeTime).toLocaleDateString("en-US") : "unknown",
      category: "Sports",
      marketId: ticker,
      rawText: `Event: ${ticker}. Outcomes — ${outcomes.join(" | ")}. Favorite: ${bestLabel} at ${bestYesBid}¢ implied probability.`,
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
      marketId: (m.conditionId as string) ?? null,
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

  // Parse body before claiming the free slot — prevents burning it on a bad request
  let url: string;
  try {
    const body = await req.json();
    url = body.url;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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

    const newsContext = await fetchNewsContext(marketData.event, marketData.category);

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

CRITICAL RULES FOR ANALYSIS QUALITY:
- Every claim in bullCase, bearCase, keyRisks, summary, entryStrategy, and exitStrategy MUST be grounded in verifiable facts from the live context above or well-established, timeless logic. Do NOT invent scenarios.
- Your training data has a knowledge cutoff and may be months out of date. If you cite a specific company, product, person, or event as a risk or catalyst, you must be confident it is still current and relevant as of today — if in doubt, describe the structural/logical risk instead (e.g. "a surprise competitive release" rather than naming a specific product that may no longer exist).
- Do NOT reference products, services, or events that may have shut down, been discontinued, or changed since your training cutoff unless the live context above explicitly confirms they are still active.
- Prefer grounding analysis in the live news context provided; treat your training data as background knowledge only.

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
