import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MAX_BASE64_LENGTH = 13_500_000;

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
      .map((r: { title: string; content: string; url: string }) =>
        `- ${r.title}: ${r.content.slice(0, 300)}`
      )
      .join("\n");

    const answer = data.answer ? `Summary: ${data.answer}\n\n` : "";
    return `${answer}Recent news and context:\n${snippets}`;
  } catch {
    return "";
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
      console.error("Supabase subscription check error:", dbError);
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    isActive = sub?.status === "active" || sub?.status === "trialing";
  } catch (err) {
    console.error("Supabase connection error:", err);
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  // Parse body before claiming the free slot — prevents burning it on a bad request
  let image: string, mimeType: string;
  try {
    const body = await req.json();
    image = body.image;
    mimeType = body.mimeType;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!image || !mimeType) {
    return NextResponse.json({ error: "Missing image or mimeType" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "Image too large. Maximum size is 10MB." }, { status: 400 });
  }

  if (!isActive) {
    // Atomically claim the free analysis slot — unique constraint on user_id prevents races
    const { error: claimErr } = await getSupabase()
      .from("free_analysis_claims")
      .insert({ user_id: userId });

    if (claimErr) {
      if (claimErr.code === "23505") {
        // Unique violation — free analysis already used
        return NextResponse.json({ error: "Subscribe to analyze more bets", upgradeRequired: true }, { status: 403 });
      }
      // Table may not exist yet — fall back to count check
      const { count, error: countErr } = await getSupabase()
        .from("analyses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countErr) {
        console.error("Free analysis count check failed:", countErr);
        return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
      }

      if ((count ?? 0) >= 1) {
        return NextResponse.json({ error: "Subscribe to analyze more bets", upgradeRequired: true }, { status: 403 });
      }
    }
    // Claim succeeded → fall through and allow the free analysis
  }

  try {

    // Call 1: Vision parse — extract structured bet details from screenshot
    const parseResponse = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType as AllowedMimeType, data: image },
            },
            {
              type: "text",
              text: `Analyze this prediction market screenshot and extract all bet details.

PLATFORM IDENTIFICATION GUIDE — use these visual fingerprints to identify the platform:

Kalshi:
- Dark navy/charcoal background (#0a0e1a or similar)
- Binary contracts: priced in cents or % (e.g. "72¢" or "72%"), YES/NO outcomes
- Ticker symbols in the format KXBTC-25DEC, PRES-2024, INX-25, etc.
- "Kalshi" wordmark or kalshi.com URL visible
- Green accent color for YES, red for NO
- Markets labeled "Event Contracts" or "Prediction Markets"
- Contract expiry shown as a date (e.g. "Expires Dec 31")
- Sports/multi-outcome markets: team or outcome names listed vertically, each with a multiplier (e.g. "2.01x", "3.80x") and a percentage in a green circle badge
- Volume shown as "$X,XXX vol" at the bottom
- "Spread and Total · N markets" label visible for sports markets
- League or event branding at the top (e.g. CPL logo, NFL shield)
- Colored horizontal underlines beneath team names (green, blue, orange)
- No "Kalshi" text may be visible if the screenshot is cropped — identify by the dark background + multiplier + percentage circle combination

Polymarket:
- Dark background with blue/purple accent colors
- Prices shown as percentages or decimals (e.g. "72%" or "0.72 USDC")
- USDC as the currency — "USDC", "$USDC", or crypto wallet references
- "Polymarket" wordmark or polymarket.com URL
- Outcome shares shown with Buy/Sell buttons
- Markets often show liquidity, volume in USDC
- Condition IDs visible in URL (long hex string)

PredictIt:
- White or light background (notable contrast vs dark platforms)
- Share-based pricing (e.g. "72¢ per share", "Yes shares", "No shares")
- "PredictIt" wordmark or predictit.org URL
- $850 max investment limit often referenced
- Political markets dominant (elections, legislation)
- "Buy Yes" / "Buy No" button labels

Manifold:
- Light or white background with colorful UI
- Uses "mana" (M$) as currency — M$, mana tokens
- "Manifold" wordmark or manifold.markets URL
- Social/community features visible (comments, likes)
- Creator name shown prominently
- Probability shown as a large percentage

Metaculus:
- Clean light background, academic/research aesthetic
- Questions worded precisely with resolution criteria
- Crowd forecast shown as a percentage
- "Metaculus" wordmark or metaculus.com URL
- No direct betting — forecasting/prediction platform
- Shows community prediction vs your prediction

Smarkets:
- "Smarkets" wordmark or smarkets.com URL
- Exchange-style odds (decimal or fractional)
- Back/Lay betting (exchange format)
- Sports and politics markets

Betfair:
- "Betfair" wordmark or betfair.com URL
- Blue and yellow brand colors
- Back/Lay exchange format
- Decimal odds (e.g. 1.72, 3.50)
- Sports markets dominant

FanDuel:
- "FanDuel" wordmark or fanduel.com URL
- Navy blue and green brand colors
- American moneyline odds (e.g. -110, +150)
- Spread, total, and moneyline bet types
- "Same Game Parlay" feature visible
- Sports betting dominant (NFL, NBA, MLB, NHL, etc.)

If you see a platform not listed above, use the wordmark, URL, or distinctive UI elements to identify it. If the platform cannot be determined, use "unknown".

Now extract all bet details and return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "platform": "string (Kalshi, Polymarket, PredictIt, Manifold, Metaculus, Smarkets, Betfair, FanDuel, or unknown)",
  "event": "string (what is being predicted)",
  "position": "string (YES or NO, or the specific option chosen)",
  "odds": "string (e.g. 72¢, 72%, +145, -110, 1.72)",
  "impliedProbability": number (0-100, the market's implied probability as a percentage),
  "stake": "string (amount being risked, or 'unknown')",
  "potentialPayout": "string (potential return, or 'unknown')",
  "expirationDate": "string (when the bet resolves, or 'unknown')",
  "category": "string (e.g. Elections, Politics, Sports, Culture, Crypto, Commodities, Climate, Economics, Mentions, Finance, Tech & Science)",
  "rawText": "string (any other relevant text visible in the screenshot)",
  "marketId": "string or null (Kalshi ticker e.g. KXBTC-24DEC, or Polymarket condition ID if visible in the URL or page — null if not visible)"
}`,
            },
          ],
        },
      ],
    });

    const parseText = parseResponse.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    let detected: Record<string, unknown>;
    try {
      detected = JSON.parse(parseText.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      return NextResponse.json({ error: "Failed to parse bet details from image" }, { status: 422 });
    }

    // Fetch live news context for the event — runs in parallel with nothing, ~500ms
    const newsContext = await fetchNewsContext(detected.event as string);

    // Call 2: Analysis — grade the bet using detected details + live news context
    const analysisPrompt = `You are an expert prediction market analyst with access to real-time information. Analyze this bet and return a detailed assessment.

Bet details extracted from screenshot:
${JSON.stringify(detected, null, 2)}

${newsContext ? `LIVE CONTEXT (use this to inform your probability estimate — this is current information as of today):\n${newsContext}\n` : ""}

CRITICAL RULES FOR ANALYSIS QUALITY:
- Every claim in bullCase, bearCase, keyRisks, summary, entryStrategy, and exitStrategy MUST be grounded in verifiable facts from the live context above or well-established, timeless logic. Do NOT invent scenarios.
- Your training data has a knowledge cutoff and may be months out of date. If you cite a specific company, product, person, or event as a risk or catalyst, you must be confident it is still current and relevant as of today — if in doubt, describe the structural/logical risk instead (e.g. "a surprise competitive release" rather than naming a specific product that may no longer exist or be relevant).
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

    // Persist to history after response is sent — after() keeps the lambda alive on Vercel
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
        market_id: (detected.marketId as string) ?? null,
      });
      if (dbErr) console.error("Failed to save analysis:", dbErr);
    });

    return NextResponse.json({ detected, analysis, hasLiveContext: !!newsContext });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
