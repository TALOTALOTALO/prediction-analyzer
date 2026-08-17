"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle, TrendingUp, Trophy, Zap, Shield, ArrowRight, ChevronRight } from "lucide-react";

interface RecordData {
  wins: number;
  losses: number;
  winRate: number | null;
  total: number;
}

function EmailForm({ placement }: { placement: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Something went wrong");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to sign up. Try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-[#00dc82]/15 border border-[#00dc82]/30 flex items-center justify-center">
          <CheckCircle size={22} className="text-[#00dc82]" />
        </div>
        <p className="text-white font-bold text-lg">Check your inbox.</p>
        <p className="text-zinc-400 text-sm text-center max-w-xs">
          Today&apos;s picks are on their way. Track how they do at{" "}
          <Link href="/record" className="text-[#00dc82] hover:underline">fademe.ai/record</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <input
          ref={inputRef}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-[#00dc82]/50 focus:ring-1 focus:ring-[#00dc82]/30 transition-all"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          data-placement={placement}
          className="flex items-center justify-center gap-2 bg-[#00dc82] hover:brightness-110 disabled:opacity-60 text-[#070d1a] font-bold text-sm px-6 py-3.5 rounded-xl transition-all whitespace-nowrap"
        >
          {status === "loading" ? (
            <span className="w-4 h-4 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
          ) : (
            <>
              <Zap size={14} />
              Get Free Picks
            </>
          )}
        </button>
      </div>
      {status === "error" && (
        <p className="text-red-400 text-xs mt-2">{errorMsg}</p>
      )}
      <p className="text-zinc-600 text-xs mt-2.5 text-center sm:text-left">
        No credit card. No spam. Unsubscribe any time.
      </p>
    </form>
  );
}

export default function LandingPage() {
  const [record, setRecord] = useState<RecordData | null>(null);

  useEffect(() => {
    fetch("/api/record")
      .then((r) => r.json())
      .then((d) => setRecord(d.record ?? null))
      .catch(() => null);
  }, []);

  return (
    <div className="min-h-screen bg-[#070d1a] text-white">

      {/* Nav — minimal, no links to app */}
      <nav className="px-6 py-5 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="FadeMe" width={26} height={26} className="rounded-md" />
            <span className="font-bold text-white tracking-tight">
              Fade<span className="text-[#00dc82]">Me</span>
              <span className="text-zinc-500 font-normal">.ai</span>
            </span>
          </Link>
          <Link
            href="/record"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <Trophy size={12} /> Our Track Record
            <ChevronRight size={12} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#00dc82]/10 border border-[#00dc82]/20 rounded-full px-4 py-1.5 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00dc82] animate-pulse" />
          <span className="text-[#00dc82] text-xs font-semibold uppercase tracking-wider">
            AI Picks — Free Daily
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.08] mb-6 tracking-tight">
          The house always wins.
          <br />
          <span className="text-[#00dc82]">Until now.</span>
        </h1>

        <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
          Our AI scans Kalshi and Polymarket daily, finds where the odds are mispriced,
          and sends the best plays to your inbox — <strong className="text-white">free</strong>.
        </p>

        <div className="max-w-lg mx-auto mb-8">
          <EmailForm placement="hero" />
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-500 text-xs">
          <span className="flex items-center gap-1.5">
            <Shield size={12} className="text-[#00dc82]" /> Results verified by Kalshi &amp; Polymarket APIs
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle size={12} className="text-[#00dc82]" /> Every loss logged publicly
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={12} className="text-[#00dc82]" /> No credit card required
          </span>
        </div>
      </section>

      {/* Live stats banner */}
      {record && record.total > 0 && (
        <section className="border-y border-white/5 bg-white/[0.02] py-8">
          <div className="max-w-4xl mx-auto px-6">
            <p className="text-zinc-500 text-xs uppercase tracking-wider text-center mb-6">
              Live track record — verified by third-party settlement APIs
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto text-center">
              <div>
                <p className="text-3xl font-black text-[#00dc82]">{record.wins}W</p>
                <p className="text-zinc-500 text-xs mt-1">Wins</p>
              </div>
              <div>
                <p className="text-3xl font-black text-red-400">{record.losses}L</p>
                <p className="text-zinc-500 text-xs mt-1">Losses</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white">{record.winRate ?? "—"}%</p>
                <p className="text-zinc-500 text-xs mt-1">Win Rate</p>
              </div>
            </div>
            <p className="text-center mt-6">
              <Link
                href="/record"
                className="text-xs text-zinc-500 hover:text-[#00dc82] transition-colors flex items-center gap-1 justify-center"
              >
                Every pick — wins and losses — public and verifiable
                <ArrowRight size={11} />
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <p className="text-[#00dc82] text-xs font-semibold uppercase tracking-wider text-center mb-3">
          How it works
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
          Edge, delivered before the market corrects.
        </h2>

        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "AI scans every market",
              body: "Every morning, our model analyzes hundreds of live Kalshi and Polymarket contracts — cross-referencing prices against real-world probability using live news and data.",
            },
            {
              step: "02",
              title: "Finds the mispricings",
              body: "It quantifies the edge on each market: implied probability vs. true probability. Only picks with Grade A or S edge — 10+ percentage points — make the cut.",
            },
            {
              step: "03",
              title: "Lands in your inbox",
              body: "You get the best plays of the day with the AI's reasoning, bull & bear cases, and key risks. You decide whether to act. We track every result publicly.",
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <p className="text-[#00dc82]/50 text-xs font-mono font-bold mb-4">{step}</p>
              <h3 className="text-white font-bold text-base mb-2">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="border-y border-white/5 bg-white/[0.02] py-20">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[#00dc82] text-xs font-semibold uppercase tracking-wider text-center mb-3">
            What you get free
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            More signal than most paid services.
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              { icon: TrendingUp, text: "Daily AI picks for Kalshi & Polymarket" },
              { icon: Trophy, text: "Grade A/S edge plays only (10pp+ edge)" },
              { icon: Shield, text: "Bull case, bear case, and key risks for each pick" },
              { icon: CheckCircle, text: "Public track record — every win and loss" },
              { icon: Zap, text: "BUY / FADE / HOLD recommendation with reasoning" },
              { icon: ArrowRight, text: "Weekly win-rate update on our record" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/8 bg-[#070d1a] px-4 py-3.5">
                <div className="shrink-0 w-7 h-7 rounded-lg bg-[#00dc82]/10 flex items-center justify-center">
                  <Icon size={13} className="text-[#00dc82]" />
                </div>
                <p className="text-sm text-white/80">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-[#00dc82] text-xs font-semibold uppercase tracking-wider mb-3">
          Why we built this
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">
          Prediction markets were designed for people with better information than you.
        </h2>
        <div className="space-y-4 text-zinc-400 text-base leading-relaxed text-left max-w-2xl mx-auto">
          <p>
            Market makers on Kalshi and Polymarket have algorithmic advantages. Professional traders
            move faster. News reaches insiders first. The retail trader — betting on politics, sports,
            or macro events — is almost always the last to know.
          </p>
          <p>
            We built FadeMe to close that gap. Not by cheating. By doing the math that most people
            don&apos;t have time for: scanning every market for gaps between what the market thinks
            will happen and what the data actually says.
          </p>
          <p>
            <strong className="text-white">We don&apos;t win every bet.</strong> We log every loss, publicly.
            What we do is find edge — and edge, over time, is what beats the house.
          </p>
        </div>
      </section>

      {/* Second CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-3xl border border-[#00dc82]/15 bg-[#00dc82]/5 px-8 py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#00dc82]/10 border border-[#00dc82]/20 flex items-center justify-center mx-auto mb-6">
            <Zap size={24} className="text-[#00dc82]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Get today&apos;s picks — free.
          </h2>
          <p className="text-zinc-400 text-base mb-8 max-w-md mx-auto">
            Drop your email. We&apos;ll send you what the AI is calling today and follow up
            all week so you can see if it&apos;s worth your time.
          </p>
          <div className="max-w-md mx-auto">
            <EmailForm placement="bottom-cta" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="FadeMe" width={20} height={20} className="rounded" />
            <span className="text-zinc-500 text-sm">
              Fade<span className="text-[#00dc82]">Me</span>.ai
            </span>
          </Link>
          <div className="flex items-center gap-5 text-zinc-600 text-xs">
            <Link href="/record" className="hover:text-zinc-400 transition-colors">Track Record</Link>
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
          </div>
          <p className="text-zinc-700 text-xs text-center sm:text-right">
            Not financial advice. Prediction markets carry real risk.
          </p>
        </div>
      </footer>

    </div>
  );
}
