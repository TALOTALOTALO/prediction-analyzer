import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ArrowRight } from "lucide-react";
import { PortableText } from "next-sanity";
import { sanityClient, urlFor, type Post } from "@/lib/sanity";

export const revalidate = 60;

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
  const post = await getPost(slug);
  if (!post) notFound();

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

        <div className="mt-16 pt-8 border-t border-border-subtle">
          <p className="text-text-dim text-sm mb-4">
            Want to put this analysis into practice?
          </p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-bright text-[#070d1a] font-bold hover:brightness-110 transition-all"
          >
            Analyze a Bet Now <ArrowRight size={16} />
          </Link>
        </div>
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
