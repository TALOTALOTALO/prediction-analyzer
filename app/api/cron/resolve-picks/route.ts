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
    .from("daily_picks")
    .select("id, platform, market_id, position, recommendation, event")
    .is("result", null)
    .not("market_id", "is", null);

  if (error) {
    console.error("Resolve picks fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: "No pending picks", resolved: 0 });
  }

  let resolved = 0;

  await Promise.allSettled(
    pending.map(async (pick) => {
      const marketId = pick.market_id as string;
      const platform = pick.platform as string;

      let marketResult: "yes" | "no" | null = null;
      if (platform === "Kalshi") {
        marketResult = await checkKalshiResult(marketId);
      } else if (platform === "Polymarket") {
        marketResult = await checkPolymarketResult(marketId, pick.event as string | undefined);
      }
      if (!marketResult) return;

      const result = determineResult(
        (pick.recommendation as string) ?? "",
        (pick.position as string) ?? "",
        marketResult
      );
      if (!result) return;

      const { error: updateErr } = await getSupabase()
        .from("daily_picks")
        .update({ result })
        .eq("id", pick.id);

      if (updateErr) {
        console.error(`Failed to resolve pick ${pick.id}:`, updateErr);
      } else {
        resolved++;
      }
    })
  );

  return NextResponse.json({ message: "Resolution complete", resolved, checked: pending.length });
}
