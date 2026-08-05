import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ active: false, status: "unauthenticated" });
  }

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status, trial_end")
    .eq("user_id", userId)
    .single();

  const active = data?.status === "active" || data?.status === "trialing";

  return NextResponse.json({
    active,
    status: data?.status ?? "none",
    trialEnd: data?.trial_end ?? null,
  });
}
