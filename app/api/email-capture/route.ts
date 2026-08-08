import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { getSupabase } from "@/lib/supabase";
import FreePicksEmail from "@/emails/FreePicksEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Add to Resend contacts and persist to email_leads for nurture sequence
  try {
    await resend.contacts.create({ email: normalizedEmail, unsubscribed: false });
  } catch {
    // Non-fatal
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // Upsert into email_leads — on conflict (same email) do nothing so day3/day7 timestamps aren't reset
  const { error: leadErr } = await getSupabase()
    .from("email_leads")
    .upsert({ email: normalizedEmail, pick_date_sent: todayStr }, { onConflict: "email", ignoreDuplicates: true });
  if (leadErr) console.error("Failed to persist email lead:", leadErr.message);

  // Fetch the most recent picks (today's if available, otherwise latest batch)
  let { data: picks } = await getSupabase()
    .from("daily_picks")
    .select("platform, event, position, odds, implied_probability, grade, recommendation, recommendation_reason, pick_date")
    .eq("pick_date", todayStr)
    .order("edge_score", { ascending: false })
    .limit(4);

  // Fall back to most recent batch if no picks today
  if (!picks || picks.length === 0) {
    const { data: recent } = await getSupabase()
      .from("daily_picks")
      .select("platform, event, position, odds, implied_probability, grade, recommendation, recommendation_reason, pick_date")
      .order("pick_date", { ascending: false })
      .order("edge_score", { ascending: false })
      .limit(4);
    picks = recent ?? [];
  }

  if (picks.length === 0) {
    return NextResponse.json({ error: "No picks available yet — try again tomorrow" }, { status: 503 });
  }

  const pickDate = picks[0].pick_date as string;
  const dateLabel = new Date(pickDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  try {
    const html = await render(FreePicksEmail({ picks: picks as Parameters<typeof FreePicksEmail>[0]["picks"], dateLabel }));
    await resend.emails.send({
      from: "FadeMe.ai <picks@fademe.ai>",
      to: normalizedEmail,
      subject: `Your free AI picks for ${dateLabel}`,
      html,
    });
  } catch (err) {
    console.error("Failed to send free picks email:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
