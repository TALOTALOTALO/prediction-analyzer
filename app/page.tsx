"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Upload,
  BarChart2,
  Target,
  TrendingUp,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle,
  Star,
  Lock,
  EyeOff,
  Ban,
  ChevronDown,
  Clock,
  Sparkles,
} from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { sanityClient, type Post } from "@/lib/sanity";

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border border-border-subtle rounded-2xl overflow-hidden transition-colors ${open ? "bg-card" : "bg-transparent hover:bg-card/50"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className={`font-semibold text-sm md:text-base transition-colors ${open ? "text-green-bright" : "text-white"}`}>
          {question}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-text-dim transition-transform duration-200 ${open ? "rotate-180 text-green-bright" : ""}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-text-dim text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [avgProfit, setAvgProfit] = useState(25);
  const [picksPerMonth, setPicksPerMonth] = useState(20);
  const [latestPost, setLatestPost] = useState<Post | null>(null);

  const monthlyProfit = avgProfit * picksPerMonth;

  useEffect(() => {
    sanityClient
      .fetch<Post>(
        `*[_type == "post"] | order(publishedAt desc)[0] { _id, title, slug, excerpt, publishedAt, category, readTime }`,
        {},
        { next: { revalidate: 3600 } }
      )
      .then(setLatestPost)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-bg overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="FadeMe" width={28} height={28} className="rounded-md" />
            <span className="text-white font-bold text-lg tracking-tight">
              Fade<span className="text-green-bright">Me</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-text-dim">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          </div>
          {isLoaded && isSignedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/analyze"
                className="px-4 py-2 rounded-lg bg-green-bright text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
              >
                Go to app
              </Link>
              <UserButton />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="text-sm text-text-dim hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/analyze"
                className="px-4 py-2 rounded-lg bg-green-bright text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
              >
                Try Free
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-hero-gradient pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image src="/logo-icon.png" alt="FadeMe" width={72} height={72} className="rounded-2xl" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-bright/25 bg-green-dim text-green-bright text-xs font-medium mb-6">
            <Zap size={12} />
            Analyze your bets for $1
          </div>

          <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6">
            Know your edge{" "}
            <span className="text-green-bright">before</span>{" "}
            you commit.
          </h1>
          <p className="text-text-dim text-lg md:text-xl max-w-2xl mx-auto mb-5 leading-relaxed">
            Upload any prediction market screenshot. FadeMe grades your bet, estimates true odds,
            and tells you whether to buy, hold, or <span className="text-white font-semibold">fade</span> — in seconds.
            Find the bets that won&apos;t hit and profit by fading them.
          </p>

          <p className="text-green-bright font-semibold tracking-[0.2em] uppercase text-sm mb-10">
            Analyze. Predict. Fade.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <Link
              href="/analyze"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-green-bright text-[#070d1a] font-bold text-base hover:brightness-110 transition-all w-full sm:w-auto justify-center"
            >
              Analyze a Bet Free
              <ArrowRight size={18} />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-border-subtle text-white text-base hover:bg-card transition-all w-full sm:w-auto justify-center"
            >
              See How It Works
            </a>
          </div>

          <p className="text-text-dim text-sm mb-10">
            Not ready to commit?{" "}
            <Link href="/picks" className="text-white hover:text-green-bright transition-colors font-medium">
              Paper trade our daily AI picks for free →
            </Link>
          </p>

          {/* Trust signals */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-text-dim">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-bright" />
              We never touch your money
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-bright" />
              No access to your trading accounts
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-bright" />
              Submit a screenshot · get instant analysis
            </div>
          </div>
        </div>

        {/* Hero card mock */}
        <div className="max-w-sm mx-auto mt-16">
          <HeroCard />
        </div>
      </section>

      {/* Trusted by / markets */}
      <section className="py-10 border-y border-border-subtle">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-text-dim text-sm mb-6 uppercase tracking-widest font-medium">
            Works with every platform
          </p>
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            {["Kalshi", "Polymarket", "PredictIt", "Manifold", "Metaculus", "Any Market"].map((p) => (
              <span key={p} className="text-text-dim text-sm font-medium hover:text-white transition-colors cursor-default">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* What is Fading */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>The Strategy</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
            What does it mean to <span className="text-green-bright">fade</span> a bet?
          </h2>
          <p className="text-text-dim text-center mb-12 max-w-xl mx-auto">
            Fading is one of the most powerful edges in prediction markets — and most traders ignore it.
          </p>

          <div className="grid md:grid-cols-3 gap-5 mb-12">
            <div className="rounded-2xl border border-border-subtle bg-card p-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                <Ban size={20} className="text-red-400" />
              </div>
              <h3 className="font-bold text-white mb-2">Spot the Overpriced Bet</h3>
              <p className="text-text-dim text-sm leading-relaxed">
                Markets overprice popular narratives. When the crowd piles into a YES at 80¢ but the real probability is 60%, that&apos;s a fade opportunity worth taking.
              </p>
            </div>
            <div className="rounded-2xl border border-green-bright/20 bg-green-dim p-6">
              <div className="w-10 h-10 rounded-xl bg-green-bright/10 flex items-center justify-center mb-4">
                <Target size={20} className="text-green-bright" />
              </div>
              <h3 className="font-bold text-white mb-2">Find the Edge</h3>
              <p className="text-text-dim text-sm leading-relaxed">
                FadeMe compares the market&apos;s implied probability against our AI&apos;s true estimate. A big gap = a clear fade. Upload a screenshot and we do the math in seconds.
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-card p-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                <TrendingUp size={20} className="text-blue-400" />
              </div>
              <h3 className="font-bold text-white mb-2">Profit When They&apos;re Wrong</h3>
              <p className="text-text-dim text-sm leading-relaxed">
                You don&apos;t need to predict the future — you just need to be right more than the market. Consistently fading mispriced bets is how sharp traders build long-term profit.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-card p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <p className="text-white font-bold text-lg mb-2">The FadeMe edge in plain English</p>
              <p className="text-text-dim text-sm leading-relaxed">
                If a bet is priced at 75¢ (implied 75% chance) but our AI estimates the true probability at 55%, the market is <span className="text-white font-semibold">mispriced by 20%</span>. That&apos;s a FADE — bet NO, and the market is paying you 25¢ on a coin that should flip tails 45% of the time.
              </p>
            </div>
            <div className="shrink-0 rounded-xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-center">
              <p className="text-xs text-text-dim mb-1 uppercase tracking-widest">Verdict</p>
              <p className="text-3xl font-black text-red-400">FADE</p>
              <p className="text-xs text-red-400/70 mt-1">20% edge against market</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>How It Works</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
            Three steps. Ten seconds.
          </h2>
          <p className="text-text-dim text-center mb-14 max-w-xl mx-auto">
            No complex setup. No manual data entry. Just drop a screenshot and get a sharp, honest analysis.
          </p>

          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map((step) => (
              <StepCard key={step.number} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* Daily AI Picks */}
      <section className="py-20 px-4 border-t border-border-subtle">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Daily AI Picks</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
            We do the scanning.{" "}
            <span className="text-green-bright">You make the plays.</span>
          </h2>
          <p className="text-text-dim text-center mb-14 max-w-2xl mx-auto">
            Every morning our AI scans hundreds of markets across Kalshi, Polymarket, and PredictIt,
            cross-references live news sources, and surfaces only the highest-conviction plays.
            No guesswork — just picks backed by real analysis, delivered to your inbox daily.
          </p>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* How picks work */}
            <div className="space-y-5">
              {[
                {
                  step: "01",
                  title: "200+ markets scanned daily",
                  desc: "Our AI reads every open contract across Kalshi, Polymarket, and PredictIt — prices, volume, liquidity, and expiry.",
                },
                {
                  step: "02",
                  title: "Live news cross-referenced",
                  desc: "Breaking news, economic data, and event context are pulled in real-time so every pick reflects what's actually happening right now.",
                },
                {
                  step: "03",
                  title: "Only S and A grades make the cut",
                  desc: "We filter hard. If there's no genuine edge, we don't pick it. Subscribers get 3–6 high-conviction plays — not a list of maybes.",
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-green-bright text-[#070d1a] font-black text-xs flex items-center justify-center">
                    {step}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm mb-1">{title}</p>
                    <p className="text-text-dim text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}

              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-xl bg-green-bright text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all"
              >
                <Zap size={14} />
                Get Daily Picks — $1 First Week
              </Link>
            </div>

            {/* Mock pick card */}
            <DailyPickCardMock />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-green-glow">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Features</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
            Every edge matters.
          </h2>
          <p className="text-text-dim text-center mb-14 max-w-xl mx-auto">
            FadeMe gives you institutional-grade analysis on every bet, automatically.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Profit calculator */}
      <section id="calculator" className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Profit Calculator</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
            What&apos;s your edge worth?
          </h2>
          <p className="text-text-dim text-center mb-10 max-w-xl mx-auto">
            Small improvements in bet selection compound into significant returns.
          </p>

          <div className="rounded-2xl border border-border-subtle bg-card p-8 space-y-8">
            <div className="space-y-6">
              <SliderField
                label="Avg profit per winning bet"
                value={avgProfit}
                min={5}
                max={200}
                step={5}
                format={(v) => `$${v}`}
                onChange={setAvgProfit}
              />
              <SliderField
                label="Picks per month"
                value={picksPerMonth}
                min={5}
                max={100}
                step={5}
                format={(v) => `${v}`}
                onChange={setPicksPerMonth}
              />
            </div>

            {/* Result */}
            <div className="rounded-xl bg-green-dim border border-green-bright/20 p-6 text-center">
              <p className="text-text-dim text-sm mb-2">Estimated monthly profit</p>
              <p className="text-4xl font-black text-green-bright">
                ${monthlyProfit.toLocaleString()}
              </p>
              <p className="text-text-dim text-xs mt-2">
                ${(monthlyProfit * 12).toLocaleString()} / year
              </p>
            </div>

            <p className="text-xs text-text-dim text-center">
              Results depend on bet selection, market conditions, and individual skill. Past performance
              does not guarantee future results.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 border-t border-border-subtle">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>What Users Say</SectionLabel>
          <h2 className="text-3xl font-bold text-center mb-12">Real results.</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t) => (
              <TestimonialCard key={t.name} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="py-16 px-4 border-t border-border-subtle">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Zero Risk to You</SectionLabel>
          <h2 className="text-3xl font-bold text-center mb-10">
            We analyze. You decide. Your accounts stay yours.
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-border-subtle bg-card p-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-green-dim border border-green-bright/20 flex items-center justify-center">
                <Lock size={22} className="text-green-bright" />
              </div>
              <h3 className="font-bold text-white">We never touch your money</h3>
              <p className="text-text-dim text-sm leading-relaxed">
                FadeMe is purely an analysis tool. We have no ability to place bets, move funds, or interact with your trading accounts in any way.
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-card p-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-green-dim border border-green-bright/20 flex items-center justify-center">
                <EyeOff size={22} className="text-green-bright" />
              </div>
              <h3 className="font-bold text-white">No account access needed</h3>
              <p className="text-text-dim text-sm leading-relaxed">
                No API keys. No logins to Kalshi, Polymarket, or any other platform. Just upload a screenshot — that&apos;s all we ever see.
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-card p-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-green-dim border border-green-bright/20 flex items-center justify-center">
                <Shield size={22} className="text-green-bright" />
              </div>
              <h3 className="font-bold text-white">Screenshots aren&apos;t stored</h3>
              <p className="text-text-dim text-sm leading-relaxed">
                Screenshots are not stored by FadeMe. They are sent to our AI provider for analysis only, and are subject to their standard data retention policy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest from the blog */}
      {latestPost && (
        <section className="py-20 px-4 border-t border-border-subtle">
          <div className="max-w-5xl mx-auto">
            <SectionLabel>The Edge Report</SectionLabel>
            <h2 className="text-3xl font-bold text-center mb-10">Latest from the blog</h2>
            <Link
              href={`/blog/${latestPost.slug.current}`}
              className="group flex flex-col md:flex-row items-start gap-6 rounded-2xl border border-border-subtle bg-card p-8 hover:border-green-bright/30 transition-all"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  {latestPost.category && (
                    <span className="text-xs font-semibold text-green-bright uppercase tracking-wider">
                      {latestPost.category}
                    </span>
                  )}
                  {latestPost.readTime && (
                    <span className="flex items-center gap-1 text-xs text-text-dim">
                      <Clock size={11} />
                      {latestPost.readTime} min read
                    </span>
                  )}
                  <span className="text-xs text-text-dim">
                    {new Date(latestPost.publishedAt).toLocaleDateString("en-US", {
                      month: "long", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-3 group-hover:text-green-bright transition-colors">
                  {latestPost.title}
                </h3>
                <p className="text-text-dim text-sm leading-relaxed">{latestPost.excerpt}</p>
              </div>
              <div className="shrink-0 flex items-center gap-1 text-green-bright text-sm font-semibold mt-2 md:mt-0 md:self-center">
                Read more <ArrowRight size={14} />
              </div>
            </Link>
            <div className="text-center mt-6">
              <Link href="/blog" className="text-sm text-text-dim hover:text-white transition-colors">
                View all posts →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
            Questions? We&apos;ve got answers.
          </h2>
          <p className="text-text-dim text-center mb-10 max-w-xl mx-auto">
            Everything you need to know before your first analysis.
          </p>
          <div className="space-y-3 mb-10">
            {FAQS.map((faq) => (
              <FaqItem key={faq.question} {...faq} />
            ))}
          </div>
          <div className="rounded-2xl border border-green-bright/20 bg-green-dim p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-bold text-white mb-0.5">Still have questions?</p>
              <p className="text-text-dim text-sm">Your first analysis is just $1. Try it risk-free.</p>
            </div>
            <Link
              href="/analyze"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-bright text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all shrink-0 whitespace-nowrap"
            >
              Get Started <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-hero-gradient">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-4">
            Ready to find your edge?
          </h2>
          <p className="text-text-dim text-lg mb-8">
            Drop your first screenshot free. No signup needed.
          </p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-green-bright text-[#070d1a] font-bold text-lg hover:brightness-110 transition-all"
          >
            Analyze a Bet Now
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-white font-bold">
            Fade<span className="text-green-bright">Me</span>
          </span>
          <p className="text-text-dim text-xs text-center">
            For informational purposes only. Not financial advice. Prediction markets involve risk.
          </p>
          <div className="flex items-center gap-6 text-xs text-text-dim">
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <span>© 2026 FadeMe</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Subcomponents ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-green-bright text-xs font-semibold uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function HeroCard() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-5 shadow-2xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-text-dim mb-1">Polymarket · Politics</p>
          <p className="text-sm font-medium text-white leading-snug">
            Will the Fed cut rates before Q4?
          </p>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30">
          <span className="text-green-bright font-black text-lg">A</span>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <ProbRowMini label="Market" value={68} color="bg-blue-500" />
        <ProbRowMini label="AI Estimate" value={74} color="bg-green-bright" />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-dim">Edge: <span className="text-green-bright font-semibold">+6%</span></span>
        <span className="px-2.5 py-1 rounded-lg bg-green-bright/10 text-green-bright font-semibold">BUY</span>
      </div>
    </div>
  );
}

function ProbRowMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-dim">{label}</span>
        <span className="text-white">{value}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function DailyPickCardMock() {
  return (
    <div className="rounded-2xl border border-[#00dc82]/30 bg-card p-6 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-green-bright" />
          <span className="text-xs font-semibold text-green-bright uppercase tracking-wider">AI-Curated Pick</span>
        </div>
        <span className="text-xs text-text-dim bg-white/5 px-2.5 py-1 rounded-full">Today · Kalshi</span>
      </div>

      {/* Grade + rec row */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-[#00dc82]/10 border border-[#00dc82]/40 flex items-center justify-center shrink-0">
          <span className="text-2xl font-black text-[#00dc82]">A</span>
        </div>
        <div className="flex-1">
          <p className="text-white font-bold text-sm leading-snug">Will the Fed cut rates before Q4?</p>
          <p className="text-text-dim text-xs mt-0.5">Politics · Expires Sep 30</p>
        </div>
        <div className="shrink-0 px-3 py-1.5 rounded-lg bg-[#00dc82]/15 text-[#00dc82] font-black text-sm">
          BUY
        </div>
      </div>

      {/* Prob bars */}
      <div className="space-y-2">
        <ProbRowMini label="Market" value={58} color="bg-blue-500" />
        <ProbRowMini label="AI Estimate" value={71} color="bg-green-bright" />
      </div>

      {/* Edge */}
      <div className="flex items-center justify-between text-xs border-t border-border-subtle pt-3">
        <span className="text-text-dim">Edge</span>
        <span className="text-green-bright font-bold">+13%</span>
        <span className="text-text-dim">Confidence</span>
        <span className="text-white font-medium">High</span>
      </div>

      {/* Reason */}
      <p className="text-xs text-text-dim leading-relaxed border-t border-border-subtle pt-3">
        Market underpricing rate cut probability given recent inflation data and Fed signaling. Strong edge with 60-day runway to resolution.
      </p>
    </div>
  );
}

function StepCard({ number, title, description, icon: Icon }: {
  number: string; title: string; description: string; icon: typeof Upload;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-6 relative">
      <div className="absolute -top-3.5 -left-2 w-8 h-8 rounded-full bg-green-bright text-[#070d1a] font-black text-sm flex items-center justify-center shadow-lg">
        {number}
      </div>
      <div className="w-10 h-10 rounded-xl bg-green-dim border border-green-bright/15 flex items-center justify-center mb-4 mt-2">
        <Icon size={20} className="text-green-bright" />
      </div>
      <h3 className="font-bold text-white mb-2">{title}</h3>
      <p className="text-text-dim text-sm leading-relaxed">{description}</p>
    </div>
  );
}

const BORDER_COLORS = [
  "border-cyan-400/40",
  "border-green-bright/40",
  "border-purple-500/40",
  "border-pink-500/40",
];

function FeatureCard({ title, description, icon: Icon, index }: {
  title: string; description: string; icon: typeof BarChart2; index: number;
}) {
  return (
    <div className={`rounded-2xl border ${BORDER_COLORS[index % 4]} bg-card p-6`}>
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
        <Icon size={20} className="text-white" />
      </div>
      <h3 className="font-bold text-white mb-2">{title}</h3>
      <p className="text-text-dim text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function SliderField({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <label className="text-sm text-text-dim">{label}</label>
        <span className="text-white font-semibold text-sm">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-text-dim">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function TestimonialCard({ name, handle, text, stars }: {
  name: string; handle: string; text: string; stars: number;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-5">
      <div className="flex mb-3">
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} size={13} className="text-yellow-400 fill-yellow-400" />
        ))}
      </div>
      <p className="text-sm text-white/80 leading-relaxed mb-4">&ldquo;{text}&rdquo;</p>
      <div>
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="text-xs text-text-dim">{handle}</p>
      </div>
    </div>
  );
}

/* ── Data ── */

const STEPS = [
  {
    number: "1",
    title: "Screenshot",
    description: "Take a screenshot of any prediction market bet on Kalshi, Polymarket, PredictIt, or any other platform.",
    icon: Upload,
  },
  {
    number: "2",
    title: "Analyze",
    description: "Our AI reads your bet, calculates the true probability, and grades it against the market price.",
    icon: BarChart2,
  },
  {
    number: "3",
    title: "Win",
    description: "Get a clear BUY, HOLD, or FADE recommendation with full reasoning so you always know your edge.",
    icon: TrendingUp,
  },
];

const FEATURES = [
  {
    index: 0,
    title: "AI Bet Grading",
    description: "Every bet gets an S–F grade based on the edge between the market's implied probability and our AI's true estimate.",
    icon: BarChart2,
  },
  {
    index: 1,
    title: "True Odds Estimation",
    description: "We analyze the underlying event, historical patterns, and market sentiment to estimate what the real probability should be.",
    icon: Target,
  },
  {
    index: 2,
    title: "Smart Recommendations",
    description: "BUY when you have edge, HOLD when it's fair value, FADE when the market is pricing you out. Simple and actionable.",
    icon: TrendingUp,
  },
  {
    index: 3,
    title: "Risk Analysis",
    description: "Get the bull case, bear case, and the three key risks you need to watch before placing your bet.",
    icon: Shield,
  },
];

const FAQS = [
  {
    question: "What exactly is an 'edge' and why does it matter?",
    answer: "An edge is the gap between what the market thinks will happen (implied probability) and what will actually happen (true probability). If a market prices a YES at 70¢ but the true chance is 85%, you have a 15% edge in your favor — that's free money over time. FadeMe quantifies this gap on every bet you analyze.",
  },
  {
    question: "How does FadeMe estimate the true probability?",
    answer: "We run your screenshot through Claude Opus, Anthropic's most advanced AI model, which combines the extracted bet details with live web intelligence pulled in real-time via Tavily search. The AI weighs current news, historical context, and market dynamics to arrive at an independent probability estimate — then compares it to the market price.",
  },
  {
    question: "Which prediction market platforms does FadeMe support?",
    answer: "Any platform you can screenshot. Kalshi, Polymarket, PredictIt, Manifold, Metaculus, Augur, sports books, political markets — if it shows odds or a probability on screen, we can read it. No API integrations or account connections required.",
  },
  {
    question: "What does BUY, HOLD, or FADE actually mean?",
    answer: "BUY means our AI sees meaningful edge in your favor and the bet is worth taking. HOLD means it's roughly fair value — not a disaster, but no real edge. FADE means the market has priced you out, or worse, is pricing against reality. A FADE on a YES position means you should consider taking the NO side instead.",
  },
  {
    question: "How accurate is the analysis?",
    answer: "FadeMe is a decision-support tool, not a crystal ball. It uses one of the most advanced AI models available combined with live data to surface edge and risk — but prediction markets are inherently uncertain. We give you a sharper framework for making decisions, not guarantees. Always size positions appropriately and never bet more than you can afford to lose.",
  },
  {
    question: "Does FadeMe work for sports prediction markets?",
    answer: "Yes. Sports, politics, economics, entertainment, crypto — the AI handles any category. For sports, it factors in recent team performance, injury news, and historical matchup data that Tavily surfaces in real time.",
  },
  {
    question: "Do you store my screenshots or trading data?",
    answer: "Screenshots are never stored by FadeMe. They're sent directly to our AI provider (Anthropic) for analysis and discarded immediately after. We never see your prediction market login, account balance, or trade history.",
  },
  {
    question: "How is this better than just doing my own research?",
    answer: "Speed and objectivity. A thorough manual analysis — reading the news, estimating probabilities, identifying the bear case — takes 20-40 minutes per bet. FadeMe does it in under 30 seconds with zero emotional bias. You still make the final call; we just remove the grunt work and surface what matters.",
  },
  {
    question: "How do I cancel my subscription?",
    answer: "Hit the 'Manage Plan' button inside the app at any time. You'll be taken to your Stripe billing portal where you can cancel with one click. No emails, no chat required. If you cancel, you keep access through the end of your billing period.",
  },
  {
    question: "What's the $1 first week about?",
    answer: "We'd rather you try FadeMe on real bets before committing to the full price. The first week is $1 — that's it. After that, it's $19.99/month. If it doesn't pay for itself many times over in better bet selection, cancel before day 8 and it cost you a dollar.",
  },
];

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    handle: "@marcust_kalshi",
    stars: 5,
    text: "Caught a 12% mispricing on a Fed rate cut contract that I would have totally missed. This tool pays for itself.",
  },
  {
    name: "Jordan K.",
    handle: "Polymarket trader",
    stars: 5,
    text: "I analyze 30+ bets a month. FadeMe cut my research time in half and my hit rate went up. The risk breakdowns are gold.",
  },
  {
    name: "Priya M.",
    handle: "@priya_predicts",
    stars: 4,
    text: "Refreshingly honest — it actually tells you when a bet is NOT worth taking. Most tools just hype everything up.",
  },
];
