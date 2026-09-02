import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { checkKalshiResult, checkPolymarketResult, calculatePayout } from "@/lib/resolution";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve paper trades
  const { data: pending, error } = await getSupabase()
    .from("paper_trades")
    .select("id, virtual_stake, position, entry_price, daily_picks(platform, market_id, event)")
    .is("result", null);

  if (error) {
    console.error("Resolve trades fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch pending trades" }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: "No pending paper trades", resolved: 0 });
  }

  let resolved = 0;

  await Promise.allSettled(
    pending.map(async (trade) => {
      const pickRaw = trade.daily_picks;
      const pick = (Array.isArray(pickRaw) ? pickRaw[0] ?? null : pickRaw) as { platform: string; market_id: string | null; event?: string | null } | null;
      if (!pick?.market_id) return;

      let marketResult: "yes" | "no" | null = null;
      if (pick.platform === "Kalshi") {
        marketResult = await checkKalshiResult(pick.market_id);
      } else if (pick.platform === "Polymarket") {
        marketResult = await checkPolymarketResult(pick.market_id, pick.event ?? undefined);
      }
      if (!marketResult) return;

      const tradeWon =
        (trade.position === "YES" && marketResult === "yes") ||
        (trade.position === "NO" && marketResult === "no");

      const tradeResult: "won" | "lost" = tradeWon ? "won" : "lost";
      const virtualPayout = calculatePayout(Number(trade.virtual_stake), Number(trade.entry_price), tradeResult);

      const { error: updateErr } = await getSupabase()
        .from("paper_trades")
        .update({ result: tradeResult, virtual_payout: virtualPayout })
        .eq("id", trade.id);

      if (updateErr) {
        console.error(`Failed to resolve trade ${trade.id}:`, updateErr);
      } else {
        resolved++;
      }
    })
  );

  // Resolve manual trades that have a market_id
  const { data: manualPending, error: manualErr } = await getSupabase()
    .from("manual_trades")
    .select("id, platform, market_id, position, market")
    .is("result", null)
    .not("market_id", "is", null);

  if (manualErr) {
    console.error("Resolve manual trades fetch error:", manualErr);
  }

  let manualResolved = 0;
  if (manualPending && manualPending.length > 0) {
    await Promise.allSettled(
      manualPending.map(async (trade) => {
        const marketId = trade.market_id as string;
        const platform = trade.platform as string;

        let marketResult: "yes" | "no" | null = null;
        if (platform === "Kalshi") {
          marketResult = await checkKalshiResult(marketId);
        } else if (platform === "Polymarket") {
          marketResult = await checkPolymarketResult(marketId, trade.market as string | undefined);
        }
        if (!marketResult) return;

        const tradeWon =
          (trade.position === "YES" && marketResult === "yes") ||
          (trade.position === "NO" && marketResult === "no");

        const tradeResult: "won" | "lost" = tradeWon ? "won" : "lost";

        const { error: updateErr } = await getSupabase()
          .from("manual_trades")
          .update({ result: tradeResult })
          .eq("id", trade.id);

        if (updateErr) {
          console.error(`Failed to resolve manual trade ${trade.id}:`, updateErr);
        } else {
          manualResolved++;
        }
      })
    );
  }

  return NextResponse.json({
    message: "Resolution complete",
    resolved,
    checked: pending.length,
    manualResolved,
    manualChecked: manualPending?.length ?? 0,
  });
}
