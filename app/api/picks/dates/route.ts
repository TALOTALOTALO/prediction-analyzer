import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabase()
    .from("daily_picks")
    .select("pick_date")
    .order("pick_date", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to fetch dates" }, { status: 500 });

  const dates = [...new Set((data ?? []).map((r) => r.pick_date as string))];

  return NextResponse.json({ dates });
}
