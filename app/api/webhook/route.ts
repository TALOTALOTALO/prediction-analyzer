import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

async function syncResendContact(userId: string, userType: "subscriber" | "churned") {
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
    if (!email) return;
    await resend.contacts.create({
      email: email.toLowerCase(),
      firstName: user.firstName ?? undefined,
      unsubscribed: false,
      properties: { user_type: userType },
    });
  } catch {
    // Non-fatal
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const { error: upsertErr } = await getSupabase().from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          status: sub.status,
          trial_end: sub.trial_end,
          updated_at: new Date().toISOString(),
        });
        if (upsertErr) throw new Error(`Subscription upsert failed: ${upsertErr.message}`);

        if (sub.status === "active" || sub.status === "trialing") {
          await syncResendContact(userId, "subscriber");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const { error: cancelErr } = await getSupabase()
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (cancelErr) throw new Error(`Subscription cancel failed: ${cancelErr.message}`);

        await syncResendContact(userId, "churned");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
        const subId = invoice.subscription ?? null;
        if (!subId) break;

        const { error: pastDueErr } = await getSupabase()
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subId);
        if (pastDueErr) throw new Error(`Past due update failed: ${pastDueErr.message}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
