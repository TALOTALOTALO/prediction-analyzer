import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Get their active/trialing subscriptions from Stripe
  const subs = await stripe.subscriptions.list({ customer: customerId, limit: 5 });
  const activeSub = subs.data.find((s) =>
    s.status === "active" || s.status === "trialing"
  ) ?? subs.data[0];

  if (!activeSub) {
    return NextResponse.json({ synced: false, message: "No Stripe subscription found" });
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
