"use client";

import { useState } from "react";
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
} from "lucide-react";

export default function LandingPage() {
  const [avgProfit, setAvgProfit] = useState(25);
  const [picksPerMonth, setPicksPerMonth] = useState(20);

  const monthlyProfit = avgProfit * picksPerMonth;

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
            <a href="#calculator" className="hover:text-white transition-colors">Calculator</a>
          </div>
          <Link
            href="/analyze"
            className="px-4 py-2 rounded-lg bg-green-bright text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
          >
            Try Free
          </Link>
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

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
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
              Screenshots only — nothing stored
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
                Your bet screenshots are sent to our AI for analysis and immediately discarded. We never log, store, or share your betting activity.
              </p>
            </div>
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
