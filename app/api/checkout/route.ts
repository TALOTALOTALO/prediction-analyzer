import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL || !process.env.STRIPE_MONTHLY_PRICE_ID) {
    return NextResponse.json({ error: "Service configuration error" }, { status: 503 });
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
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });
    const email = user.emailAddresses[0]?.emailAddress;
    const stripe = getStripe();

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_MONTHLY_PRICE_ID!, quantity: 1 }],
      subscription_data: { metadata: { userId } },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/analyze?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/analyze`,
    };

    if (existing?.stripe_customer_id) {
      sessionParams.customer = existing.stripe_customer_id;
    } else if (email) {
      sessionParams.customer_email = email;
    }

    // Try with intro coupon first; fall back to base price if coupon is invalid
    if (process.env.STRIPE_INTRO_COUPON_ID) {
      try {
        const session = await stripe.checkout.sessions.create({
          ...sessionParams,
          discounts: [{ coupon: process.env.STRIPE_INTRO_COUPON_ID }],
        }, { idempotencyKey: `checkout-coupon-${userId}-${new Date().toISOString().slice(0, 10)}` });
        return NextResponse.json({ url: session.url });
      } catch (couponErr) {
        console.warn("Checkout with coupon failed, retrying without:", couponErr instanceof Error ? couponErr.message : couponErr);
        // Fall through to create session without coupon
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `checkout-${userId}-${new Date().toISOString().slice(0, 10)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
