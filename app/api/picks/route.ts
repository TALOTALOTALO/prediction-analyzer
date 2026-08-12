import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

const FREE_FIELDS = "id, pick_date, platform, event, position, odds, implied_probability, category, grade, recommendation, result, market_id";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date"); // YYYY-MM-DD or null

  const { data: sub } = await getSupabase()
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const isAdmin = userId === process.env.ADMIN_USER_ID;

  const isPro = isActive || isAdmin;

  // Resolve target date — use the param if provided, otherwise find most recent
  let targetDate = dateParam;
  if (!targetDate) {
    const { data: latest } = await getSupabase()
      .from("daily_picks")
      .select("pick_date")
      .order("pick_date", { ascending: false })
      .limit(1)
      .single();
    targetDate = (latest?.pick_date as string) ?? null;
  }

  const { data: rawData, error } = targetDate
    ? await getSupabase()
        .from("daily_picks")
        .select(isPro ? "*" : FREE_FIELDS)
        .eq("pick_date", targetDate)
        .order("edge_score", { ascending: false })
    : { data: null, error: null };

  if (error) {
    console.error("Picks fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });
  }

  const picks = (rawData as unknown) as Array<Record<string, unknown>> | null ?? [];

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

  // Fetch saved category preference for the filter UI
  const { data: prefs } = await getSupabase()
    .from("user_preferences")
    .select("category_filter")
    .eq("user_id", userId)
    .single();
  const savedCategoryFilter = (prefs?.category_filter as string[] | null) ?? null;

  return NextResponse.json({ picks, pickDate: targetDate, record, isAdmin, isFree: !isPro, savedCategoryFilter });
}
