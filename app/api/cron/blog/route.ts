import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import { sanityWriteClient } from "@/lib/sanity";

export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function toSlug(title: string, date: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base}-${date}`;
}

function textToPortableText(text: string): unknown[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const blocks: unknown[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let style = "normal";
    let content = trimmed;

    if (trimmed.startsWith("## ")) {
      style = "h2";
      content = trimmed.slice(3);
    } else if (trimmed.startsWith("### ")) {
      style = "h3";
      content = trimmed.slice(4);
    } else if (trimmed.startsWith("# ")) {
      style = "h2";
      content = trimmed.slice(2);
    }

    // Parse inline bold markers into spans with marks
    const children: unknown[] = [];
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    for (const part of parts) {
      if (part.startsWith("**") && part.endsWith("**")) {
        children.push({
          _type: "span",
          _key: String(key++),
          text: part.slice(2, -2),
          marks: ["strong"],
        });
      } else if (part) {
        children.push({
          _type: "span",
          _key: String(key++),
          text: part,
          marks: [],
        });
      }
    }

    blocks.push({
      _type: "block",
      _key: String(key++),
      style,
      children,
      markDefs: [],
    });
  }

  return blocks;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SANITY_WRITE_TOKEN) {
    return NextResponse.json({ error: "SANITY_WRITE_TOKEN not set" }, { status: 503 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Check if blog post already published today (slug contains today's date)
  try {
    const existing = await sanityWriteClient.fetch(
      `*[_type == "post" && slug.current match $pattern][0]._id`,
      { pattern: `*${today}` }
    );
    if (existing) {
      return NextResponse.json({ message: "Blog post already published today", date: today });
    }
  } catch {
    // If check fails, proceed anyway
  }

  // Fetch today's picks from Supabase
  const { data: picks, error } = await getSupabase()
    .from("daily_picks")
    .select("*")
    .eq("pick_date", today)
    .order("edge_score", { ascending: false });

  if (error || !picks || picks.length === 0) {
    return NextResponse.json({ error: "No picks found for today — run picks cron first" }, { status: 404 });
  }

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const picksText = picks.map((p) =>
    `- ${p.platform}: ${p.event} | Position: ${p.position} | Odds: ${p.odds} | ` +
    `Edge Score: ${p.edge_score}/100 | Grade: ${p.grade} (${p.grade_label}) | ` +
    `Implied: ${p.implied_probability}% → True: ${p.true_odds}% | ` +
    `Reason: ${p.recommendation_reason}`
  ).join("\n");

  const prompt = `You are the voice behind FadeMe.ai's daily blog. Your audience: guys in their 20s who bet prediction markets, follow sports betting Twitter, and use terms like "sharp money," "the juice," "line is soft," and "sending it." Smart enough to understand the math. Degenerate enough to fade anyway.

The tone is:
- Conversational and punchy — write like a group chat message, not a research report
- Dry humor, self-aware about the degen lifestyle ("yes we put a lot of thought into this, we know")
- Honest — these readers smell fake confidence from a mile away. If something's risky, say it, then explain why it's still the play
- Concise. Short paragraphs. One idea per paragraph. No padding, no throat-clearing
- Shareable — the kind of post someone screenshots and sends to the group chat

Voice examples (follow this energy):
❌ "The implied probability of 62% suggests the market may be overestimating this outcome."
✅ "The market has this at 62%. We think they're cooked. Here's why."

❌ "This pick demonstrates significant value given the current pricing inefficiency."
✅ "You're getting 45¢ on what should be a 65-cent YES. Someone at Kalshi is asleep."

❌ "Our AI assigned this an S grade indicating exceptional value."
✅ "S-grade. The AI basically lost its mind over this one."

❌ "In conclusion, these picks represent strong opportunities in today's markets."
✅ "Good luck out there. Don't do anything we wouldn't do. (We'd do almost anything.)"

---

Today is ${todayLabel}. Here are today's top AI-generated picks:

${picksText}

---

Write a 450-600 word blog post with this structure:

1. **Cold open** (1 short paragraph) — hook the reader. Set the vibe. Reference something happening in the news, sports, or culture that connects to today's slate. No generic "today we're looking at prediction markets" intros.

2. **One section per pick** (cover 2–3 picks max — quality over quantity, use the highest edge_score ones) — use the pick event name as a ## header. For each pick: what the market thinks, what we think, what's creating the edge, and one honest sentence on what kills the bet.

3. **One-line closer** — punchy send-off. Think "GL tonight" energy, not "in conclusion."

Return ONLY a JSON object (no markdown fences, no extra text):
{
  "title": "string (punchy and specific — something a degen would actually click and share. NOT generic like 'Today\\'s Picks.' Examples: 'The Market Is Sleeping on This Kalshi Play', 'We\\'re Fading the Crowd on 3 Markets', 'Someone Mispriced This and We\\'re Taking the Other Side')",
  "excerpt": "string (one punchy line, under 140 chars, tweet-length and shareable — hint at the edge without giving it away)",
  "category": "string (one of: Market Analysis, Strategy, Fading, Platform Guides, Beginner Tips)",
  "readTime": number (estimated minutes to read),
  "body": "string (full article, ## for pick headers, **bold** for key numbers and terms, short paragraphs separated by blank lines)"
}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = (response.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  let article: { title: string; excerpt: string; category: string; readTime: number; body: string };
  try {
    article = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    console.error("Failed to parse blog article response:", text.slice(0, 500));
    return NextResponse.json({ error: "Failed to parse article from Claude" }, { status: 422 });
  }

  const slug = toSlug(article.title, today);
  const portableBody = textToPortableText(article.body);

  try {
    const doc = await sanityWriteClient.create({
      _type: "post",
      title: article.title,
      slug: { _type: "slug", current: slug },
      excerpt: article.excerpt,
      publishedAt: new Date().toISOString(),
      category: article.category,
      readTime: article.readTime,
      section: "market-report",
      body: portableBody,
    });

    return NextResponse.json({ success: true, date: today, slug, sanityId: doc._id });
  } catch (err) {
    console.error("Failed to publish to Sanity:", err);
    return NextResponse.json({ error: "Failed to publish to Sanity", detail: String(err) }, { status: 500 });
  }
}
