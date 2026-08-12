import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function gradeFromEdge(edge: number): string {
  if (edge >= 15) return "S";
  if (edge >= 10) return "A";
  if (edge >= 5) return "B";
  if (edge >= 0) return "C";
  if (edge >= -5) return "D";
  return "F";
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await getSupabase()
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const isAdmin = userId === process.env.ADMIN_USER_ID;
  if (!isActive && !isAdmin) {
    return NextResponse.json({ error: "Subscription required", upgradeRequired: true }, { status: 403 });
  }

  const body = await req.json();
  const pickIds: string[] = Array.isArray(body.pickIds) ? body.pickIds : [];

  if (pickIds.length < 2) {
    return NextResponse.json({ error: "Select at least 2 picks to build a parlay" }, { status: 400 });
  }
  if (pickIds.length > 6) {
    return NextResponse.json({ error: "Maximum 6 legs per parlay" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: picks, error } = await getSupabase()
    .from("daily_picks")
    .select("id, event, position, platform, grade, grade_label, recommendation, recommendation_reason, edge_score, implied_probability, true_odds, category")
    .in("id", pickIds)
    .eq("pick_date", today);

  if (error || !picks || picks.length === 0) {
    return NextResponse.json({ error: "Could not load selected picks" }, { status: 404 });
  }

  if (picks.length !== pickIds.length) {
    return NextResponse.json({ error: "One or more picks not found for today" }, { status: 400 });
  }

  // Validate same platform
  const platforms = [...new Set(picks.map((p) => String(p.platform ?? "")))];
  if (platforms.length > 1) {
    return NextResponse.json({ error: "All legs must be on the same platform" }, { status: 400 });
  }

  const platform = platforms[0];

  // Compute combined math
  const trueProbabilities = picks.map((p) => Number(p.true_odds ?? p.implied_probability ?? 50));
  const impliedProbabilities = picks.map((p) => Number(p.implied_probability ?? 50));

  const combinedTrueProbability = trueProbabilities.reduce((acc, p) => acc * (p / 100), 1) * 100;
  const combinedImpliedProbability = impliedProbabilities.reduce((acc, p) => acc * (p / 100), 1) * 100;
  const parlayEdge = combinedTrueProbability - combinedImpliedProbability;
  const computedGrade = gradeFromEdge(parlayEdge);

  const legsText = picks.map((p, i) =>
    `Leg ${i + 1}: ${p.event} (${p.position ?? ""})
  - Platform: ${p.platform}
  - Grade: ${p.grade} | Recommendation: ${p.recommendation}
  - Edge: +${Number(p.edge_score ?? 0).toFixed(1)}%
  - Market implied: ${Number(p.implied_probability ?? 0).toFixed(1)}% → True estimate: ${Number(p.true_odds ?? p.implied_probability ?? 0).toFixed(1)}%
  - Context: ${p.recommendation_reason ?? ""}`
  ).join("\n\n");

  const prompt = `You are a prediction market parlay analyst. A user has selected ${picks.length} legs to build a parlay on ${platform}. The math has already been computed — your job is to add qualitative analysis.

Pre-computed parlay math:
- Combined true probability: ${combinedTrueProbability.toFixed(2)}%
- Combined implied (payout) probability: ${combinedImpliedProbability.toFixed(2)}%
- Parlay edge: ${parlayEdge >= 0 ? "+" : ""}${parlayEdge.toFixed(2)}%
- Computed grade: ${computedGrade}

Individual legs:
${legsText}

Analyze this parlay combination. Consider:
- Do these legs correlate positively or negatively with each other?
- Are any legs weak links that drag down the parlay?
- Is the combination thematically coherent?
- Given the combined edge, what's the right recommendation?

Return ONLY a JSON object (no markdown fences):
{
  "recommendation": "BUY" | "FADE" | "HOLD",
  "recommendationReason": "string (1-2 sentences — direct, specific, why)",
  "parlayNarrative": "string (2-3 sentences — what makes this parlay interesting or concerning)",
  "correlationRisks": ["string", ...] (0-3 items — specific correlation or thematic risks; empty array if none),
  "legs": [
    {
      "event": "string",
      "assessment": "string (one punchy sentence — why this leg is strong or weak in the context of this parlay)",
      "keepOrRemove": "KEEP" | "REMOVE"
    }
  ],
  "optimizationNote": "string (if any legs should be removed, explain what the trimmed parlay looks like; empty string if all legs are solid)"
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  let aiResult: {
    recommendation: "BUY" | "FADE" | "HOLD";
    recommendationReason: string;
    parlayNarrative: string;
    correlationRisks: string[];
    legs: { event: string; assessment: string; keepOrRemove: "KEEP" | "REMOVE" }[];
    optimizationNote: string;
  };

  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    const validRecs = new Set(["BUY", "FADE", "HOLD"]);
    aiResult = {
      recommendation: validRecs.has(parsed.recommendation) ? parsed.recommendation : "HOLD",
      recommendationReason: String(parsed.recommendationReason ?? "").trim(),
      parlayNarrative: String(parsed.parlayNarrative ?? "").trim(),
      correlationRisks: Array.isArray(parsed.correlationRisks) ? parsed.correlationRisks.map(String) : [],
      legs: Array.isArray(parsed.legs) ? parsed.legs.map((l: Record<string, unknown>) => ({
        event: String(l.event ?? ""),
        assessment: String(l.assessment ?? ""),
        keepOrRemove: l.keepOrRemove === "REMOVE" ? "REMOVE" : "KEEP",
      })) : [],
      optimizationNote: String(parsed.optimizationNote ?? "").trim(),
    };
  } catch {
    return NextResponse.json({ error: "Failed to parse AI analysis" }, { status: 422 });
  }

  // Merge AI leg assessments with pick data
  const mergedLegs = picks.map((pick, i) => {
    const aiLeg = aiResult.legs[i] ?? { event: pick.event, assessment: "", keepOrRemove: "KEEP" };
    return {
      event: String(pick.event ?? ""),
      position: String(pick.position ?? ""),
      platform: String(pick.platform ?? ""),
      grade: String(pick.grade ?? ""),
      recommendation: String(pick.recommendation ?? ""),
      impliedProbability: Number(pick.implied_probability ?? 0),
      trueProbability: Number(pick.true_odds ?? pick.implied_probability ?? 0),
      edge: Number(pick.edge_score ?? 0),
      assessment: aiLeg.assessment,
      keepOrRemove: aiLeg.keepOrRemove as "KEEP" | "REMOVE",
    };
  });

  return NextResponse.json({
    grade: computedGrade,
    platform,
    recommendation: aiResult.recommendation,
    recommendationReason: aiResult.recommendationReason,
    parlayNarrative: aiResult.parlayNarrative,
    combinedTrueProbability,
    combinedImpliedProbability,
    parlayEdge,
    correlationRisks: aiResult.correlationRisks,
    legs: mergedLegs,
    optimizationNote: aiResult.optimizationNote,
  });
}
