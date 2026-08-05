import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for existing active subscription — don't create duplicate checkouts
  const { data: existing } = await getSupabase()
    .from("subscriptions")
    .select("status, stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (existing?.status === "active" || existing?.status === "trialing") {
    return NextResponse.json({ error: "Already subscribed" }, { status: 409 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  const stripe = getStripe();

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "subscription",
    line_items: [
      { price: process.env.STRIPE_MONTHLY_PRICE_ID!, quantity: 1 },
    ],
    subscription_data: {
      metadata: { userId },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/analyze?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/analyze`,
  };

  // Apply $1 intro coupon if configured
  if (process.env.STRIPE_INTRO_COUPON_ID) {
    sessionParams.discounts = [{ coupon: process.env.STRIPE_INTRO_COUPON_ID }];
  }

  // Reuse existing Stripe customer if we have one
  if (existing?.stripe_customer_id) {
    sessionParams.customer = existing.stripe_customer_id;
  } else if (email) {
    sessionParams.customer_email = email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return NextResponse.json({ url: session.url });
}
