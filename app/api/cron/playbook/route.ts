import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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

    if (trimmed.startsWith("## ")) { style = "h2"; content = trimmed.slice(3); }
    else if (trimmed.startsWith("### ")) { style = "h3"; content = trimmed.slice(4); }
    else if (trimmed.startsWith("# ")) { style = "h2"; content = trimmed.slice(2); }

    const children: unknown[] = [];
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    for (const part of parts) {
      if (part.startsWith("**") && part.endsWith("**")) {
        children.push({ _type: "span", _key: String(key++), text: part.slice(2, -2), marks: ["strong"] });
      } else if (part) {
        children.push({ _type: "span", _key: String(key++), text: part, marks: [] });
      }
    }

    blocks.push({ _type: "block", _key: String(key++), style, children, markDefs: [] });
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

  // Idempotency: skip if already published a playbook article today
  try {
    const existing = await sanityWriteClient.fetch(
      `*[_type == "post" && section == "playbook" && slug.current match $pattern][0]._id`,
      { pattern: `*${today}` }
    );
    if (existing) {
      return NextResponse.json({ message: "Playbook article already published today", date: today });
    }
  } catch {
    // proceed
  }

  // Fetch recent playbook titles so Claude avoids repeating topics
  let recentTitles: string[] = [];
  try {
    const recent: { title: string }[] = await sanityWriteClient.fetch(
      `*[_type == "post" && section == "playbook"] | order(publishedAt desc) [0..19] { title }`
    );
    recentTitles = recent.map((p) => p.title);
  } catch {
    // proceed without — Claude will pick freely
  }

  const avoidList = recentTitles.length > 0
    ? `\n\nDo NOT write about these topics — they've been covered recently:\n${recentTitles.map((t) => `- ${t}`).join("\n")}`
    : "";

  const prompt = `You are the voice behind FadeMe.ai's Playbook — a growing library of evergreen strategy guides for prediction market traders. Your audience: guys in their 20s-30s who bet Kalshi and Polymarket, follow sports betting Twitter, and are smart enough to want the math but degen enough to appreciate a good read.

The Playbook tone:
- Conversational but substantive — this is a real guide, not a listicle
- Dry humor, self-aware, honest about the hard parts
- Short paragraphs, specific examples, no padding
- Make it something someone would actually bookmark and re-read

Topics to draw from (pick the most interesting angle that hasn't been covered):
- Bet sizing and bankroll management strategies
- Market psychology and crowd behavior
- Specific platform mechanics (Kalshi, Polymarket, PredictIt)
- Reading and interpreting market data
- Edge identification and probability estimation
- Risk management and variance
- Specific market types (political, economic, sports, weather)
- Common beginner and intermediate mistakes
- Advanced trading concepts (correlation, liquidity, market making)
- Mental models for prediction market success
- Fading strategies and when to go contrarian
- How news and information moves markets${avoidList}

Write a 500-700 word evergreen playbook guide. Return ONLY a JSON object (no markdown fences):
{
  "title": "string (specific and compelling — not generic. Examples: 'How to Trade Around Economic Data Releases', 'The Liquidity Trap: Why Thin Markets Are Dangerous', 'Reading Between the Lines: How Breaking News Moves Markets')",
  "excerpt": "string (one punchy line under 140 chars — the hook that makes someone click)",
  "category": "string (one of: Strategy, Platform Guides, Market Analysis, Fading, Beginner Tips)",
  "readTime": number,
  "body": "string (full article — ## for section headers, **bold** for key terms and numbers, blank lines between paragraphs)"
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  const VALID_CATEGORIES = new Set(["Strategy", "Platform Guides", "Market Analysis", "Fading", "Beginner Tips"]);

  let article: { title: string; excerpt: string; category: string; readTime: number; body: string };
  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    article = {
      title: String(parsed.title ?? "").trim(),
      excerpt: String(parsed.excerpt ?? "").trim(),
      category: VALID_CATEGORIES.has(parsed.category) ? parsed.category : "Strategy",
      readTime: Math.max(1, Math.round(Number(parsed.readTime) || 5)),
      body: String(parsed.body ?? "").trim(),
    };
  } catch {
    console.error("Failed to parse playbook article:", text.slice(0, 500));
    return NextResponse.json({ error: "Failed to parse article from Claude" }, { status: 422 });
  }

  if (!article.title || !article.body) {
    console.error("Playbook article missing required fields:", { title: !!article.title, body: !!article.body });
    return NextResponse.json({ error: "Article missing required fields" }, { status: 422 });
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
      section: "playbook",
      body: portableBody,
    });

    return NextResponse.json({ success: true, date: today, slug, title: article.title, sanityId: doc._id });
  } catch (err) {
    console.error("Failed to publish playbook article to Sanity:", err);
    return NextResponse.json({ error: "Failed to publish to Sanity", detail: String(err) }, { status: 500 });
  }
}
