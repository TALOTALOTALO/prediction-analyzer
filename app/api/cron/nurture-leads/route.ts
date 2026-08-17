import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { getSupabase } from "@/lib/supabase";
import LeadDay3Email from "@/emails/LeadDay3Email";
import LeadDay7Email from "@/emails/LeadDay7Email";
import MissionEmail from "@/emails/MissionEmail";
import AnalyzerPitchEmail from "@/emails/AnalyzerPitchEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();

  // Day 1 window: leads created 20–48h ago
  const day1Min = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const day1Max = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();

  // Day 3 window: leads created 3–4 days ago
  const day3Min = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const day3Max = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Day 5 window: leads created 5–6 days ago
  const day5Min = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const day5Max = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

  // Day 7 window: leads created 7–8 days ago
  const day7Min = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const day7Max = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: day1Leads },
    { data: day3Leads },
    { data: day5Leads },
    { data: day7Leads },
  ] = await Promise.all([
    supabase
      .from("email_leads")
      .select("id, email")
      .is("day1_sent_at", null)
      .gte("created_at", day1Min)
      .lt("created_at", day1Max),
    supabase
      .from("email_leads")
      .select("id, email, pick_date_sent")
      .is("day3_sent_at", null)
      .gte("created_at", day3Min)
      .lt("created_at", day3Max),
    supabase
      .from("email_leads")
      .select("id, email")
      .is("day5_sent_at", null)
      .gte("created_at", day5Min)
      .lt("created_at", day5Max),
    supabase
      .from("email_leads")
      .select("id, email, pick_date_sent")
      .is("day7_sent_at", null)
      .gte("created_at", day7Min)
      .lt("created_at", day7Max),
  ]);

  let day1Sent = 0;
  let day3Sent = 0;
  let day5Sent = 0;
  let day7Sent = 0;

  // ── Day 1: Mission story ──────────────────────────────────────────────────
  for (const lead of day1Leads ?? []) {
    try {
      const html = await render(MissionEmail({}));

      await resend.emails.send({
        from: "FadeMe.ai <picks@fademe.ai>",
        to: lead.email as string,
        subject: "Prediction markets were built to take your money. Here's the receipts.",
        html,
      });

      await supabase
        .from("email_leads")
        .update({ day1_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      day1Sent++;
    } catch (err) {
      console.error(`Day 1 send failed for ${lead.email}:`, err);
    }
  }

  // ── Day 3: Pick results update ────────────────────────────────────────────
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
        subject: "Update on the picks we sent you",
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

  // ── Day 5: AI Analyzer pitch ──────────────────────────────────────────────
  // Fetch week record + today's top picks once, reuse across all day5 leads
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const [{ data: weekPicks5 }, { data: todayPicks }] = await Promise.all([
    supabase.from("daily_picks").select("result").gte("pick_date", weekStart).not("result", "is", null),
    supabase.from("daily_picks").select("event, platform, grade, recommendation").eq("pick_date", todayStr).order("edge_score", { ascending: false }).limit(3),
  ]);

  const wins5 = (weekPicks5 ?? []).filter((p) => p.result === "won").length;
  const losses5 = (weekPicks5 ?? []).filter((p) => p.result === "lost").length;
  const total5 = wins5 + losses5;
  const winRate5 = total5 > 0 ? Math.round((wins5 / total5) * 100) : null;

  for (const lead of day5Leads ?? []) {
    try {
      const html = await render(
        AnalyzerPitchEmail({
          picks: (todayPicks ?? []) as Parameters<typeof AnalyzerPitchEmail>[0]["picks"],
          wins: wins5,
          losses: losses5,
          winRate: winRate5,
        })
      );

      await resend.emails.send({
        from: "FadeMe.ai <picks@fademe.ai>",
        to: lead.email as string,
        subject: "Snap a photo of any bet. Get an AI grade in 10 seconds.",
        html,
      });

      await supabase
        .from("email_leads")
        .update({ day5_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      day5Sent++;
    } catch (err) {
      console.error(`Day 5 send failed for ${lead.email}:`, err);
    }
  }

  // ── Day 7: Final W-L record ───────────────────────────────────────────────
  const { data: weekPicks7 } = await supabase
    .from("daily_picks")
    .select("result")
    .gte("pick_date", weekStart)
    .not("result", "is", null);

  const wins7 = (weekPicks7 ?? []).filter((p) => p.result === "won").length;
  const losses7 = (weekPicks7 ?? []).filter((p) => p.result === "lost").length;
  const total7 = wins7 + losses7;
  const winRate7 = total7 > 0 ? Math.round((wins7 / total7) * 100) : null;

  for (const lead of day7Leads ?? []) {
    try {
      const html = await render(LeadDay7Email({ wins: wins7, losses: losses7, winRate: winRate7 }));

      await resend.emails.send({
        from: "FadeMe.ai <picks@fademe.ai>",
        to: lead.email as string,
        subject: "Last one from us — honest numbers inside",
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

  return NextResponse.json({ day1Sent, day3Sent, day5Sent, day7Sent });
}
