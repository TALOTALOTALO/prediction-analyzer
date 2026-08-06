import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MAX_BASE64_LENGTH = 13_500_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
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

  if (!checkRateLimit(userId)) {
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

  if (!isActive) {
    // Allow one free analysis if they haven't used it yet
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
    // count === 0 → fall through and allow the free analysis
  }

  try {
    const body = await req.json();
    const { image, mimeType } = body as { image: string; mimeType: string };

    if (!image || !mimeType) {
      return NextResponse.json({ error: "Missing image or mimeType" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
      return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
    }
    if (image.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: "Image too large. Maximum size is 10MB." }, { status: 400 });
    }

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
Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "platform": "string (e.g. Kalshi, Polymarket, PredictIt, unknown)",
  "event": "string (what is being predicted)",
  "position": "string (YES or NO, or the specific option chosen)",
  "odds": "string (e.g. 72¢, 72%, +145, -110)",
  "impliedProbability": number (0-100, the market's implied probability as a percentage),
  "stake": "string (amount being risked, or 'unknown')",
  "potentialPayout": "string (potential return, or 'unknown')",
  "expirationDate": "string (when the bet resolves, or 'unknown')",
  "category": "string (e.g. Politics, Sports, Finance, Economics, Entertainment, Other)",
  "rawText": "string (any other relevant text visible in the screenshot)"
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
  "confidenceLevel": "string (Low, Medium, High, Very High)"
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
        has_live_context: !!newsContext,
      });
      if (dbErr) console.error("Failed to save analysis:", dbErr);
    });

    return NextResponse.json({ detected, analysis, hasLiveContext: !!newsContext });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
