import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 60;

// Runs after resolve-picks (4pm ET) — tweets about newly-resolved wins

const GRADE_EMOJI: Record<string, string> = {
  S: "🔥", A: "✅", B: "📊", C: "⚠️", D: "📉", F: "❌",
};

function trunc(str: string, max: number): string {
  if (!str) return "";
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function buildWinThread(picks: Record<string, unknown>[]): { hook: string; cards: string[] } {
  const count = picks.length;

  const hook = count === 1
    ? `🎯 We called it.\n\n${trunc(String(picks[0].event ?? ""), 80)}\n\nFull breakdown 🧵👇`
    : `🎯 ${count} picks resolved. ${count} correct.\n\nThread 🧵👇`;

  const cards = picks.map((pick) => {
    const grade = String(pick.grade ?? "");
    const gradeEmoji = GRADE_EMOJI[grade] ?? "📊";
    const event = trunc(String(pick.event ?? ""), 80);
    const rec = String(pick.recommendation ?? "");
    const position = String(pick.position ?? "");
    const platform = String(pick.platform ?? "");
    const edge = Number(pick.edge_score ?? 0);
    const implied = Number(pick.implied_probability ?? 0);
    const trueOdds = Number(pick.true_odds ?? 0);
    const reason = trunc(String(pick.recommendation_reason ?? ""), 120);
    const dateLabel = new Date((String(pick.pick_date ?? "") + "T12:00:00")).toLocaleDateString("en-US", {
      month: "short", day: "numeric",
    });

    return [
      `${gradeEmoji} Grade ${grade} — ${platform} — ${dateLabel}`,
      "",
      event,
      `✅ ${rec} ${position} · +${edge.toFixed(1)}% edge`,
      `Called at ${implied.toFixed(0)}% · Settled correctly`,
      "",
      reason,
    ].join("\n");
  });

  return { hook, cards };
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

  const supabase = getSupabase();

  // Find all S/A grade picks resolved as won that haven't been tweeted yet
  // Only tweet wins from the last 7 days to avoid spamming old results
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const { data: wonPicks, error } = await supabase
    .from("daily_picks")
    .select("id, pick_date, platform, event, position, recommendation, grade, edge_score, true_odds, implied_probability, recommendation_reason")
    .eq("result", "won")
    .in("grade", ["S", "A"])
    .gte("pick_date", cutoffStr)
    .order("edge_score", { ascending: false });

  if (error || !wonPicks || wonPicks.length === 0) {
    return NextResponse.json({ message: "No won S/A picks to announce", date: new Date().toISOString().split("T")[0] });
  }

  // Filter out picks already tweeted
  const { data: alreadyTweeted } = await supabase
    .from("twitter_win_posts")
    .select("pick_id")
    .in("pick_id", wonPicks.map((p) => p.id));

  const tweetedIds = new Set((alreadyTweeted ?? []).map((r) => r.pick_id as string));
  const newWins = wonPicks.filter((p) => !tweetedIds.has(p.id));

  if (newWins.length === 0) {
    return NextResponse.json({ message: "All wins already announced", newWins: 0 });
  }

  // Cap at 3 wins per run to avoid spamming
  const winsToTweet = newWins.slice(0, 3);

  const twitter = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
  });

  const { hook, cards } = buildWinThread(winsToTweet as Record<string, unknown>[]);

  try {
    const hookTweet = await twitter.v2.tweet(hook);
    let lastId = hookTweet.data.id;

    for (let i = 0; i < cards.length; i++) {
      const reply = await twitter.v2.tweet(cards[i], {
        reply: { in_reply_to_tweet_id: lastId },
      });
      lastId = reply.data.id;

      // Record each win immediately so partial successes are tracked
      const { error: winInsertErr } = await supabase
        .from("twitter_win_posts")
        .insert({ pick_id: winsToTweet[i].id, tweet_id: reply.data.id });
      if (winInsertErr) console.error(`Failed to record win tweet for pick ${winsToTweet[i].id}:`, winInsertErr);
    }

    await twitter.v2.tweet(
      "Track record is public. Every win AND loss logged.\nfademe.ai/record\n\n#PredictionMarkets #Kalshi #Polymarket",
      { reply: { in_reply_to_tweet_id: lastId } }
    );

    return NextResponse.json({
      success: true,
      threadId: hookTweet.data.id,
      winsAnnounced: winsToTweet.length,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    const data = (err as Record<string, unknown>)?.data;
    console.error("Win tweet failed:", detail, data);
    return NextResponse.json({ error: "Failed to post win tweet", detail, data }, { status: 500 });
  }
}
