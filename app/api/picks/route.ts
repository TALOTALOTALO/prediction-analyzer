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

  // Return only the most recent date's picks
  const mostRecentDate = data?.[0]?.pick_date ?? null;
  const picks = mostRecentDate
    ? data.filter((p) => p.pick_date === mostRecentDate)
    : [];

  return NextResponse.json({ picks, pickDate: mostRecentDate });
}
