import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const STARTING_BALANCE = 1000;
const VALID_STAKES = [10, 25, 50, 100];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trades, error } = await getSupabase()
    .from("paper_trades")
    .select(`*, daily_picks(event, platform, position, odds, grade, recommendation, pick_date)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Paper trades fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }

  const resolved = (trades ?? []).filter((t) => t.result !== null);
  const wins = resolved.filter((t) => t.result === "won").length;
  const losses = resolved.filter((t) => t.result === "lost").length;
  const pending = (trades ?? []).filter((t) => t.result === null).length;
  const totalStaked = (trades ?? []).reduce((sum, t) => sum + Number(t.virtual_stake), 0);
  const totalReturned = resolved.reduce((sum, t) => sum + Number(t.virtual_payout ?? 0), 0);
  const balance = STARTING_BALANCE - totalStaked + totalReturned;
  const pnl = balance - STARTING_BALANCE;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;

  return NextResponse.json({
    trades: trades ?? [],
    portfolio: { balance, pnl, wins, losses, pending, winRate, totalStaked, startingBalance: STARTING_BALANCE },
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pick_id, virtual_stake } = body as { pick_id: string; virtual_stake: number };

  if (!pick_id) return NextResponse.json({ error: "pick_id required" }, { status: 400 });
  if (!VALID_STAKES.includes(virtual_stake)) {
    return NextResponse.json({ error: "Invalid stake amount" }, { status: 400 });
  }

  // Prevent duplicate paper trades on the same pick
  const { data: existing } = await getSupabase()
    .from("paper_trades")
    .select("id")
    .eq("user_id", userId)
    .eq("pick_id", pick_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You already have a paper trade on this pick" }, { status: 409 });
  }

  // Fetch the pick to get entry price and position
  const { data: pick, error: pickErr } = await getSupabase()
    .from("daily_picks")
    .select("position, implied_probability, platform, market_id, result")
    .eq("id", pick_id)
    .single();

  if (pickErr || !pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  // Don't allow paper trading on already-resolved picks
  if (pick.result !== null) {
    return NextResponse.json({ error: "This pick has already resolved" }, { status: 400 });
  }

  const entryPrice = pick.position === "NO"
    ? 100 - (pick.implied_probability ?? 50)
    : (pick.implied_probability ?? 50);

  const { data: trade, error: insertErr } = await getSupabase()
    .from("paper_trades")
    .insert({
      user_id: userId,
      pick_id,
      virtual_stake,
      position: pick.position,
      entry_price: entryPrice,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("Paper trade insert error:", insertErr);
    return NextResponse.json({ error: "Failed to place trade" }, { status: 500 });
  }

  return NextResponse.json({ trade });
}
