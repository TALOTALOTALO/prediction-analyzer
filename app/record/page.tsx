"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Trophy,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

interface PickRecord {
  id: string;
  pick_date: string;
  platform: string;
  event: string;
  position: string;
  recommendation: string;
  grade: string;
  grade_label: string | null;
  edge_score: number;
  true_odds: number | null;
  result: "won" | "lost" | "void";
  odds: string;
  implied_probability: number;
  market_id: string;
  summary: string | null;
  bull_case: string | null;
  bear_case: string | null;
  key_risks: string[] | null;
  market_inefficiency: string | null;
  recommendation_reason: string | null;
  confidence_level: string | null;
}

interface PendingPick {
  id: string;
  pick_date: string;
  platform: string;
  event: string;
  position: string;
  recommendation: string;
  grade: string;
  odds: string;
  implied_probability: number;
  market_id: string;
}

interface WinRecord {
  wins: number;
  losses: number;
  voids: number;
  winRate: number | null;
  total: number;
}

function marketVerifyUrl(platform: string, marketId: string): string {
  if (platform === "Kalshi") return `https://kalshi.com/markets/${marketId}`;
  if (platform === "Polymarket") {
    // New picks store the slug directly; legacy picks stored condition IDs
    const isSlug = /^[a-z0-9-]+$/.test(marketId) && !marketId.startsWith("0x");
    return isSlug ? `https://polymarket.com/event/${marketId}` : `https://polymarket.com/markets`;
  }
  if (platform === "PredictIt") return `https://www.predictit.org/markets/detail/${marketId}`;
  return "#";
}

function ResultBadge({ result }: { result: PickRecord["result"] }) {
  if (result === "won")
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-[#00dc82] bg-[#00dc82]/10 px-2.5 py-1 rounded-full whitespace-nowrap">
        <CheckCircle size={11} /> Won
      </span>
    );
  if (result === "lost")
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full whitespace-nowrap">
        <XCircle size={11} /> Lost
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full whitespace-nowrap">
      <MinusCircle size={11} /> Void
    </span>
  );
}

const GRADE_TEXT: Record<string, string> = {
  S: "text-[#00dc82]",
  A: "text-[#00c86e]",
  B: "text-blue-400",
  C: "text-yellow-400",
  D: "text-orange-400",
  F: "text-red-400",
};

function normProb(p: number | null | undefined): number {
  const v = p ?? 0;
  return v > 0 && v < 1 ? v * 100 : v;
}

