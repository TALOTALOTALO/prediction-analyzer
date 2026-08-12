import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();

  // Only picks with market_id so every result can be independently verified
  // on Kalshi or Polymarket by anyone
  const [resolvedRes, oldestRes, pendingRes] = await Promise.all([
    supabase
      .from("daily_picks")
      .select(
        "id, pick_date, platform, event, position, recommendation, grade, grade_label, edge_score, true_odds, result, odds, implied_probability, market_id, summary, bull_case, bear_case, key_risks, market_inefficiency, recommendation_reason, confidence_level"
      )
      .not("result", "is", null)
      .not("market_id", "is", null)
      .order("pick_date", { ascending: false }),
    supabase
      .from("daily_picks")
      .select("pick_date")
      .not("market_id", "is", null)
      .order("pick_date", { ascending: true })
      .limit(1),
    supabase
      .from("daily_picks")
      .select("id, pick_date, platform, event, position, recommendation, grade, odds, implied_probability, market_id")
      .is("result", null)
      .not("market_id", "is", null)
      .order("pick_date", { ascending: false }),
  ]);

  if (resolvedRes.error) {
    console.error("Record fetch error:", resolvedRes.error);
    return NextResponse.json({ error: "Failed to fetch record" }, { status: 500 });
  }

  const picks = resolvedRes.data ?? [];
  const wins = picks.filter((p) => p.result === "won").length;
  const losses = picks.filter((p) => p.result === "lost").length;
  const voids = picks.filter((p) => p.result === "void").length;
  const total = wins + losses;

  const trackingSince = (oldestRes.data?.[0]?.pick_date as string) ?? null;

  return NextResponse.json({
    record: {
      wins,
      losses,
      voids,
      winRate: total > 0 ? Math.round((wins / total) * 100) : null,
      total,
    },
    picks,
    trackingSince,
    pendingPicks: pendingRes.data ?? [],
    pendingCount: pendingRes.data?.length ?? 0,
  });
}
