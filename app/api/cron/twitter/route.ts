import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 60;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

async function tavilySearch(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 3,
        include_answer: false,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const first = data.results?.[0];
    return first ? String(first.content ?? "").slice(0, 300) : "";
  } catch {
    return "";
  }
}

async function generateNarrativeHook(
  picks: Record<string, unknown>[],
  dateLabel: string,
  newsContext: string
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "";
  const bestEdge = Number(picks[0]?.edge_score ?? 0);
  const bestGrade = String(picks[0]?.grade ?? "");
  const topEvent = trunc(String(picks[0]?.event ?? ""), 60);

  const prompt = `You write tweets for FadeMe AI, a prediction market analytics product. Write ONE hook tweet for today's AI picks thread.

Today: ${dateLabel}
Top pick: ${topEvent} (Grade ${bestGrade}, +${bestEdge.toFixed(1)}% edge)
${picks.length} high-conviction play${picks.length === 1 ? "" : "s"} total.
News context: ${newsContext || "no breaking context today"}

Rules:
- Under 240 characters (not 280 — leave room for hashtags added separately)
- Start with an emoji or a number, never "FadeMe" or "Hey" or "Today"
- Make someone want to click the thread. Be specific about the edge or the story
- Tone: sharp, a little cocky, not corporate. Think betting Twitter voice
- Reference the specific market or news if it adds intrigue
- Examples of good openers:
  "The crowd has this at 38¢. Our model says 61%. Someone's going to be very wrong. 🧵"
  "3 markets. 1 obvious misprice. We're fading the herd today. 🧵"
  "Markets opened nervous on [event]. We think they're overreacting by 18pp. Here's the play 👇"

Return ONLY the tweet text. No quotes. No explanation.`;

  try {
    const res = await claude.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (res.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    return text.slice(0, 240);
  } catch {
    return "";
  }
}

function buildFallbackHook(picks: Record<string, unknown>[], dateLabel: string): string {
  const bestGrade = String(picks[0]?.grade ?? "");
  const bestEdge = Number(picks[0]?.edge_score ?? 0);
  return [
    `🎯 FadeMe AI Picks — ${dateLabel}`,
    "",
    `${picks.length} high-conviction play${picks.length === 1 ? "" : "s"} today.`,
    `Best edge: +${bestEdge.toFixed(1)}% | Top grade: ${bestGrade}`,
    "",
    "Full breakdown 🧵👇",
  ].join("\n");
}

function buildContextTweet(newsSnippet: string, event: string): string | null {
  const snippet = newsSnippet.trim();
  if (!snippet || snippet.length < 30) return null;
  const truncated = trunc(snippet, 220);
  return `📰 Context: ${truncated}`;
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

  const { data: existing } = await getSupabase()
    .from("twitter_posts")
    .select("tweet_id")
    .eq("post_date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: "Already posted today", date: today, tweetId: existing.tweet_id });
  }

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

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  // Run Tavily context searches for each pick in parallel, plus one general news search
  const contextQueries = picks.map((p) =>
    tavilySearch(`${String(p.event ?? "")} prediction market news ${today}`)
  );
  const newsQuery = tavilySearch(`prediction market mispriced breaking news ${today}`);

  const [newsContext, ...pickContexts] = await Promise.all([newsQuery, ...contextQueries]);

  // Generate narrative hook tweet using Claude
  const aiHook = await generateNarrativeHook(
    picks as Record<string, unknown>[],
    dateLabel,
    newsContext
  );

  const hookText = aiHook || buildFallbackHook(picks as Record<string, unknown>[], dateLabel);

  const twitter = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
  });

  try {
    const hook = await twitter.v2.tweet(hookText);
    let lastId = hook.data.id;

    for (let i = 0; i < picks.length; i++) {
      const pick = picks[i];
      const pickText = buildPickTweet(pick as Record<string, unknown>);

      const pickReply = await twitter.v2.tweet(pickText, {
        reply: { in_reply_to_tweet_id: lastId },
      });
      lastId = pickReply.data.id;

      // Add Tavily context tweet as a reply to the pick tweet
      const contextSnippet = pickContexts[i] ?? "";
      const contextTweet = buildContextTweet(contextSnippet, String(pick.event ?? ""));
      if (contextTweet) {
        const ctxReply = await twitter.v2.tweet(contextTweet, {
          reply: { in_reply_to_tweet_id: lastId },
        });
        lastId = ctxReply.data.id;
      }
    }

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

    await getSupabase()
      .from("twitter_posts")
      .insert({ post_date: today, tweet_id: hook.data.id, pick_count: picks.length });

    if (process.env.SLACK_WEBHOOK_URL) {
      const tweetUrl = `https://x.com/FadeMeAI/status/${hook.data.id}`;
      const pickLines = picks.map((p) => {
        const grade = String(p.grade ?? "");
        const emoji = GRADE_EMOJI[grade] ?? "📊";
        const rec = String(p.recommendation ?? "");
        const recEmoji = REC_EMOJI[rec] ?? "";
        const edge = Number(p.edge_score ?? 0);
        return `${emoji} *${grade}* ${recEmoji} ${rec} +${edge.toFixed(1)}% — ${trunc(String(p.event ?? ""), 60)}`;
      }).join("\n");

      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🎯 *FadeMe daily picks posted to X* — ${dateLabel}`,
          blocks: [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🎯 *FadeMe daily picks posted to X* — ${dateLabel}\n\n${pickLines}\n\n<${tweetUrl}|View thread on X>`,
            },
          }],
        }),
      });
    }

    return NextResponse.json({
      success: true,
      date: today,
      threadId: hook.data.id,
      pickCount: picks.length,
      hookSource: aiHook ? "claude" : "template",
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    const data = (err as Record<string, unknown>)?.data;
    console.error("Twitter post failed:", detail, data);
    return NextResponse.json({ error: "Failed to post to Twitter", detail, data }, { status: 500 });
  }
}
