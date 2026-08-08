import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET not set" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();

  let event: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const emailAddresses = event.data.email_addresses as Array<{ email_address: string; id: string }>;
    const primaryEmailId = event.data.primary_email_address_id as string;
    const primary = emailAddresses?.find((e) => e.id === primaryEmailId);
    const email = primary?.email_address;
    const firstName = (event.data.first_name as string) ?? undefined;

    if (email) {
      try {
        await resend.contacts.create({
          email: email.toLowerCase(),
          firstName,
          unsubscribed: false,
          properties: { user_type: "free_user" },
        });
      } catch {
        // Non-fatal
      }
    }
  }

  return NextResponse.json({ received: true });
}
