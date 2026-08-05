import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Auth check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Subscription check
  const { data: sub } = await getSupabase()
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  if (!isActive) {
    return NextResponse.json({ error: "Subscription required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { image, mimeType } = body as { image: string; mimeType: string };

    if (!image || !mimeType) {
      return NextResponse.json({ error: "Missing image or mimeType" }, { status: 400 });
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
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
