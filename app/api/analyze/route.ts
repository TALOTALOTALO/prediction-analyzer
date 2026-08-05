import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// ~10MB decoded limit (base64 is ~133% of original, so 13.5MB base64 ≈ 10MB image)
const MAX_BASE64_LENGTH = 13_500_000;

// Simple in-memory rate limit: max 20 analyses per user per hour
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

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check
  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before analyzing another bet." },
      { status: 429 }
    );
  }

  // Subscription check — handle Supabase errors explicitly
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
    return NextResponse.json({ error: "Subscription required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { image, mimeType } = body as { image: string; mimeType: string };

    // Server-side input validation
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
              source: {
                type: "base64",
                media_type: mimeType as AllowedMimeType,
                data: image,
              },
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

    const parseText = parseResponse.content[0].type === "text" ? parseResponse.content[0].text : "";
    let detected: Record<string, unknown>;
    try {
      detected = JSON.parse(parseText.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      return NextResponse.json({ error: "Failed to parse bet details from image" }, { status: 422 });
    }

    // Call 2: Analysis — grade the bet and generate recommendation
    const analysisResponse = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are an expert prediction market analyst. Analyze this bet and return a detailed assessment.

Bet details extracted from screenshot:
${JSON.stringify(detected, null, 2)}

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

Be rigorous and realistic. Most bets should grade C or lower.`,
        },
      ],
    });

    const analysisText =
      analysisResponse.content[0].type === "text" ? analysisResponse.content[0].text : "";
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      return NextResponse.json({ error: "Failed to generate analysis" }, { status: 422 });
    }

    return NextResponse.json({ detected, analysis });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
