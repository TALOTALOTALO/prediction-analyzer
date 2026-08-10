import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ArrowRight, ExternalLink, Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { PortableText } from "next-sanity";
import { sanityClient, urlFor, type Post } from "@/lib/sanity";
import { getSupabase } from "@/lib/supabase";
import { getMarketUrl } from "@/lib/market-url";

export const revalidate = 60;

interface PickRow {
  id: string;
  event: string;
  platform: string;
  position: string;
  odds: string;
  grade: string;
  recommendation: string;
  market_id: string | null;
  result: "won" | "lost" | "void" | null;
}

async function getPicksForDate(dateStr: string): Promise<PickRow[]> {
  try {
    const { data } = await getSupabase()
      .from("daily_picks")
      .select("id, event, platform, position, odds, grade, recommendation, market_id, result")
      .eq("pick_date", dateStr)
      .order("edge_score", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

const GRADE_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  S: { border: "border-[#00dc82]", text: "text-[#00dc82]", bg: "bg-[#00dc82]/10" },
  A: { border: "border-[#00c86e]", text: "text-[#00c86e]", bg: "bg-[#00c86e]/10" },
  B: { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
  C: { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
};

async function getPost(slug: string): Promise<Post | null> {
  try {
    return await sanityClient.fetch(
      `*[_type == "post" && slug.current == $slug][0] {
        _id, title, slug, excerpt, publishedAt, category, readTime, mainImage, body
      }`,
      { slug },
      { next: { revalidate: 60 } }
    );
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const slugs: { slug: string }[] = await sanityClient.fetch(
      `*[_type == "post"]{ "slug": slug.current }`
    );
    return slugs.map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  const ogImage = post.mainImage
    ? urlFor(post.mainImage).width(1200).height(630).url()
    : "https://www.fademe.ai/logo-full.png";

  return {
    title: `${post.title} — FadeMe`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      url: `https://www.fademe.ai/blog/${slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [ogImage],
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post] = await Promise.all([getPost(slug)]);
  if (!post) notFound();

  const pickDate = post.publishedAt.split("T")[0];
  const picks = await getPicksForDate(pickDate);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Organization", name: "FadeMe", url: "https://www.fademe.ai" },
    publisher: {
      "@type": "Organization",
      name: "FadeMe",
      url: "https://www.fademe.ai",
      logo: { "@type": "ImageObject", url: "https://www.fademe.ai/logo-icon.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.fademe.ai/blog/${slug}` },
    ...(post.mainImage && { image: urlFor(post.mainImage).width(1200).height(630).url() }),
  };

  return (
    <div className="min-h-screen bg-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/blog" className="flex items-center gap-2 text-text-dim hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm">All Posts</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="FadeMe" width={24} height={24} className="rounded-md" />
            <span className="text-white font-semibold tracking-tight">
              Fade<span className="text-green-bright">Me</span>
            </span>
          </Link>
          <Link
            href="/analyze"
            className="px-4 py-2 rounded-lg bg-green-bright text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
          >
            Analyze a Bet
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-6">
          {post.category && (
            <span className="text-xs font-semibold text-green-bright uppercase tracking-wider">
              {post.category}
            </span>
          )}
          {post.readTime && (
            <span className="flex items-center gap-1 text-xs text-text-dim">
              <Clock size={11} />
              {post.readTime} min read
            </span>
          )}
          <span className="text-xs text-text-dim">
            {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">{post.title}</h1>
        <p className="text-text-dim text-xl leading-relaxed mb-10">{post.excerpt}</p>

        {post.mainImage && (
          <div className="rounded-2xl overflow-hidden mb-10">
            <img
              src={urlFor(post.mainImage).width(800).height(450).url()}
              alt={post.title}
              className="w-full object-cover"
            />
          </div>
        )}

        <div className="prose prose-invert prose-lg max-w-none
          prose-headings:font-bold prose-headings:text-white
          prose-p:text-white/75 prose-p:leading-relaxed
          prose-a:text-green-bright prose-a:no-underline hover:prose-a:underline
          prose-strong:text-white
          prose-li:text-white/75
          prose-blockquote:border-l-green-bright prose-blockquote:text-white/60">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <PortableText value={post.body as any} />
        </div>

        {picks.length > 0 && (
          <div className="mt-16 pt-8 border-t border-border-subtle space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Our Calls From This Date</h2>
                <p className="text-text-dim text-sm mt-0.5">
                  These are the exact picks our AI flagged on{" "}
                  {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.
                </p>
              </div>
              <Link
                href="/record"
                className="flex items-center gap-1.5 text-sm text-[#00dc82] hover:brightness-110 transition-all font-semibold"
              >
                <Trophy size={14} />
                Full track record →
              </Link>
            </div>

            <div className="space-y-2">
              {picks.map((pick) => {
                const gc = GRADE_COLORS[pick.grade] ?? GRADE_COLORS["C"];
                const isBuy = pick.recommendation === "BUY";
                const marketUrl = getMarketUrl(pick.platform, pick.market_id, pick.event);
                return (
                  <div key={pick.id} className={`rounded-xl border ${gc.border} ${gc.bg} p-4 flex items-center gap-4 flex-wrap`}>
                    <div className={`shrink-0 w-9 h-9 rounded-lg border ${gc.border} ${gc.bg} flex items-center justify-center`}>
                      <span className={`text-sm font-black ${gc.text}`}>{pick.grade}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium leading-snug truncate">{pick.event}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-text-dim">{pick.position} @ {pick.odds}</span>
                        <a
                          href={marketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-xs text-text-dim hover:text-white transition-colors"
                        >
                          {pick.platform} <ExternalLink size={9} className="ml-0.5" />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${isBuy ? "bg-[#00dc82]/15 text-[#00dc82]" : "bg-red-500/15 text-red-400"}`}>
                        {isBuy ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {pick.recommendation}
                      </div>
                      {pick.result === "won" && <span className="text-xs font-bold text-[#00dc82] bg-[#00dc82]/10 px-2 py-1 rounded-full">Won ✓</span>}
                      {pick.result === "lost" && <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-full">Lost ✗</span>}
                      {pick.result === "void" && <span className="text-xs text-zinc-400 bg-white/5 px-2 py-1 rounded-full">Void</span>}
                      {pick.result === null && <span className="text-xs text-text-dim bg-white/5 px-2 py-1 rounded-full">Pending</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
              <Link
                href="/record"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#00dc82]/30 text-[#00dc82] font-semibold text-sm hover:bg-[#00dc82]/10 transition-all"
              >
                <Trophy size={14} /> See AI Track Record
              </Link>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all"
              >
                Analyze Your Own Bet <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {picks.length === 0 && (
          <div className="mt-16 pt-8 border-t border-border-subtle">
            <p className="text-text-dim text-sm mb-4">Want to put this analysis into practice?</p>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold hover:brightness-110 transition-all"
            >
              Analyze a Bet Now <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </article>

      <footer className="border-t border-border-subtle py-8 px-6 mt-8">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-white font-bold">Fade<span className="text-green-bright">Me</span></span>
          <div className="flex items-center gap-6 text-xs text-text-dim">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
          <p className="text-text-dim text-xs">© 2026 FadeMe</p>
        </div>
      </footer>
    </div>
  );
}
