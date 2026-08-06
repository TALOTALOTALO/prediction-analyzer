import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const FREE_FIELDS = "id, pick_date, platform, event, position, odds, implied_probability, category, grade, recommendation, result, market_id";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await getSupabase()
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const isAdmin = userId === process.env.ADMIN_USER_ID;

  const isPro = isActive || isAdmin;

  // Fetch most recent picks — full fields for subscribers/admin, limited for free users
  // Type-assert as Record array because the conditional select string breaks Supabase TS inference
  const { data: rawData, error } = await getSupabase()
    .from("daily_picks")
    .select(isPro ? "*" : FREE_FIELDS)
    .order("pick_date", { ascending: false })
    .order("edge_score", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Picks fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });
  }

  const data = (rawData as unknown) as Array<Record<string, unknown>> | null;
  const mostRecentDate = (data?.[0]?.pick_date as string) ?? null;
  const picks = mostRecentDate ? data!.filter((p) => p.pick_date === mostRecentDate) : [];

  // Win record — only for subscribers/admin (free users see it as a conversion hook)
  let record = null;
  if (isPro) {
    const { data: allResolved } = await getSupabase()
      .from("daily_picks")
      .select("result")
      .not("result", "is", null);

    const resolved = allResolved ?? [];
    const wins = resolved.filter((p) => p.result === "won").length;
    const losses = resolved.filter((p) => p.result === "lost").length;
    const voids = resolved.filter((p) => p.result === "void").length;
    const total = wins + losses;
    record = { wins, losses, voids, winRate: total > 0 ? Math.round((wins / total) * 100) : null, total };
  }

  return NextResponse.json({ picks, pickDate: mostRecentDate, record, isAdmin, isFree: !isPro });
}
