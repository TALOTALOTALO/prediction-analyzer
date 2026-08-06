import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check subscription
  const { data: sub } = await getSupabase()
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  if (!isActive) return NextResponse.json({ error: "Subscription required" }, { status: 403 });

  const isAdmin = userId === process.env.ADMIN_USER_ID;

  // Fetch most recent pick date's picks
  const { data, error } = await getSupabase()
    .from("daily_picks")
    .select("*")
    .order("pick_date", { ascending: false })
    .order("edge_score", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Picks fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });
  }

  const mostRecentDate = data?.[0]?.pick_date ?? null;
  const picks = mostRecentDate
    ? data.filter((p) => p.pick_date === mostRecentDate)
    : [];

  // Compute all-time record from every pick that has a result
  const { data: allResolved } = await getSupabase()
    .from("daily_picks")
    .select("result")
    .not("result", "is", null);

  const wins = allResolved?.filter((p) => p.result === "won").length ?? 0;
  const losses = allResolved?.filter((p) => p.result === "lost").length ?? 0;
  const voids = allResolved?.filter((p) => p.result === "void").length ?? 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

  const record = { wins, losses, voids, winRate, total };

  return NextResponse.json({ picks, pickDate: mostRecentDate, record, isAdmin });
}
