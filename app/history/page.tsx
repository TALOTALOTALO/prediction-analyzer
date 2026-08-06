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
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

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
  has_live_context: boolean;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AnalysisCard({ row }: { row: AnalysisRow }) {
  const [expanded, setExpanded] = useState(false);
  const grade = row.grade ?? "C";
  const gs = GRADE_CONFIG[grade] ?? GRADE_CONFIG["C"];
  const rec = row.recommendation ?? "HOLD";
  const rs = REC_CONFIG[rec] ?? REC_CONFIG["HOLD"];
  const RecIcon = rs.icon;

  return (
    <div className="rounded-2xl border border-border-subtle bg-card overflow-hidden">
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-4">
          {/* Grade badge */}
          <div className={`shrink-0 w-12 h-12 rounded-xl border ${gs.border} ${gs.bg} flex items-center justify-center`}>
            <span className={`text-xl font-black ${gs.text}`}>{grade}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-snug truncate mb-1">{row.event || "Unknown event"}</p>
            <div className="flex items-center gap-3 flex-wrap">
              {row.platform && (
                <span className="text-xs text-text-dim">{row.platform}</span>
              )}
              {row.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-text-dim">{row.category}</span>
              )}
              <span className="flex items-center gap-1 text-xs text-text-dim">
                <Clock size={10} />
                {formatDate(row.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1">
              <RecIcon size={14} className={rs.color} />
              <span className={`text-sm font-bold ${rs.color}`}>{rec}</span>
            </div>
            {expanded ? (
              <ChevronUp size={16} className="text-text-dim" />
            ) : (
              <ChevronDown size={16} className="text-text-dim" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border-subtle p-5 space-y-4">
          {/* Probability bars */}
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

          {/* Bet details */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            {row.position && <Detail label="Position" value={row.position} />}
            {row.odds && <Detail label="Odds" value={row.odds} />}
            {row.stake && row.stake !== "unknown" && <Detail label="Stake" value={row.stake} />}
          </div>

          {/* Summary */}
          {row.summary && (
            <p className="text-sm text-white/75 leading-relaxed">{row.summary}</p>
          )}

          {/* Bull / Bear */}
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

          {/* Key risks */}
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

          {/* Market insight */}
          {row.market_inefficiency && (
            <div className="rounded-xl p-3 bg-green-dim border border-[#00dc82]/15 flex items-start gap-2">
              <Shield size={13} className="text-[#00dc82] shrink-0 mt-0.5" />
              <p className="text-xs text-white/70 leading-snug">{row.market_inefficiency}</p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-text-dim pt-1">
            <span>Confidence: <span className="text-white">{row.confidence_level}</span></span>
            {row.has_live_context && (
              <span className="flex items-center gap-1 text-blue-400">
                <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
                Live data used
              </span>
            )}
          </div>
        </div>
      )}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-text-dim mb-0.5">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <UserButton />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
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

        {!loading && analyses.length > 0 && (
          <div className="space-y-3">
            {analyses.map((row) => (
              <AnalysisCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
