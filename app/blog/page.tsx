import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowLeft, Clock } from "lucide-react";
import { sanityClient, urlFor, type Post } from "@/lib/sanity";

async function getPosts(): Promise<Post[]> {
  return sanityClient.fetch(
    `*[_type == "post"] | order(publishedAt desc) {
      _id, title, slug, excerpt, publishedAt, category, readTime, mainImage
    }`
  );
}

export const metadata = {
  title: "Blog — FadeMe",
  description: "Prediction market strategy, fading guides, and edge analysis from FadeMe.",
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-dim hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm">Back</span>
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

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <p className="text-green-bright text-xs font-semibold uppercase tracking-widest mb-3">The Edge Report</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4">Prediction Market Strategy</h1>
          <p className="text-text-dim text-lg max-w-xl mx-auto">
            Guides, analysis, and tactics for finding edge on Kalshi, Polymarket, and beyond.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-text-dim text-lg">No posts yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((post, i) => (
              <PostCard key={post._id} post={post} featured={i === 0} />
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-border-subtle py-8 px-6 mt-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
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

function PostCard({ post, featured }: { post: Post; featured: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug.current}`}
      className={`group rounded-2xl border border-border-subtle bg-card overflow-hidden hover:border-green-bright/30 transition-all ${featured ? "md:col-span-2" : ""}`}
    >
      {post.mainImage && (
        <div className={`w-full bg-white/5 overflow-hidden ${featured ? "h-56" : "h-40"}`}>
          <img
            src={urlFor(post.mainImage).width(800).height(featured ? 400 : 280).url()}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
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
        </div>
        <h2 className={`font-bold text-white mb-2 group-hover:text-green-bright transition-colors ${featured ? "text-2xl" : "text-lg"}`}>
          {post.title}
        </h2>
        <p className="text-text-dim text-sm leading-relaxed mb-4 line-clamp-2">{post.excerpt}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-dim">
            {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1 text-xs text-green-bright font-medium">
            Read more <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}
