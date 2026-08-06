import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

const syncCooldowns = new Map<string, number>();

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Simple in-process cooldown — 60s between syncs per user
  const lastSync = syncCooldowns.get(userId) ?? 0;
  if (Date.now() - lastSync < 60_000) {
    return NextResponse.json({ error: "Please wait before syncing again" }, { status: 429 });
  }
  syncCooldowns.set(userId, Date.now());

  const stripe = getStripe();

  // Look up existing Supabase record for stripe_customer_id
  const { data: existing } = await getSupabase()
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  let customerId = existing?.stripe_customer_id as string | null | undefined;

  // If no customer on record, search Stripe by email
  if (!customerId) {
    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 5 });
      customerId = customers.data[0]?.id ?? null;
    }
  }

  if (!customerId) {
    return NextResponse.json({ synced: false, message: "No Stripe customer found for this account" });
  }

  // Only sync active or trialing subscriptions — never write a canceled status
  const subs = await stripe.subscriptions.list({ customer: customerId, limit: 10 });
  const activeSub = subs.data.find((s) =>
    s.status === "active" || s.status === "trialing"
  );

  if (!activeSub) {
    return NextResponse.json({ synced: false, message: "No active subscription found in Stripe" });
  }

  // Upsert to Supabase with correct userId
  const { error } = await getSupabase().from("subscriptions").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: activeSub.id,
    status: activeSub.status,
    trial_end: activeSub.trial_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) {
    console.error("Sync subscription upsert error:", error);
    return NextResponse.json({ error: "Failed to sync subscription" }, { status: 500 });
  }

  return NextResponse.json({ synced: true, status: activeSub.status });
}
