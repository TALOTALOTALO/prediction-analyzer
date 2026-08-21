import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ResolvedPick {
  id: string;
  pick_date: string;
  platform: string;
  event: string;
  position: string;
  grade: string;
  edge_score: number;
  implied_probability: number;
  true_odds: number | null;
  result: "won" | "lost";
  category: string | null;
  recommendation: string | null;
  summary: string | null;
  bull_case: string | null;
  bear_case: string | null;
  market_inefficiency: string | null;
  confidence_level: string | null;
}

interface CalibrationBucket {
  wins: number;
  losses: number;
  win_rate: number | null;
  total: number;
}

function bucket(wins: number, losses: number): CalibrationBucket {
  const total = wins + losses;
  return { wins, losses, total, win_rate: total > 0 ? Math.round((wins / total) * 100) : null };
}

function computeCalibration(picks: ResolvedPick[]) {
  const tally = (key: (p: ResolvedPick) => string) => {
    const map: Record<string, { w: number; l: number }> = {};
    for (const p of picks) {
      const k = key(p) || "Unknown";
      if (!map[k]) map[k] = { w: 0, l: 0 };
      if (p.result === "won") map[k].w++; else map[k].l++;
    }
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, bucket(v.w, v.l)])
    );
  };

  const wins = picks.filter((p) => p.result === "won").length;
  const losses = picks.filter((p) => p.result === "lost").length;

  const edgeBucketKey = (p: ResolvedPick) => {
    const e = p.edge_score ?? 0;
    if (e < 10) return "<10pp";
    if (e < 15) return "10-15pp";
    if (e < 20) return "15-20pp";
    return "20pp+";
  };

  return {
    overall: bucket(wins, losses),
    by_grade: tally((p) => p.grade),
    by_platform: tally((p) => p.platform),
    by_category: tally((p) => (p.category ?? "Unknown").toLowerCase()),
    by_edge_bucket: tally(edgeBucketKey),
  };
}

function formatPicksForClaude(picks: ResolvedPick[]): string {
  return picks
    .map((p) => {
      const outcome = p.result === "won" ? "✓ WON" : "✗ LOST";
      return [
        `[${outcome}] ${p.pick_date} · ${p.platform} · Grade ${p.grade} · Edge +${p.edge_score?.toFixed(1)}pp`,
        `Event: ${p.event} | Position: ${p.position} | Implied: ${p.implied_probability}% → True: ${p.true_odds ?? "?"}%`,
        p.summary ? `Summary: ${p.summary}` : null,
        p.bull_case ? `Bull: ${p.bull_case}` : null,
        p.bear_case ? `Bear: ${p.bear_case}` : null,
        p.market_inefficiency ? `Inefficiency: ${p.market_inefficiency}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Idempotency: skip if already ran today
  const { data: existing } = await getSupabase()
    .from("model_insights")
    .select("id")
    .eq("analysis_date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: "Learning already ran today", date: today });
  }

  // Fetch last 90 days of resolved picks (won or lost — exclude void)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: rawPicks, error } = await getSupabase()
    .from("daily_picks")
    .select(
      "id, pick_date, platform, event, position, grade, edge_score, implied_probability, true_odds, result, category, recommendation, summary, bull_case, bear_case, market_inefficiency, confidence_level"
    )
    .in("result", ["won", "lost"])
    .not("market_id", "is", null)
    .gte("pick_date", since)
    .order("pick_date", { ascending: false });

  if (error) {
    console.error("Learn cron: failed to fetch picks:", error);
    return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });
  }

  const picks = (rawPicks ?? []) as ResolvedPick[];

  if (picks.length < 5) {
    return NextResponse.json({ message: "Not enough resolved picks to learn from yet", count: picks.length });
  }

  // Compute calibration stats in code — pure math, no Claude needed
  const calibration = computeCalibration(picks);

  // Feed picks to Claude for qualitative pattern extraction
  // Use the 60 most recent for context (enough signal, fits in context)
  const samplePicks = picks.slice(0, 60);
  const wins = samplePicks.filter((p) => p.result === "won");
  const losses = samplePicks.filter((p) => p.result === "lost");

  const prompt = `You are analyzing the track record of FadeMe AI, a prediction market analyst. Below are ${samplePicks.length} resolved picks from the last 90 days — both wins and losses — with the original reasoning that led to each call.

Your job: extract concrete, actionable patterns that explain WHY picks won or lost. This will be injected into future analysis prompts so the system can self-correct.

RESOLVED PICKS (most recent first):
${formatPicksForClaude(samplePicks)}

---

WIN RATE SUMMARY:
- Wins: ${wins.length} | Losses: ${losses.length} | Win rate: ${calibration.overall.win_rate ?? "?"}%
${Object.entries(calibration.by_category).filter(([,b]) => b.total >= 3).map(([c,b]) => `- ${c}: ${b.win_rate}% (${b.total} picks)`).join("\n")}

---

Return a JSON object with exactly these three fields (no markdown, no explanation outside the JSON):
{
  "win_factors": "2-4 sentences describing what specific patterns, market types, reasoning styles, or conditions led to correct calls. Be concrete — cite actual patterns from the picks above.",
  "loss_factors": "2-4 sentences describing what specific patterns, market types, reasoning styles, or conditions led to incorrect calls. Be concrete and honest about systematic mistakes.",
  "patterns": "3-5 bullet points of calibration guidance for future picks. Format as '- [Category/Platform/EdgeRange]: [specific adjustment to make]'. Focus on where win rates deviate most from expectations."
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  let extracted: { win_factors: string; loss_factors: string; patterns: string };
  try {
    extracted = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    console.error("Learn cron: failed to parse Claude response:", text.slice(0, 300));
    return NextResponse.json({ error: "Failed to parse Claude response" }, { status: 422 });
  }

  // Upsert into model_insights
  const { error: upsertErr } = await getSupabase()
    .from("model_insights")
    .upsert(
      {
        analysis_date: today,
        resolved_count: picks.length,
        calibration,
        patterns: String(extracted.patterns ?? "").trim(),
        win_factors: String(extracted.win_factors ?? "").trim(),
        loss_factors: String(extracted.loss_factors ?? "").trim(),
      },
      { onConflict: "analysis_date" }
    );

  if (upsertErr) {
    console.error("Learn cron: failed to save insights:", upsertErr);
    return NextResponse.json({ error: "Failed to save insights" }, { status: 500 });
  }

  console.log(`Learn cron: processed ${picks.length} picks, ${wins.length}W-${losses.length}L`);
  return NextResponse.json({
    success: true,
    date: today,
    resolved_count: picks.length,
    win_rate: calibration.overall.win_rate,
    calibration,
    patterns: extracted.patterns,
  });
}
