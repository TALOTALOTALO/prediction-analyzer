import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import FreeUserNurtureEmail from "@/emails/FreeUserNurtureEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();

  // Claims from 20–30 hours ago — wide enough window for a daily cron to reliably catch
  const windowStart = new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();

  const { data: claims } = await supabase
    .from("free_analysis_claims")
    .select("user_id, created_at")
    .gte("created_at", windowStart)
    .lte("created_at", windowEnd);

  if (!claims || claims.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const userIds = claims.map((c) => c.user_id as string);

  // Filter out users who already have active subscriptions or already received this email
  const [{ data: activeSubs }, { data: alreadySent }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("user_id")
      .in("user_id", userIds)
      .in("status", ["active", "trialing"]),
    supabase
      .from("nurture_log")
      .select("user_id")
      .in("user_id", userIds)
      .eq("type", "free_user_24hr"),
  ]);

  const skipIds = new Set([
    ...(activeSubs ?? []).map((s) => s.user_id as string),
    ...(alreadySent ?? []).map((s) => s.user_id as string),
  ]);

  const eligible = claims.filter((c) => !skipIds.has(c.user_id as string));
  if (eligible.length === 0) return NextResponse.json({ sent: 0 });

  // Get today's top picks (fall back to most recent batch)
  const todayStr = now.toISOString().split("T")[0];
  let { data: picks } = await supabase
    .from("daily_picks")
    .select("event, platform, grade, recommendation")
    .eq("pick_date", todayStr)
    .order("edge_score", { ascending: false })
    .limit(3);

  if (!picks || picks.length === 0) {
    const { data: recent } = await supabase
      .from("daily_picks")
      .select("event, platform, grade, recommendation")
      .order("pick_date", { ascending: false })
      .order("edge_score", { ascending: false })
      .limit(3);
    picks = recent ?? [];
  }

  if (picks.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no picks available" });
  }

  const clerk = await clerkClient();
  let sent = 0;

  for (const claim of eligible) {
    try {
      const user = await clerk.users.getUser(claim.user_id as string);
      const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
      if (!email) continue;

      const firstName = user.firstName ?? undefined;

      // Get their most recent analysis grade
      const { data: analysis } = await supabase
        .from("analyses")
        .select("grade")
        .eq("user_id", claim.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const html = await render(
        FreeUserNurtureEmail({
          picks: picks as Parameters<typeof FreeUserNurtureEmail>[0]["picks"],
          analysisGrade: analysis?.grade ?? undefined,
          firstName,
        })
      );

      await resend.emails.send({
        from: "FadeMe.ai <picks@fademe.ai>",
        to: email,
        subject: "You left some edge on the table",
        html,
      });

      await supabase.from("nurture_log").insert({
        user_id: claim.user_id,
        type: "free_user_24hr",
        sent_at: new Date().toISOString(),
      });

      sent++;
    } catch (err) {
      console.error(`Nurture send failed for user ${claim.user_id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
