"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Shield,
  ChevronDown,
  ChevronUp,
  Zap,
  Lock,
  Sparkles,
  CheckCircle,
  XCircle,
  MinusCircle,
  Trophy,
  BarChart2,
  X,
} from "lucide-react";
import { UserButton, SignUpButton, useUser } from "@clerk/nextjs";

const STAKE_OPTIONS = [10, 25, 50, 100];

interface Pick {
  id: string;
  pick_date: string;
  platform: string;
  event: string;
  position: string;
  odds: string;
  implied_probability: number;
  category: string;
  grade: string;
  grade_label: string;
  edge_score: number;
  true_odds: number;
  recommendation: string;
  recommendation_reason: string;
  summary: string;
  bull_case: string;
  bear_case: string;
  key_risks: string[];
  market_inefficiency: string;
  confidence_level: string;
  market_id: string | null;
  result: "won" | "lost" | "void" | null;
}

interface WinRecord {
  wins: number;
  losses: number;
  voids: number;
  winRate: number | null;
  total: number;
}

const GRADE_CONFIG: Record<string, { border: string; text: string; bg: string; glow: string }> = {
  S: { border: "border-[#00dc82]", text: "text-[#00dc82]", bg: "bg-[#00dc82]/10", glow: "shadow-[0_0_20px_rgba(0,220,130,0.15)]" },
  A: { border: "border-[#00c86e]", text: "text-[#00c86e]", bg: "bg-[#00c86e]/10", glow: "shadow-[0_0_20px_rgba(0,200,110,0.12)]" },
  B: { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-500/10", glow: "" },
  C: { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10", glow: "" },
};

function ResultBadge({ result }: { result: Pick["result"] }) {
  if (result === "won") return (
    <span className="flex items-center gap-1 text-xs font-bold text-[#00dc82] bg-[#00dc82]/10 px-2.5 py-1 rounded-full">
      <CheckCircle size={11} /> Won
    </span>
  );
  if (result === "lost") return (
    <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
      <XCircle size={11} /> Lost
    </span>
  );
  if (result === "void") return (
    <span className="flex items-center gap-1 text-xs font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full">
      <MinusCircle size={11} /> Void
    </span>
  );
  return (
    <span className="text-xs text-text-dim bg-white/5 px-2.5 py-1 rounded-full">Pending</span>
  );
}

function AdminControls({ pick, onUpdate }: { pick: Pick; onUpdate: (id: string, result: Pick["result"]) => void }) {
  const [saving, setSaving] = useState(false);

  const mark = async (result: "won" | "lost" | "void" | null) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/picks/${pick.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (res.ok) onUpdate(pick.id, result);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-text-dim mr-1">Mark:</span>
      {(["won", "lost", "void"] as const).map((r) => (
        <button
          key={r}
          onClick={() => mark(pick.result === r ? null : r)}
          disabled={saving}
          className={`text-xs px-2.5 py-1 rounded-full border transition-all disabled:opacity-50 ${
            pick.result === r
              ? r === "won"
                ? "bg-[#00dc82]/20 border-[#00dc82]/50 text-[#00dc82] font-bold"
                : r === "lost"
                ? "bg-red-500/20 border-red-500/50 text-red-400 font-bold"
                : "bg-white/10 border-white/20 text-white font-bold"
              : "border-white/10 text-text-dim hover:border-white/30 hover:text-white"
          }`}
        >
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}

function PickCard({
  pick,
  isAdmin,
  onUpdate,
}: {
  pick: Pick;
  isAdmin: boolean;
  onUpdate: (id: string, result: Pick["result"]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const gs = GRADE_CONFIG[pick.grade] ?? GRADE_CONFIG["B"];
  const isBuy = pick.recommendation === "BUY";

  return (
    <div className={`rounded-2xl border ${gs.border} ${gs.bg} ${gs.glow} overflow-hidden`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 text-center">
            <div className={`w-14 h-14 rounded-xl border ${gs.border} ${gs.bg} flex items-center justify-center mb-1`}>
              <span className={`text-2xl font-black ${gs.text}`}>{pick.grade}</span>
            </div>
            <span className="text-xs text-text-dim">{pick.edge_score > 0 ? `+${pick.edge_score?.toFixed(0)}` : pick.edge_score?.toFixed(0)} edge</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {pick.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-text-dim">{pick.category}</span>
              )}
              {pick.platform && (
                <span className="text-xs text-text-dim">{pick.platform}</span>
              )}
              <ResultBadge result={pick.result} />
            </div>
            <p className="text-white font-semibold text-sm leading-snug mb-1">{pick.event}</p>
            <p className="text-text-dim text-xs">{pick.recommendation_reason}</p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm ${
              isBuy ? "bg-[#00dc82]/15 text-[#00dc82]" : "bg-red-500/15 text-red-400"
            }`}>
              {isBuy ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {pick.recommendation}
            </div>
            {expanded ? <ChevronUp size={16} className="text-text-dim" /> : <ChevronDown size={16} className="text-text-dim" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-5 space-y-4">
          {isAdmin && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xs text-text-dim font-medium">Admin</span>
              <AdminControls pick={pick} onUpdate={onUpdate} />
            </div>
          )}

          <div className="space-y-2">
            <ProbBar label="Market Implied" value={pick.implied_probability} color="bg-blue-500" />
            <ProbBar label="AI True Estimate" value={pick.true_odds} color="bg-[#00dc82]" />
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-text-dim">Edge</span>
              <span className={`font-bold ${pick.true_odds > pick.implied_probability ? "text-[#00dc82]" : "text-red-400"}`}>
                {pick.true_odds > pick.implied_probability ? "+" : ""}
                {(pick.true_odds - pick.implied_probability).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex gap-4 text-xs flex-wrap">
            {pick.position && (
              <div><p className="text-text-dim mb-0.5">Position</p><p className="text-white font-semibold">{pick.position}</p></div>
            )}
            {pick.odds && (
              <div><p className="text-text-dim mb-0.5">Odds</p><p className="text-white font-semibold">{pick.odds}</p></div>
            )}
            <div><p className="text-text-dim mb-0.5">Confidence</p><p className="text-white font-semibold">{pick.confidence_level}</p></div>
          </div>

          {pick.summary && (
            <p className="text-sm text-white/75 leading-relaxed">{pick.summary}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pick.bull_case && (
              <div className="rounded-xl p-3 bg-[#00dc82]/5 border border-[#00dc82]/15">
                <p className="text-xs font-semibold text-[#00dc82] uppercase tracking-wider mb-1">Bull Case</p>
                <p className="text-xs text-white/70 leading-snug">{pick.bull_case}</p>
              </div>
            )}
            {pick.bear_case && (
              <div className="rounded-xl p-3 bg-red-500/5 border border-red-500/15">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Bear Case</p>
                <p className="text-xs text-white/70 leading-snug">{pick.bear_case}</p>
              </div>
            )}
          </div>

          {pick.key_risks?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-text-dim uppercase tracking-wider font-semibold">Key Risks</p>
              {pick.key_risks.map((risk, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle size={11} className="text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-white/70 leading-snug">{risk}</p>
                </div>
              ))}
            </div>
          )}

          {pick.market_inefficiency && (
            <div className="rounded-xl p-3 bg-green-dim border border-[#00dc82]/15 flex items-start gap-2">
              <Shield size={13} className="text-[#00dc82] shrink-0 mt-0.5" />
              <p className="text-xs text-white/70 leading-snug">{pick.market_inefficiency}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FreePickCard({
  pick,
  onTrade,
}: {
  pick: Pick;
  onTrade: (pick: Pick) => void;
}) {
  const gs = GRADE_CONFIG[pick.grade] ?? GRADE_CONFIG["B"];
  const isBuy = pick.recommendation === "BUY";
  const canTrade = pick.result === null && pick.market_id;

  return (
    <div className={`rounded-2xl border ${gs.border} ${gs.bg} overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-14 h-14 rounded-xl border ${gs.border} ${gs.bg} flex items-center justify-center`}>
            <span className={`text-2xl font-black ${gs.text}`}>{pick.grade}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {pick.platform && (
                <span className="text-xs text-text-dim">{pick.platform}</span>
              )}
              <ResultBadge result={pick.result} />
            </div>
            <p className="text-white font-semibold text-sm leading-snug mb-1">{pick.event}</p>
            <p className="text-text-dim text-xs">{pick.position} · {pick.recommendation}</p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm ${
              isBuy ? "bg-[#00dc82]/15 text-[#00dc82]" : "bg-red-500/15 text-red-400"
            }`}>
              {isBuy ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {pick.recommendation}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {canTrade ? (
            <button
              onClick={() => onTrade(pick)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all"
            >
              <BarChart2 size={14} /> Paper Trade
            </button>
          ) : (
            <div className="flex-1 py-2.5 rounded-xl bg-white/5 border border-border-subtle text-center text-xs text-text-dim">
              {pick.result ? "Market resolved" : "Paper trading unavailable"}
            </div>
          )}
          <Link
            href="/analyze"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border-subtle text-xs text-text-dim hover:text-white hover:border-white/20 transition-all"
          >
            <Lock size={12} /> Full analysis
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-dim">{label}</span>
        <span className="text-white font-medium">{value?.toFixed(1) ?? "—"}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value ?? 0, 100)}%` }} />
      </div>
    </div>
  );
}

function RecordBar({ record }: { record: WinRecord }) {
  if (record.total === 0) return null;

  return (
    <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 px-5 py-4 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-[#00dc82]" />
        <span className="text-sm font-semibold text-white">AI Record</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[#00dc82] font-bold">{record.wins}W</span>
        <span className="text-text-dim">-</span>
        <span className="text-red-400 font-bold">{record.losses}L</span>
        {record.voids > 0 && (
          <>
            <span className="text-text-dim">-</span>
            <span className="text-zinc-400 font-bold">{record.voids}V</span>
          </>
        )}
      </div>
      {record.winRate !== null && (
        <span className="ml-auto text-sm font-bold text-white">
          {record.winRate}% <span className="text-text-dim font-normal">win rate</span>
        </span>
      )}
    </div>
  );
}

export default function PicksPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pickDate, setPickDate] = useState<string | null>(null);
  const [record, setRecord] = useState<WinRecord | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paper trade modal state
  const [tradingPick, setTradingPick] = useState<Pick | null>(null);
  const [tradeStake, setTradeStake] = useState(10);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }
    setLoading(true);
    fetch("/api/picks")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setPicks(d.picks ?? []);
          setPickDate(d.pickDate);
          setRecord(d.record ?? null);
          setIsAdmin(d.isAdmin ?? false);
          setIsFree(d.isFree ?? false);
        }
      })
      .catch(() => setError("Failed to load picks"))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  const placePaperTrade = async () => {
    if (!tradingPick) return;
    setTradeLoading(true);
    setTradeError(null);
    try {
      const res = await fetch("/api/paper-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick_id: tradingPick.id, virtual_stake: tradeStake }),
      });
      const data = await res.json();
      if (!res.ok) { setTradeError(data.error ?? "Failed to place trade"); return; }
      setTradeSuccess(true);
    } catch {
      setTradeError("Something went wrong. Try again.");
    } finally {
      setTradeLoading(false);
    }
  };

  const handleResultUpdate = useCallback((id: string, result: Pick["result"]) => {
    setPicks((prev) => prev.map((p) => p.id === id ? { ...p, result } : p));
    fetch("/api/picks")
      .then((r) => r.json())
      .then((d) => { if (d.record) setRecord(d.record); })
      .catch(() => {});
  }, []);

  const formattedDate = pickDate
    ? new Date(pickDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/analyze" className="flex items-center gap-2 text-text-dim hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm">Analyze</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="FadeMe" width={24} height={24} className="rounded-md" />
            <span className="text-white font-semibold tracking-tight">
              Fade<span className="text-[#00dc82]">Me</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoaded && isSignedIn && (
              <Link href="/portfolio" className="flex items-center gap-1.5 text-sm text-text-dim hover:text-white transition-colors">
                <BarChart2 size={15} />
                <span className="hidden sm:inline">Portfolio</span>
              </Link>
            )}
            <UserButton />
          </div>
        </div>
      </nav>

      {/* Paper Trade Modal */}
      {tradingPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border-subtle rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-white">Paper Trade</p>
              <button onClick={() => { setTradingPick(null); setTradeSuccess(false); setTradeError(null); }}>
                <X size={18} className="text-text-dim hover:text-white transition-colors" />
              </button>
            </div>

            {tradeSuccess ? (
              <div className="text-center py-4">
                <CheckCircle size={36} className="text-[#00dc82] mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Trade placed!</p>
                <p className="text-text-dim text-sm mb-4">Track it in your paper portfolio. Results auto-resolve via Kalshi/Polymarket API.</p>
                <Link
                  href="/portfolio"
                  onClick={() => setTradingPick(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all"
                >
                  <BarChart2 size={14} /> View Portfolio
                </Link>
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-white/5 p-3 mb-4">
                  <p className="text-white text-sm font-medium leading-snug mb-1">{tradingPick.event}</p>
                  <p className="text-text-dim text-xs">
                    {tradingPick.platform} · {tradingPick.position} @{" "}
                    {tradingPick.position === "NO"
                      ? 100 - (tradingPick.implied_probability ?? 50)
                      : (tradingPick.implied_probability ?? "—")}¢
                  </p>
                </div>

                <p className="text-xs text-text-dim uppercase tracking-wider mb-2">Virtual stake</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {STAKE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setTradeStake(s)}
                      className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                        tradeStake === s
                          ? "bg-[#00dc82] text-[#070d1a] border-[#00dc82]"
                          : "border-border-subtle text-text-dim hover:border-white/30 hover:text-white"
                      }`}
                    >
                      ${s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-text-dim mb-4">
                  <span>If this wins:</span>
                  <span className="text-[#00dc82] font-bold">
                    {(() => {
                      const entryPrice = tradingPick.position === "NO"
                        ? 100 - (tradingPick.implied_probability ?? 50)
                        : (tradingPick.implied_probability ?? 50);
                      return `+$${((tradeStake * (100 / Math.max(entryPrice, 1))) - tradeStake).toFixed(2)} profit`;
                    })()}
                  </span>
                </div>

                {tradeError && (
                  <p className="text-red-300 text-xs mb-3">{tradeError}</p>
                )}

                <button
                  onClick={placePaperTrade}
                  disabled={tradeLoading}
                  className="w-full py-3 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {tradeLoading ? "Placing trade..." : `Paper Trade $${tradeStake}`}
                </button>
                <p className="text-center text-xs text-text-dim mt-2">Auto-resolved via API · No real money</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-[#00dc82]" />
            <span className="text-xs font-semibold text-[#00dc82] uppercase tracking-wider">AI-Curated · Updated Daily</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">Today&apos;s Picks</h1>
          <p className="text-text-dim text-sm leading-relaxed">
            Our AI scans hundreds of markets, news sources, and live data every day and surfaces only the highest-conviction plays.
            No guesswork — just picks backed by real analysis
            {formattedDate ? ` for ${formattedDate}` : ""}.
          </p>
        </div>

        {/* Unauthenticated teaser */}
        {!loading && isLoaded && !isSignedIn && (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-green-dim border border-[#00dc82]/20 flex items-center justify-center mx-auto mb-5">
              <BarChart2 size={28} className="text-[#00dc82]" />
            </div>
            <h2 className="text-xl font-bold mb-2">Paper trade for free</h2>
            <p className="text-text-dim text-sm mb-6 leading-relaxed">
              Not sure how our picks will do for you? Create a free account to paper trade today&apos;s AI picks and see exactly how much you&apos;d make — no credit card required.
            </p>
            <SignUpButton mode="modal" >
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all">
                <Zap size={14} />
                Create Free Account
              </button>
            </SignUpButton>
            <p className="text-xs text-text-dim mt-3">Already have an account? <Link href="/sign-in" className="text-white hover:text-[#00dc82] transition-colors">Sign in</Link></p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#00dc82] rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {!loading && isSignedIn && !error && picks.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-border-subtle flex items-center justify-center mx-auto mb-5">
              <Sparkles size={28} className="text-text-dim" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Picks generating soon</h2>
            <p className="text-text-dim text-sm mb-6">
              Our AI runs every morning at 9am ET. Check back shortly.
            </p>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
            >
              <Zap size={14} />
              Analyze Your Own Bet
            </Link>
          </div>
        )}

        {!loading && picks.length > 0 && (
          <div className="space-y-4">
            {record && <RecordBar record={record} />}

            {isFree && (
              <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-4 flex items-start gap-3 mb-2">
                <Zap size={15} className="text-[#00dc82] shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-semibold mb-0.5">Paper trade for free · Upgrade for full analysis</p>
                  <p className="text-text-dim text-xs">Click any pick to paper trade with virtual money. Subscribe to unlock edge scores, bull/bear cases, and AI Coach.</p>
                </div>
                <Link
                  href="/analyze"
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-[#00dc82] text-[#070d1a] font-bold text-xs hover:brightness-110 transition-all"
                >
                  $1/week
                </Link>
              </div>
            )}

            {picks.map((pick) =>
              isFree ? (
                <FreePickCard
                  key={pick.id}
                  pick={pick}
                  onTrade={(p) => { setTradingPick(p); setTradeStake(10); setTradeSuccess(false); setTradeError(null); }}
                />
              ) : (
                <PickCard
                  key={pick.id}
                  pick={pick}
                  isAdmin={isAdmin}
                  onUpdate={handleResultUpdate}
                />
              )
            )}

            {isFree && (
              <div className="text-center pt-2">
                <Link href="/portfolio" className="text-xs text-text-dim hover:text-white transition-colors underline underline-offset-2">
                  View your paper portfolio →
                </Link>
              </div>
            )}

            <p className="text-center text-xs text-text-dim pt-4">
              Picks are AI-generated for informational purposes only. Not financial advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