function PickCard({ pick }: { pick: PickRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isBuy = pick.recommendation === "BUY";
  const gradeColor = GRADE_TEXT[pick.grade] ?? "text-blue-400";
  const verifyUrl = marketVerifyUrl(pick.platform, pick.market_id);
  const dateLabel = new Date(pick.pick_date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const impliedProb = normProb(pick.implied_probability);
  const trueOdds = normProb(pick.true_odds);
  const hasAnalysis = !!(pick.summary || pick.bull_case || pick.bear_case);

  return (
    <div className="rounded-xl border border-border-subtle bg-card overflow-hidden">
      {/* Header row — always visible */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Grade */}
          <div className="shrink-0 text-center pt-0.5">
            <span className={`text-lg font-black ${gradeColor}`}>{pick.grade}</span>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs text-text-dim">{pick.platform}</span>
              <span className="text-xs text-text-dim">·</span>
              <span className="text-xs text-text-dim">{dateLabel}</span>
              <ResultBadge result={pick.result} />
            </div>
            <p className="text-white text-sm font-medium leading-snug mb-2">{pick.event}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${
                  isBuy ? "bg-[#00dc82]/10 text-[#00dc82]" : "bg-red-500/10 text-red-400"
                }`}
              >
                {isBuy ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {pick.recommendation} {pick.position}
              </div>
              {pick.odds && <span className="text-xs text-text-dim">{pick.odds}</span>}
              {pick.edge_score !== null && Math.abs(pick.edge_score) <= 50 && (
                <span className={`text-xs font-medium ${pick.edge_score > 0 ? "text-[#00dc82]" : "text-red-400"}`}>
                  {pick.edge_score > 0 ? "+" : ""}{pick.edge_score?.toFixed(1)}pp
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors border border-border-subtle hover:border-white/20 px-2.5 py-1.5 rounded-lg"
              title={`Verify this result on ${pick.platform}`}
            >
              <ExternalLink size={11} />
              Verify
            </a>
            {hasAnalysis && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors border border-border-subtle hover:border-white/20 px-2.5 py-1.5 rounded-lg"
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {expanded ? "Less" : "Analysis"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable analysis */}
      {expanded && hasAnalysis && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-4">
          {/* Probability bars */}
          {(impliedProb > 0 || trueOdds > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5">Market Implied</p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-white/40 rounded-full transition-all"
                    style={{ width: `${Math.min(impliedProb, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-white font-medium">{impliedProb.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5">AI True Estimate</p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-[#00dc82] rounded-full transition-all"
                    style={{ width: `${Math.min(trueOdds, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[#00dc82] font-medium">{trueOdds.toFixed(1)}%</p>
              </div>
            </div>
          )}

          {/* Summary */}
          {pick.summary && (
            <div>
              <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5">Summary</p>
              <p className="text-xs text-white/80 leading-relaxed">{pick.summary}</p>
            </div>
          )}

          {/* Bull / Bear */}
          {(pick.bull_case || pick.bear_case) && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pick.bull_case && (
                <div className="rounded-lg bg-[#00dc82]/5 border border-[#00dc82]/15 p-3">
                  <p className="text-[10px] text-[#00dc82] uppercase tracking-wider font-semibold mb-1">Bull Case</p>
                  <p className="text-xs text-white/80 leading-relaxed">{pick.bull_case}</p>
                </div>
              )}
              {pick.bear_case && (
                <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-3">
                  <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1">Bear Case</p>
                  <p className="text-xs text-white/80 leading-relaxed">{pick.bear_case}</p>
                </div>
              )}
            </div>
          )}

          {/* Key risks */}
          {Array.isArray(pick.key_risks) && pick.key_risks.length > 0 && (
            <div>
              <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5">Key Risks</p>
              <ul className="space-y-1">
                {pick.key_risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                    <AlertTriangle size={10} className="text-yellow-400 shrink-0 mt-0.5" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Market inefficiency */}
          {pick.market_inefficiency && (
            <div>
              <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5">Market Inefficiency</p>
              <p className="text-xs text-white/80 leading-relaxed">{pick.market_inefficiency}</p>
            </div>
          )}

          {/* Grade label + confidence */}
          <div className="flex items-center gap-3 pt-1 border-t border-white/5">
            {pick.grade_label && (
              <span className={`text-xs font-semibold ${gradeColor}`}>{pick.grade_label}</span>
            )}
            {pick.confidence_level && (
              <span className="text-xs text-text-dim">· {pick.confidence_level} Confidence</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecordPage() {
  const [record, setRecord] = useState<WinRecord | null>(null);
  const [picks, setPicks] = useState<PickRecord[]>([]);
  const [pendingPicks, setPendingPicks] = useState<PendingPick[]>([]);
  const [trackingSince, setTrackingSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "won" | "lost">("all");

  useEffect(() => {
    fetch("/api/record")
      .then((r) => r.json())
      .then((d) => {
        setRecord(d.record ?? null);
        setPicks(d.picks ?? []);
        setPendingPicks(d.pendingPicks ?? []);
        setTrackingSince(d.trackingSince ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? picks : picks.filter((p) => p.result === filter);

  const sinceDateLabel = trackingSince
    ? new Date(trackingSince + "T12:00:00").toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="FadeMe" width={24} height={24} className="rounded-md" />
            <span className="text-white font-semibold tracking-tight">
              Fade<span className="text-[#00dc82]">Me</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/picks"
              className="text-sm text-text-dim hover:text-white transition-colors"
            >
              Today&apos;s Picks
            </Link>
            <Link
              href="/analyze"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00dc82] text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
            >
              <Zap size={13} /> Try Free
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={18} className="text-[#00dc82]" />
            <span className="text-xs font-semibold text-[#00dc82] uppercase tracking-wider">
              Our Track Record
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">We don&apos;t win every bet. Here&apos;s every one anyway.</h1>
          <p className="text-text-dim text-sm leading-relaxed mb-2">
            We&apos;re not going to pretend the AI is a cheat code — prediction markets are hard, and
            we miss. What we can promise is that we&apos;re always in your corner, working to put better
            information in your hands before you commit.
          </p>
          <p className="text-text-dim text-sm leading-relaxed">
            Every result below is resolved by Kalshi and Polymarket&apos;s own settlement APIs, not by
            us. Hit <span className="text-white font-medium">Verify</span> on any pick to confirm
            the outcome on the platform directly. No cherry-picking. No hidden losses.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#00dc82] rounded-full animate-spin" />
          </div>
        )}

        {!loading && record && (
          <>
            {/* Stats banner */}
            <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-6 mb-6">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-text-dim text-xs mb-1 uppercase tracking-wider">Record</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-[#00dc82]">{record.wins}W</span>
                    <span className="text-xl text-text-dim">-</span>
                    <span className="text-3xl font-black text-red-400">{record.losses}L</span>
                    {record.voids > 0 && (
                      <>
                        <span className="text-xl text-text-dim">-</span>
                        <span className="text-3xl font-black text-zinc-400">{record.voids}V</span>
                      </>
                    )}
                  </div>
                </div>

                {record.winRate !== null && (
                  <div className="border-l border-white/10 pl-6">
                    <p className="text-text-dim text-xs mb-1 uppercase tracking-wider">Win Rate</p>
                    <p className="text-3xl font-black text-white">{record.winRate}%</p>
                  </div>
                )}

                <div className="border-l border-white/10 pl-6">
                  <p className="text-text-dim text-xs mb-1 uppercase tracking-wider">Resolved Picks</p>
                  <p className="text-3xl font-black text-white">{record.total}</p>
                </div>

                {sinceDateLabel && (
                  <div className="border-l border-white/10 pl-6">
                    <p className="text-text-dim text-xs mb-1 uppercase tracking-wider">Tracking Since</p>
                    <p className="text-sm font-semibold text-white">{sinceDateLabel}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transparency callout */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-start gap-3 mb-6">
              <ShieldCheck size={16} className="text-[#00dc82] shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-semibold mb-0.5">
                  Results verified by third-party market APIs
                </p>
                <p className="text-text-dim text-xs leading-relaxed">
                  Outcomes are resolved automatically using Kalshi and Polymarket&apos;s public
                  settlement APIs — the same source of truth the platforms themselves use. We have
                  no ability to alter settled market results. Every pick below includes a direct
                  link to its original market so you can verify independently.
                </p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-5">
              {(["all", "won", "lost"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filter === f
                      ? f === "won"
                        ? "bg-[#00dc82]/15 text-[#00dc82] border border-[#00dc82]/30"
                        : f === "lost"
                        ? "bg-red-500/15 text-red-400 border border-red-500/30"
                        : "bg-white/10 text-white border border-white/20"
                      : "text-text-dim border border-transparent hover:text-white"
                  }`}
                >
                  {f === "all" ? `All (${picks.length})` : f === "won" ? `Won (${record.wins})` : `Lost (${record.losses})`}
                </button>
              ))}
            </div>

            {/* Pick list */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-text-dim text-sm">No resolved picks yet.</div>
            ) : (
              <div className="space-y-3">
                {filtered.map((pick) => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
              </div>
            )}

            {/* Pending picks */}
            {pendingPicks.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={15} className="text-yellow-400" />
                  <h2 className="text-sm font-semibold text-white">Awaiting Resolution ({pendingPicks.length})</h2>
                </div>
                <div className="space-y-3">
                  {pendingPicks.map((pick) => {
                    const isBuy = pick.recommendation === "BUY";
                    const gradeColor = GRADE_TEXT[pick.grade] ?? "text-text-dim";
                    const dateLabel = new Date(pick.pick_date + "T12:00:00").toLocaleDateString(
                      "en-US", { month: "short", day: "numeric" }
                    );
                    const verifyUrl = marketVerifyUrl(pick.platform, pick.market_id);
                    return (
                      <div key={pick.id} className="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-4">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 pt-0.5">
                            <span className={`text-lg font-black ${gradeColor}`}>{pick.grade}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs text-text-dim">{pick.platform}</span>
                              <span className="text-xs text-text-dim">·</span>
                              <span className="text-xs text-text-dim">{dateLabel}</span>
                              <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                                <Clock size={10} /> Pending
                              </span>
                            </div>
                            <p className="text-white text-sm font-medium leading-snug mb-2">{pick.event}</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${isBuy ? "bg-[#00dc82]/10 text-[#00dc82]" : "bg-red-500/10 text-red-400"}`}>
                                {isBuy ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                {pick.recommendation} {pick.position}
                              </div>
                              {pick.odds && <span className="text-xs text-text-dim">{pick.odds}</span>}
                            </div>
                          </div>
                          <a
                            href={verifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors border border-border-subtle hover:border-white/20 px-2.5 py-1.5 rounded-lg"
                          >
                            <ExternalLink size={11} />
                            View
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom CTA */}
            <div className="mt-10 rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-6 text-center">
              <p className="text-white font-bold text-lg mb-1">We&apos;re in your corner. Let&apos;s go.</p>
              <p className="text-text-dim text-sm mb-4 max-w-sm mx-auto">
                We&apos;re not going to win them all — but we&apos;re going to keep grinding, keep the data honest, and keep putting our best calls in your inbox every morning.
              </p>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all"
              >
                <Zap size={14} />
                Join us for $1/week
              </Link>
            </div>
          </>
        )}

        {!loading && !record && (
          <div className="text-center py-24 text-text-dim text-sm">No resolved picks yet.</div>
        )}
      </div>
    </div>
  );
}
