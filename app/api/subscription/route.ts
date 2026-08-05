import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ active: false }, { status: 401 });
  }

  try {
    const { data, error: dbError } = await getSupabase()
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", userId)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      console.error("Supabase error in subscription check:", dbError);
      return NextResponse.json({ active: false }, { status: 503 });
    }

    const active = data?.status === "active" || data?.status === "trialing";
    return NextResponse.json({ active, trialEnd: data?.trial_end ?? null });
  } catch (err) {
    console.error("Subscription check error:", err);
    return NextResponse.json({ active: false }, { status: 503 });
  }
}
