import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await getSupabase()
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const isAdmin = userId === process.env.ADMIN_USER_ID;
  if (!isActive && !isAdmin) {
    return NextResponse.json({ picks: [] });
  }

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data, error } = await getSupabase()
    .from("daily_picks")
    .select("id, pick_date, event, platform, grade, edge_score, implied_probability, true_odds, recommendation")
    .is("result", null)
    .in("grade", ["S", "A"])
    .eq("recommendation", "BUY")
    .gte("pick_date", sevenDaysAgo)
    .lt("pick_date", today)
    .order("pick_date", { ascending: false })
    .order("edge_score", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Open picks fetch error:", error);
    return NextResponse.json({ picks: [] });
  }

  return NextResponse.json({ picks: data ?? [] });
}
