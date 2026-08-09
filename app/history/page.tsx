"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Shield,
  Clock,
  Zap,
  LogIn,
  LogOut,
  X,
  Check,
  Trophy,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import MobileNav from "@/components/MobileNav";

interface AnalysisRow {
  id: string;
  created_at: string;
  platform: string;
  event: string;
  position: string;
  odds: string;
  implied_probability: number;
  stake: string;
  potential_payout: string;
  expiration_date: string;
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
  entry_strategy: string;
  exit_strategy: string;
  has_live_context: boolean;
  outcome: "correct" | "incorrect" | null;
}

const GRADE_CONFIG: Record<string, { border: string; text: string; bg: string }> = {
  S: { border: "border-[#00dc82]", text: "text-[#00dc82]", bg: "bg-[#00dc82]/10" },
  A: { border: "border-[#00c86e]", text: "text-[#00c86e]", bg: "bg-[#00c86e]/10" },
  B: { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
  C: { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
  D: { border: "border-orange-500", text: "text-orange-400", bg: "bg-orange-500/10" },
  F: { border: "border-red-500", text: "text-red-400", bg: "bg-red-500/10" },
};

const REC_CONFIG: Record<string, { icon: typeof TrendingUp; color: string }> = {
  BUY: { icon: TrendingUp, color: "text-[#00dc82]" },
  HOLD: { icon: Minus, color: "text-yellow-400" },
  FADE: { icon: TrendingDown, color: "text-red-400" },
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-text-dim mb-0.5 text-xs">{label}</p>
      <p className="text-white font-medium text-xs">{value}</p>
    </div>
  );
}

function GalleryCard({ row, onClick }: { row: AnalysisRow; onClick: () => void }) {
  const grade = row.grade ?? "C";
  const gs = GRADE_CONFIG[grade] ?? GRADE_CONFIG["C"];
  const rec = row.recommendation ?? "HOLD";
  const rs = REC_CONFIG[rec] ?? REC_CONFIG["HOLD"];
  const RecIcon = rs.icon;
  const isCorrect = row.outcome === "correct";
  const isIncorrect = row.outcome === "incorrect";

  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl border ${gs.border} bg-card overflow-hidden text-left w-full transition-all hover:brightness-105 active:scale-[0.98] ${
        isCorrect ? "shadow-[0_0_20px_rgba(0,220,130,0.15)]" : ""
      }`}
    >
      {isCorrect && (
        <div className="absolute inset-0 bg-[#00dc82]/10 pointer-events-none" />
      )}
      {isIncorrect && (
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
      )}

      {row.outcome && (
        <div className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center ${
          isCorrect ? "bg-[#00dc82]" : "bg-red-500/80"
        }`}>
          {isCorrect
            ? <Check size={10} className="text-[#070d1a]" strokeWidth={3} />
            : <X size={10} className="text-white" strokeWidth={3} />
          }
        </div>
      )}

      <div className="relative p-4 flex flex-col min-h-[160px]">
        <div className="flex items-center gap-2 mb-3 pr-7">
          <div className={`w-10 h-10 rounded-xl border ${gs.border} ${gs.bg} flex items-center justify-center shrink-0`}>
            <span className={`text-lg font-black ${gs.text}`}>{grade}</span>
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${
            rec === "BUY" ? "bg-[#00dc82]/15 text-[#00dc82]" :
            rec === "FADE" ? "bg-red-500/15 text-red-400" :
            "bg-yellow-500/15 text-yellow-400"
          }`}>
            <RecIcon size={10} />
            {rec}
          </div>
        </div>

        <p className="text-white text-xs font-medium leading-snug line-clamp-3 flex-1 mb-3">
          {row.event || "Unknown event"}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-text-dim">
          {row.platform && <span>{row.platform}</span>}
          {row.platform && <span>·</span>}
          <span>{shortDate(row.created_at)}</span>
        </div>
      </div>
    </button>
  );
}

function AnalysisModal({ row, onClose }: {
  row: AnalysisRow;
  onClose: () => void;
}) {
  const grade = row.grade ?? "C";
  const gs = GRADE_CONFIG[grade] ?? GRADE_CONFIG["C"];
  const rec = row.recommendation ?? "HOLD";
  const rs = REC_CONFIG[rec] ?? REC_CONFIG["HOLD"];
  const RecIcon = rs.icon;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="min-h-full flex items-start justify-center p-4 py-8">
        <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="flex items-start justify-between p-5 border-b border-border-subtle gap-3">
            <div className="flex items-start gap-3">
              <div className={`shrink-0 w-12 h-12 rounded-xl border ${gs.border} ${gs.bg} flex items-center justify-center`}>
                <span className={`text-xl font-black ${gs.text}`}>{grade}</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-snug mb-1">{row.event || "Unknown event"}</p>
                <div className="flex items-center gap-2 text-xs text-text-dim flex-wrap">
                  {row.platform && <span>{row.platform}</span>}
                  {row.platform && <span>·</span>}
                  <span>{formatDate(row.created_at)}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="shrink-0 mt-0.5">
              <X size={18} className="text-text-dim hover:text-white transition-colors" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold shrink-0 ${
                rec === "BUY" ? "bg-[#00dc82]/15 text-[#00dc82]" :
                rec === "FADE" ? "bg-red-500/15 text-red-400" :
                "bg-yellow-500/15 text-yellow-400"
              }`}>
                <RecIcon size={13} />
                {rec}
              </div>
              {row.recommendation_reason && (
                <p className="text-text-dim text-xs leading-snug">{row.recommendation_reason}</p>
              )}
            </div>

            <div className="space-y-2">
              <ProbBar label="Market Implied" value={row.implied_probability} color="bg-blue-500" />
              <ProbBar label="AI True Estimate" value={row.true_odds} color="bg-[#00dc82]" />
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-text-dim">Edge</span>
                <span className={`font-bold ${row.true_odds > row.implied_probability ? "text-[#00dc82]" : "text-red-400"}`}>
                  {row.true_odds > row.implied_probability ? "+" : ""}
                  {(row.true_odds - row.implied_probability).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {row.position && <Detail label="Position" value={row.position} />}
              {row.odds && <Detail label="Odds" value={row.odds} />}
              {row.stake && row.stake !== "unknown" && <Detail label="Stake" value={row.stake} />}
            </div>

            {row.summary && (
              <p className="text-sm text-white/75 leading-relaxed">{row.summary}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {row.bull_case && (
                <div className="rounded-xl p-3 bg-[#00dc82]/5 border border-[#00dc82]/15">
                  <p className="text-xs font-semibold text-[#00dc82] uppercase tracking-wider mb-1">Bull Case</p>
                  <p className="text-xs text-white/70 leading-snug">{row.bull_case}</p>
                </div>
              )}
              {row.bear_case && (
                <div className="rounded-xl p-3 bg-red-500/5 border border-red-500/15">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Bear Case</p>
                  <p className="text-xs text-white/70 leading-snug">{row.bear_case}</p>
                </div>
              )}
            </div>

            {row.key_risks?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-text-dim uppercase tracking-wider font-semibold">Key Risks</p>
                {row.key_risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle size={11} className="text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-white/70 leading-snug">{risk}</p>
                  </div>
                ))}
              </div>
            )}

            {row.market_inefficiency && (
              <div className="rounded-xl p-3 bg-green-dim border border-[#00dc82]/15 flex items-start gap-2">
                <Shield size={13} className="text-[#00dc82] shrink-0 mt-0.5" />
                <p className="text-xs text-white/70 leading-snug">{row.market_inefficiency}</p>
              </div>
            )}

            {(row.entry_strategy || row.exit_strategy) && (
              <div className="rounded-xl border border-border-subtle bg-white/[0.02] p-3 space-y-3">
                <p className="text-xs text-text-dim uppercase tracking-wider font-semibold">Strategy</p>
                {row.entry_strategy && (
                  <div className="flex items-start gap-2">
                    <LogIn size={12} className="text-[#00dc82] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-[#00dc82] font-semibold mb-0.5">When to enter</p>
                      <p className="text-xs text-white/70 leading-snug">{row.entry_strategy}</p>
                    </div>
                  </div>
                )}
                {row.exit_strategy && (
                  <div className="flex items-start gap-2">
                    <LogOut size={12} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-400 font-semibold mb-0.5">When to walk away</p>
                      <p className="text-xs text-white/70 leading-snug">{row.exit_strategy}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-text-dim">
              <span>Confidence: <span className="text-white">{row.confidence_level}</span></span>
              {row.has_live_context && (
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
                  Live data used
                </span>
              )}
            </div>

            {row.outcome && (
              <div className={`pt-2 border-t border-border-subtle flex items-center gap-2 ${
                row.outcome === "correct" ? "text-[#00dc82]" : "text-red-400"
              }`}>
                {row.outcome === "correct"
                  ? <><Check size={14} strokeWidth={3} /> <span className="text-sm font-semibold">Prediction correct — auto-resolved</span></>
                  : <><X size={14} strokeWidth={3} /> <span className="text-sm font-semibold">Prediction incorrect — auto-resolved</span></>
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<AnalysisRow | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setAnalyses(d.analyses ?? []);
      })
      .catch(() => setError("Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  const graded = analyses.filter((a) => a.outcome !== null).length;
  const correct = analyses.filter((a) => a.outcome === "correct").length;

  return (
    <div className="min-h-screen bg-bg">
      <MobileNav activeTab="history" />
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
          <UserButton />
        </div>
      </nav>

      {selectedRow && (
        <AnalysisModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-10 pb-24 sm:pb-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Analysis History</h1>
            <p className="text-text-dim text-sm">
              {loading ? "Loading..." : `${analyses.length} past ${analyses.length === 1 ? "analysis" : "analyses"}`}
            </p>
          </div>
          <Link
            href="/analyze"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00dc82] text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
          >
            <Zap size={14} />
            New Analysis
          </Link>
        </div>

        {!loading && graded > 0 && (
          <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 px-5 py-4 flex items-center gap-4 flex-wrap mb-6">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-[#00dc82]" />
              <span className="text-sm font-semibold text-white">Your Track Record</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#00dc82] font-bold">{correct}</span>
              <span className="text-text-dim">correct out of</span>
              <span className="text-white font-bold">{graded}</span>
              <span className="text-text-dim">graded</span>
            </div>
            <span className="ml-auto text-sm font-bold text-white">
              {Math.round((correct / graded) * 100)}%{" "}
              <span className="text-text-dim font-normal">accuracy</span>
            </span>
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

        {!loading && !error && analyses.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-border-subtle flex items-center justify-center mx-auto mb-5">
              <Clock size={28} className="text-text-dim" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No analyses yet</h2>
            <p className="text-text-dim text-sm mb-6">Upload a bet screenshot to get your first grade.</p>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
            >
              <Zap size={14} />
              Analyze a Bet
            </Link>
          </div>
        )}

        {!loading && !error && analyses.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {analyses.map((row) => (
                <GalleryCard
                  key={row.id}
                  row={row}
                  onClick={() => setSelectedRow(row)}
                />
              ))}
            </div>
            <p className="text-center text-xs text-text-dim mt-6">
              Tap any card to view the full analysis. Green cards resolved correctly — automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
