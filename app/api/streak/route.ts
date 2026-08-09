import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dateSet = new Set(dates);
  let streak = 0;
  const cursor = new Date(today);

  // Allow today or yesterday as the starting point (so streak doesn't break mid-day)
  const todayStr = cursor.toISOString().split("T")[0];
  const yesterdayStr = new Date(cursor.getTime() - 86400000).toISOString().split("T")[0];
  if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) return 0;

  // If only yesterday qualifies, start walking from there
  if (!dateSet.has(todayStr)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Walk backward from the qualifying start date
  while (dateSet.has(cursor.toISOString().split("T")[0])) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();

  const [{ data: checkins }, { data: analyses }] = await Promise.all([
    supabase
      .from("daily_checkins")
      .select("checkin_date")
      .eq("user_id", userId),
    supabase
      .from("analyses")
      .select("created_at")
      .eq("user_id", userId),
  ]);

  const dates = new Set<string>();
  for (const row of checkins ?? []) dates.add(row.checkin_date as string);
  for (const row of analyses ?? []) {
    const d = (row.created_at as string).split("T")[0];
    dates.add(d);
  }

  const streak = calcStreak([...dates]);
  return NextResponse.json({ streak });
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  await getSupabase()
    .from("daily_checkins")
    .upsert({ user_id: userId, checkin_date: today }, { onConflict: "user_id,checkin_date" });

  return NextResponse.json({ ok: true });
}
