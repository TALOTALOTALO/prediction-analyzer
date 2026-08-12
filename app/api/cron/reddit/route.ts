import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 60;

const GRADE_EMOJI: Record<string, string> = {
  S: "🔥", A: "✅", B: "📊", C: "⚠️", D: "📉", F: "❌",
};
const REC_EMOJI: Record<string, string> = {
  BUY: "🟢", HOLD: "🟡", FADE: "🔴",
};

// Map platform names to subreddits
const PLATFORM_SUBREDDIT: Record<string, string> = {
  Kalshi: "Kalshi",
  Polymarket: "Polymarket",
};

function trunc(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

async function getRedditToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT ?? "FadeMe/1.0",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: process.env.REDDIT_USERNAME ?? "",
      password: process.env.REDDIT_PASSWORD ?? "",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token in Reddit response");
  return data.access_token as string;
}

async function submitRedditPost(
  token: string,
  subreddit: string,
  title: string,
  text: string
): Promise<string> {
  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT ?? "FadeMe/1.0",
    },
    body: new URLSearchParams({
      sr: subreddit,
      kind: "self",
      title,
      text,
      nsfw: "false",
      spoiler: "false",
    }),
  });

  const data = await res.json();
  const postId = data?.json?.data?.id as string | undefined;
  if (!postId) {
    const errors = data?.json?.errors ?? [];
    throw new Error(`Reddit submit failed: ${JSON.stringify(errors)}`);
  }
  return postId;
}

function buildPostText(picks: Record<string, unknown>[], dateLabel: string): string {
  const lines: string[] = [
    `**FadeMe AI — ${dateLabel}**`,
    "",
    `${picks.length} high-conviction play${picks.length === 1 ? "" : "s"} today:`,
    "",
  ];

  for (const pick of picks) {
    const grade = String(pick.grade ?? "");
    const gradeEmoji = GRADE_EMOJI[grade] ?? "📊";
    const rec = String(pick.recommendation ?? "");
    const recEmoji = REC_EMOJI[rec] ?? "";
    const event = String(pick.event ?? "");
    const edge = Number(pick.edge_score ?? 0);
    const implied = Number(pick.implied_probability ?? 0);
    const trueOdds = Number(pick.true_odds ?? 0);
    const reason = trunc(String(pick.recommendation_reason ?? ""), 200);

    lines.push(`---`);
    lines.push(`**${gradeEmoji} Grade ${grade} | ${recEmoji} ${rec}**`);
    lines.push(`**${event}**`);
    lines.push(`Edge: +${edge.toFixed(1)}% | Market: ${implied.toFixed(0)}% → True: ${trueOdds.toFixed(0)}%`);
    lines.push(reason);
    lines.push("");
  }

  lines.push("---");
  lines.push("Full analysis + Kelly sizing at **[fademe.ai/picks](https://www.fademe.ai/picks)**");
  lines.push("");
  lines.push("*Every pick is logged publicly — wins and losses. We don't cherry-pick.*");

  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missingCreds = [
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "REDDIT_USERNAME",
    "REDDIT_PASSWORD",
  ].filter((k) => !process.env[k]);

  if (missingCreds.length > 0) {
    return NextResponse.json(
      { error: `Missing Reddit credentials: ${missingCreds.join(", ")}` },
      { status: 503 }
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  // Fetch today's S/A grade picks
  const { data: picks, error: picksError } = await getSupabase()
    .from("daily_picks")
    .select("*")
    .eq("pick_date", today)
    .in("grade", ["S", "A"])
    .order("edge_score", { ascending: false })
    .limit(5);

  if (picksError || !picks || picks.length === 0) {
    return NextResponse.json({ error: "No S/A grade picks found for today" }, { status: 404 });
  }

  // Group picks by platform → subreddit
  const bySubreddit: Record<string, Record<string, unknown>[]> = {};
  for (const pick of picks) {
    const platform = String(pick.platform ?? "");
    const subreddit = PLATFORM_SUBREDDIT[platform];
    if (!subreddit) continue;
    if (!bySubreddit[subreddit]) bySubreddit[subreddit] = [];
    bySubreddit[subreddit].push(pick as Record<string, unknown>);
  }

  if (Object.keys(bySubreddit).length === 0) {
    return NextResponse.json({ error: "No picks matched a known subreddit" }, { status: 404 });
  }

  // Get Reddit token once
  let token: string;
  try {
    token = await getRedditToken();
  } catch (err) {
    console.error("Reddit auth error:", err);
    return NextResponse.json({ error: "Reddit authentication failed", detail: String(err) }, { status: 502 });
  }

  const results: { subreddit: string; postId: string; pickCount: number }[] = [];
  const skipped: string[] = [];

  for (const [subreddit, subredditPicks] of Object.entries(bySubreddit)) {
    // Idempotency: skip if already posted to this subreddit today
    const { data: existing } = await getSupabase()
      .from("reddit_posts")
      .select("post_id")
      .eq("post_date", today)
      .eq("subreddit", subreddit)
      .maybeSingle();

    if (existing) {
      skipped.push(subreddit);
      continue;
    }

    const title = `FadeMe AI Picks — ${dateLabel} | ${subredditPicks.length} high-conviction play${subredditPicks.length === 1 ? "" : "s"}`;
    const text = buildPostText(subredditPicks, dateLabel);

    try {
      const postId = await submitRedditPost(token, subreddit, title, text);

      const { error: insertError } = await getSupabase()
        .from("reddit_posts")
        .insert({ post_date: today, subreddit, post_id: postId, pick_count: subredditPicks.length });

      if (insertError) {
        // Post is live on Reddit but not recorded — log prominently so it can be manually reconciled
        console.error(`ORPHANED REDDIT POST: r/${subreddit} post ${postId} succeeded but DB insert failed:`, insertError);
        throw insertError;
      }

      results.push({ subreddit, postId, pickCount: subredditPicks.length });
    } catch (err) {
      console.error(`Reddit post to r/${subreddit} failed:`, err);
      // Continue to next subreddit rather than aborting
    }
  }

  return NextResponse.json({
    success: true,
    date: today,
    posted: results,
    skipped,
  });
}
