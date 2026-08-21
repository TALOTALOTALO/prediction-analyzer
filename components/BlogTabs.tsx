"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, BarChart2, BookOpen } from "lucide-react";
import { urlFor, type Post } from "@/lib/sanity";

const PLAYBOOK_TOPICS = [
  { title: "Kelly Criterion: The Math Behind Optimal Bet Sizing", desc: "Why flat betting leaves money on the table and how to size every position correctly." },
  { title: "Polymarket vs Kalshi: Which Platform Has Better Edge?", desc: "A direct comparison of fees, liquidity, market selection, and where sharp money flows." },
  { title: "How to Read Implied Probability Like a Sharp", desc: "Translating cent prices into probabilities and spotting when the crowd has it wrong." },
  { title: "Why Markets Misprice Events (And How to Exploit It)", desc: "The psychology behind market inefficiencies and the patterns that repeat every cycle." },
  { title: "Bankroll Management for Prediction Market Traders", desc: "Stop blowing up accounts. Here's the framework that keeps you in the game long-term." },
  { title: "The Beginner's Guide to Prediction Markets", desc: "What they are, how they work, and why they're often more accurate than polls and pundits." },
];

function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/blog/${post.slug.current}`}
      className="group rounded-2xl border border-border-subtle bg-card overflow-hidden hover:border-[#00dc82]/30 transition-all"
    >
      {post.mainImage && (
        <div className="w-full h-44 bg-white/5 overflow-hidden">
          <img
            src={urlFor(post.mainImage).width(1000).height(320).url()}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-3 mb-2">
          {post.category && (
            <span className="text-xs font-semibold text-[#00dc82] uppercase tracking-wider">
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
        <h2 className="text-lg font-bold text-white mb-1.5 group-hover:text-[#00dc82] transition-colors leading-snug">
          {post.title}
        </h2>
        <p className="text-text-dim text-sm leading-relaxed mb-4 line-clamp-2">{post.excerpt}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-dim">
            {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1 text-xs text-[#00dc82] font-medium">
            Read more <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogTabs({ posts }: { posts: Post[] }) {
  const [activeTab, setActiveTab] = useState<"market-report" | "playbook">("market-report");

  const reports = posts.filter((p) => !p.section || p.section === "market-report");
  const playbook = posts.filter((p) => p.section === "playbook");

  return (
    <>
      <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-border-subtle w-fit mx-auto mb-10">
        <button
          onClick={() => setActiveTab("market-report")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "market-report"
              ? "bg-[#00dc82] text-[#070d1a]"
              : "text-text-dim hover:text-white"
          }`}
        >
          <BarChart2 size={14} />
          Market Reports
          {reports.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === "market-report" ? "bg-[#070d1a]/20" : "bg-white/10"}`}>
              {reports.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("playbook")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "playbook"
              ? "bg-[#00dc82] text-[#070d1a]"
              : "text-text-dim hover:text-white"
          }`}
        >
          <BookOpen size={14} />
          Playbook
          {playbook.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === "playbook" ? "bg-[#070d1a]/20" : "bg-white/10"}`}>
              {playbook.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "market-report" ? (
        <>
          <p className="text-text-dim text-sm mb-6">Daily AI-curated picks breakdowns, fade plays, and market analysis.</p>
          {reports.length === 0 ? (
            <p className="text-center text-text-dim py-16">No reports yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {reports.map((post) => <PostCard key={post._id} post={post} />)}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-text-dim text-sm mb-6">Strategy guides, platform comparisons, and the math behind finding edge in prediction markets.</p>
          {playbook.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-5 mb-6">
                <p className="text-[#00dc82] text-sm font-semibold mb-1">Coming soon</p>
                <p className="text-text-dim text-sm">We&apos;re building out the Playbook — in-depth guides on everything from Kelly Criterion to platform selection. Here&apos;s what&apos;s dropping first:</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLAYBOOK_TOPICS.map((topic) => (
                  <div key={topic.title} className="rounded-xl border border-border-subtle bg-card p-5 opacity-60">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen size={13} className="text-[#00dc82]" />
                      <span className="text-xs text-[#00dc82] font-semibold uppercase tracking-wider">Playbook</span>
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-1 leading-snug">{topic.title}</h3>
                    <p className="text-text-dim text-xs leading-relaxed">{topic.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {playbook.map((post) => <PostCard key={post._id} post={post} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}
