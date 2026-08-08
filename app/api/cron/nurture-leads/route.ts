import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { getSupabase } from "@/lib/supabase";
import LeadDay3Email from "@/emails/LeadDay3Email";
import LeadDay7Email from "@/emails/LeadDay7Email";

const resend = new Resend(process.env.RESEND_API_KEY);

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();

  // Day 3 window: leads created 3–4 days ago that haven't received day 3 email
  const day3Min = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const day3Max = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Day 7 window: leads created 7–8 days ago that haven't received day 7 email
  const day7Min = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const day7Max = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: day3Leads }, { data: day7Leads }] = await Promise.all([
    supabase
      .from("email_leads")
      .select("id, email, pick_date_sent")
      .is("day3_sent_at", null)
      .gte("created_at", day3Min)
      .lt("created_at", day3Max),
    supabase
      .from("email_leads")
      .select("id, email, pick_date_sent")
      .is("day7_sent_at", null)
      .gte("created_at", day7Min)
      .lt("created_at", day7Max),
  ]);

  let day3Sent = 0;
  let day7Sent = 0;

  // Day 3: show the picks we originally sent and their current results
  for (const lead of day3Leads ?? []) {
    try {
      const { data: picks } = await supabase
        .from("daily_picks")
        .select("event, platform, recommendation, result")
        .eq("pick_date", lead.pick_date_sent)
        .order("edge_score", { ascending: false })
        .limit(4);

      if (!picks || picks.length === 0) continue;

      const dateLabel = new Date((lead.pick_date_sent as string) + "T12:00:00").toLocaleDateString("en-US", {
        month: "long", day: "numeric",
      });

      const html = await render(
        LeadDay3Email({
          picks: picks as Parameters<typeof LeadDay3Email>[0]["picks"],
          dateLabel,
        })
      );

      await resend.emails.send({
        from: "FadeMe.ai <picks@fademe.ai>",
        to: lead.email as string,
        subject: `Update on the picks we sent you`,
        html,
      });

      await supabase
        .from("email_leads")
        .update({ day3_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      day3Sent++;
    } catch (err) {
      console.error(`Day 3 send failed for ${lead.email}:`, err);
    }
  }

  // Day 7: show this week's overall AI record
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: weekPicks } = await supabase
    .from("daily_picks")
    .select("result")
    .gte("pick_date", weekStart)
    .not("result", "is", null);

  const wins = (weekPicks ?? []).filter((p) => p.result === "won").length;
  const losses = (weekPicks ?? []).filter((p) => p.result === "lost").length;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

  for (const lead of day7Leads ?? []) {
    try {
      const html = await render(LeadDay7Email({ wins, losses, winRate }));

      await resend.emails.send({
        from: "FadeMe.ai <picks@fademe.ai>",
        to: lead.email as string,
        subject: `Last one from us — honest numbers inside`,
        html,
      });

      await supabase
        .from("email_leads")
        .update({ day7_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      day7Sent++;
    } catch (err) {
      console.error(`Day 7 send failed for ${lead.email}:`, err);
    }
  }

  return NextResponse.json({ day3Sent, day7Sent });
}
