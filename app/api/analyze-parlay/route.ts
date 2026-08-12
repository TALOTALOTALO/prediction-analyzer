import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MAX_BASE64_LENGTH = 13_500_000;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sub, error: subErr } = await getSupabase()
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  if (subErr && subErr.code !== "PGRST116") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  if (!isActive) {
    return NextResponse.json(
      { error: "Subscribe to use the Parlay Analyzer", upgradeRequired: true },
      { status: 403 }
    );
  }

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

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
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
              text: `You are an expert sports betting and prediction market analyst. Analyze this parlay/combo bet screenshot.

Extract every bet leg and analyze the full parlay. For each leg, estimate the TRUE probability based on your knowledge of the sport, teams, and typical market pricing — this should differ from the implied probability where you have conviction.

Key insight to apply: Sports books typically embed vig (juice) into each leg's price. When parlayed, this vig compounds. A 5-leg parlay on a book charging 4.5% vig per leg compounds to roughly 20% total vig. This means parlays almost always have negative EV vs true probabilities. However, if a bettor has genuine edge on individual legs (their true prob >> implied prob), a selective parlay can still be positive EV.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "platform": "string (e.g. Betway, FanDuel, DraftKings, Kalshi, Polymarket, etc.)",
  "parlayType": "string (e.g. '7 Market Combo', 'Same Game Parlay', '4-Leg Parlay')",
  "stake": "string (as shown, e.g. '$10')",
  "potentialPayout": "string (as shown, e.g. '$719.42')",
  "stakeAmount": number (numeric stake, e.g. 10),
  "payoutAmount": number (numeric payout, e.g. 719.42),
  "legs": [
    {
      "event": "string (full description, e.g. 'Miami to win vs Leon')",
      "position": "string (what they're betting on, e.g. 'Miami win')",
      "impliedProbability": number (0-100, market's implied probability as shown or calculated from odds),
      "trueProbability": number (0-100, YOUR best estimate of the actual probability this leg wins),
      "edge": number (trueProbability - impliedProbability — positive means value, negative means book has edge),
      "legRecommendation": "KEEP or REMOVE",
      "reason": "string (1 concise sentence — the specific reason to keep or remove this leg)"
    }
  ],
  "parlayImpliedProbability": number (stakeAmount / payoutAmount * 100, this is the break-even probability to profit),
  "combinedTrueProbability": number (multiply all trueProbability/100 values together, multiply result by 100 — e.g. 0.55*0.62*0.71 = 0.242, displayed as 24.2),
  "parlayEdge": number (combinedTrueProbability - parlayImpliedProbability — negative is typical),
  "overallRecommendation": "FADE, HOLD, or BUY",
  "overallGrade": "S, A, B, C, D, or F",
  "overallSummary": "string (2-3 sentences — overall assessment including the math and your specific reasoning)",
  "legsToRemove": ["string"] (event descriptions of weak legs that should be cut — legs where your true prob is meaningfully below the implied prob, or very low probability legs dragging the parlay down without sufficient edge),
  "optimizationNote": "string (explain what the trimmed parlay achieves — e.g. removing 2 legs raises the combined true prob from X% to Y%, making it a more realistic bet while still offering solid returns)"
}

Grading the PARLAY overall (by parlayEdge):
S = edge >= +3% (your combined true probability meaningfully beats the payout implied probability)
A = edge >= +1%
B = edge >= 0%
C = edge between -1% and 0%
D = edge < -1%
F = edge < -3% (significant negative EV — compounded vig dominates)

Most multi-leg parlays should grade D or F due to compounded vig. Only S/A if you have genuine edge on multiple legs.

The core rule for KEEP vs REMOVE is strictly about edge (trueProbability vs impliedProbability):

REMOVE a leg if:
- trueProbability < impliedProbability (negative edge — the book prices this leg better than reality; including it drags the parlay's combined EV below break-even regardless of how "likely" the outcome looks)
- OR trueProbability is within 2 percentage points of impliedProbability AND trueProbability < 35% (near-zero edge on a highly uncertain outcome — removing it substantially lifts combined probability at essentially no EV cost)

KEEP a leg if:
- trueProbability > impliedProbability (positive edge — this leg contributes positively to the parlay's EV; keep it regardless of absolute probability level)
- OR trueProbability is within 2 percentage points of impliedProbability AND trueProbability >= 50% (near-neutral edge on a high-confidence outcome — negligible EV drag)

CRITICAL: Do NOT keep a leg simply because its absolute trueProbability is high (e.g. 70%) if the impliedProbability is even higher (e.g. 80%). That is a negative-edge leg and must be removed. High confidence ≠ good edge.`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      return NextResponse.json({ error: "Failed to parse parlay analysis" }, { status: 422 });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Parlay analyze error:", error);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
