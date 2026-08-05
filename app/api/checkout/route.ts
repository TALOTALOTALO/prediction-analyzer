import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: existing, error: dbError } = await getSupabase()
      .from("subscriptions")
      .select("status, stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      console.error("Supabase error in checkout:", dbError);
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    if (existing?.status === "active" || existing?.status === "trialing") {
      return NextResponse.json({ error: "Already subscribed" }, { status: 409 });
    }

    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;
    const stripe = getStripe();

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_MONTHLY_PRICE_ID!, quantity: 1 }],
      subscription_data: { metadata: { userId } },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/analyze?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/analyze`,
    };

    if (process.env.STRIPE_INTRO_COUPON_ID) {
      sessionParams.discounts = [{ coupon: process.env.STRIPE_INTRO_COUPON_ID }];
    }

    if (existing?.stripe_customer_id) {
      sessionParams.customer = existing.stripe_customer_id;
    } else if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `checkout-${userId}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
