import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 60;

const GRADE_EMOJI: Record<string, string> = {
  S: "🔥", A: "✅", B: "📊", C: "⚠️", D: "📉", F: "❌",
};
const REC_EMOJI: Record<string, string> = {
  BUY: "🟢", HOLD: "🟡", FADE: "🔴",
};

function trunc(str: string, max: number): string {
  if (!str) return "";
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function buildPickTweet(pick: Record<string, unknown>): string {
  const grade = String(pick.grade ?? "");
  const gradeEmoji = GRADE_EMOJI[grade] ?? "📊";
  const platform = String(pick.platform ?? "");
  const event = trunc(String(pick.event ?? ""), 80);
  const rec = String(pick.recommendation ?? "");
  const recEmoji = REC_EMOJI[rec] ?? "";
  const edge = Number(pick.edge_score ?? 0);
  const implied = Number(pick.implied_probability ?? 0);
  const trueOdds = Number(pick.true_odds ?? 0);
  const reason = trunc(String(pick.recommendation_reason ?? ""), 130);

  return [
    `${gradeEmoji} ${grade} — ${platform}`,
    "",
    event,
    `${recEmoji} ${rec} | +${edge.toFixed(1)}% edge`,
    `${implied.toFixed(0)}% → ${trueOdds.toFixed(0)}% true odds`,
    "",
    reason,
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missingCreds = [
    "TWITTER_API_KEY",
    "TWITTER_API_SECRET",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_TOKEN_SECRET",
  ].filter((k) => !process.env[k]);

  if (missingCreds.length > 0) {
    return NextResponse.json(
      { error: `Missing Twitter credentials: ${missingCreds.join(", ")}` },
      { status: 503 }
    );
  }

  const today = new Date().toISOString().split("T")[0];

  // Idempotency: skip if already posted today
  const { data: existing } = await getSupabase()
    .from("twitter_posts")
    .select("tweet_id")
    .eq("post_date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: "Already posted today", date: today, tweetId: existing.tweet_id });
  }

  // Fetch today's top picks — S and A grades only, max 3
  const { data: picks, error } = await getSupabase()
    .from("daily_picks")
    .select("*")
    .eq("pick_date", today)
    .in("grade", ["S", "A"])
    .order("edge_score", { ascending: false })
    .limit(3);

  if (error || !picks || picks.length === 0) {
    return NextResponse.json({ error: "No S/A grade picks found for today" }, { status: 404 });
  }

  const twitter = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
  });

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const bestGrade = picks[0].grade as string;
  const bestEdge = Number(picks[0].edge_score ?? 0);

  const hookTweet = [
    `🎯 FadeMe AI Picks — ${dateLabel}`,
    "",
    `${picks.length} high-conviction play${picks.length === 1 ? "" : "s"} today.`,
    `Best edge: +${bestEdge.toFixed(1)}% | Top grade: ${bestGrade}`,
    "",
    "Full breakdown 🧵👇",
  ].join("\n");

  try {
    // Post the hook tweet
    const hook = await twitter.v2.tweet(hookTweet);
    let lastId = hook.data.id;

    // Post one tweet per pick, each replying to the previous
    for (const pick of picks) {
      const text = buildPickTweet(pick as Record<string, unknown>);
      const reply = await twitter.v2.tweet(text, {
        reply: { in_reply_to_tweet_id: lastId },
      });
      lastId = reply.data.id;
    }

    // Closing CTA tweet
    const ctaTweet = [
      "Full analysis, Kelly sizing + track record 👇",
      "fademe.ai/picks",
      "",
      "Every pick logged publicly — wins AND losses. We don't hide.",
      "",
      "#PredictionMarkets #Kalshi #Polymarket #SportsBetting",
    ].join("\n");

    await twitter.v2.tweet(ctaTweet, {
      reply: { in_reply_to_tweet_id: lastId },
    });

    // Record that we posted today
    await getSupabase()
      .from("twitter_posts")
      .insert({ post_date: today, tweet_id: hook.data.id, pick_count: picks.length });

    return NextResponse.json({
      success: true,
      date: today,
      threadId: hook.data.id,
      pickCount: picks.length,
    });
  } catch (err) {
    console.error("Twitter post failed:", err);
    return NextResponse.json({ error: "Failed to post to Twitter", detail: String(err) }, { status: 500 });
  }
}
