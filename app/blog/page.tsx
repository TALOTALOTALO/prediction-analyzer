import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { sanityClient, type Post } from "@/lib/sanity";
import BlogTabs from "@/components/BlogTabs";

export const revalidate = 60;

export default async function BlogPage() {
  let posts: Post[] = [];
  try {
    posts = await sanityClient.fetch(
      `*[_type == "post"] | order(publishedAt desc) {
        _id, title, slug, excerpt, publishedAt, category, readTime, section, mainImage
      }`,
      {},
      { next: { revalidate: 60 } }
    );
  } catch {
    // Sanity unavailable — show empty state
  }

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
              Fade<span className="text-[#00dc82]">Me</span>
            </span>
          </Link>
          <Link
            href="/analyze"
            className="px-4 py-2 rounded-lg bg-[#00dc82] text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
          >
            Analyze a Bet
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <p className="text-[#00dc82] text-xs font-semibold uppercase tracking-widest mb-3">FadeMe Blog</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4">Prediction Market Edge</h1>
          <p className="text-text-dim text-lg max-w-xl mx-auto">
            Daily market reports and a growing playbook on how to find and keep your edge.
          </p>
        </div>

        <BlogTabs posts={posts} />
      </div>

      <footer className="border-t border-border-subtle py-8 px-6 mt-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-white font-bold">Fade<span className="text-[#00dc82]">Me</span></span>
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
