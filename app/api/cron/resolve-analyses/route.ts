import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { checkKalshiResult, checkPolymarketResult, determineResult } from "@/lib/resolution";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pending, error } = await getSupabase()
    .from("analyses")
    .select("id, platform, market_id, position, recommendation, event")
    .is("outcome", null)
    .not("market_id", "is", null);

  if (error) {
    console.error("Resolve analyses fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: "No pending analyses", resolved: 0 });
  }

  let resolved = 0;

  await Promise.allSettled(
    pending.map(async (analysis) => {
      const marketId = analysis.market_id as string;
      const platform = analysis.platform as string;

      let marketResult: "yes" | "no" | null = null;
      if (platform === "Kalshi") {
        marketResult = await checkKalshiResult(marketId);
      } else if (platform === "Polymarket") {
        marketResult = await checkPolymarketResult(marketId, analysis.event as string | undefined);
      }
      if (!marketResult) return;

      const result = determineResult(
        (analysis.recommendation as string) ?? "",
        (analysis.position as string) ?? "",
        marketResult
      );
      if (!result) return;

      const outcome: "correct" | "incorrect" = result === "won" ? "correct" : "incorrect";

      const { error: updateErr } = await getSupabase()
        .from("analyses")
        .update({ outcome })
        .eq("id", analysis.id);

      if (updateErr) {
        console.error(`Failed to resolve analysis ${analysis.id}:`, updateErr);
      } else {
        resolved++;
      }
    })
  );

  return NextResponse.json({ message: "Resolution complete", resolved, checked: pending.length });
}
