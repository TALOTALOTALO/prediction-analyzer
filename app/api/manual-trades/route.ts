import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const STARTING_BALANCE = 10000;

function calcPnl(trades: Record<string, unknown>[]): number {
  return trades
    .filter((t) => t.result !== null)
    .reduce((sum, t) => {
      const stake = Number(t.stake);
      const price = Number(t.entry_price);
      if (t.result === "won") return sum + stake * (100 - price) / price;
      if (t.result === "lost") return sum - stake;
      return sum; // void
    }, 0);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trades, error } = await getSupabase()
    .from("manual_trades")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("manual_trades fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }

  const t = trades ?? [];
  const resolved = t.filter((tr) => tr.result !== null);
  const pnl = calcPnl(t);

  return NextResponse.json({
    trades: t,
    portfolio: {
      balance: STARTING_BALANCE + pnl,
      pnl,
      startingBalance: STARTING_BALANCE,
      wins: resolved.filter((tr) => tr.result === "won").length,
      losses: resolved.filter((tr) => tr.result === "lost").length,
      pending: t.filter((tr) => tr.result === null).length,
      winRate: resolved.filter((tr) => tr.result !== "void").length > 0
        ? Math.round(
            resolved.filter((tr) => tr.result === "won").length /
            resolved.filter((tr) => tr.result !== "void").length * 100
          )
        : null,
    },
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const { market, platform, position, entry_price, stake, notes } = body;

  if (!market || typeof market !== "string" || !market.trim()) {
    return NextResponse.json({ error: "Market name is required" }, { status: 400 });
  }
  if (!position || typeof position !== "string" || !position.trim()) {
    return NextResponse.json({ error: "Position is required" }, { status: 400 });
  }

  const price = parseFloat(String(entry_price));
  if (isNaN(price) || price <= 0 || price >= 100) {
    return NextResponse.json({ error: "Entry price must be between 1 and 99" }, { status: 400 });
  }

  const amount = parseFloat(String(stake));
  if (isNaN(amount) || amount <= 0 || amount > 100000) {
    return NextResponse.json({ error: "Stake must be a positive number" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("manual_trades")
    .insert({
      user_id: userId,
      market: market.trim(),
      platform: typeof platform === "string" && platform.trim() ? platform.trim() : null,
      position: position.trim(),
      entry_price: price,
      stake: amount,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    })
    .select()
    .single();

  if (error) {
    console.error("manual_trades insert error:", error);
    return NextResponse.json({ error: "Failed to create trade" }, { status: 500 });
  }

  return NextResponse.json({ trade: data });
}
