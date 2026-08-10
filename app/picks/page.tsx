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
  ExternalLink,
  SlidersHorizontal,
  DollarSign,
  Calculator,
} from "lucide-react";
import { UserButton, SignUpButton, useUser } from "@clerk/nextjs";
import MobileNav from "@/components/MobileNav";
import { calcKelly, kellyWager, useBankroll, type KellyFraction } from "@/hooks/useKelly";

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
  [key: string]: unknown;
}

interface WinRecord {
  wins: number;
  losses: number;
  voids: number;
  winRate: number | null;
  total: number;
}

function getMarketUrl(platform: string, marketId: string | null, eventTitle?: string): string {
  const encoded = eventTitle ? encodeURIComponent(eventTitle) : "";
  if (platform === "Kalshi") {
    if (marketId) {
      const series = marketId.split("-")[0].toLowerCase();
      if (series) return `https://kalshi.com/markets/${series}`;
    }
    return encoded ? `https://kalshi.com/explore?s=${encoded}` : "https://kalshi.com/explore";
  }
  if (platform === "Polymarket") {
    if (marketId) return `https://polymarket.com/event/${marketId}`;
    return encoded ? `https://polymarket.com/markets?s=${encoded}` : "https://polymarket.com/markets";
  }
  if (platform === "PredictIt") {
    return "https://www.predictit.org/markets";
  }
  return "#";
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

function AdminControls({ pick, onUpdate, onRefresh }: { pick: Pick; onUpdate: (id: string, result: Pick["result"]) => void; onRefresh: (id: string, data: Partial<Pick>) => void }) {
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/picks/${pick.id}/refresh`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.updated) {
        const u = data.updated;
        onRefresh(pick.id, {
          summary: u.summary,
          bull_case: u.bullCase,
          bear_case: u.bearCase,
          key_risks: u.keyRisks,
          recommendation_reason: u.recommendationReason,
          true_odds: u.trueOdds,
          edge_score: u.edgeScore,
          grade: u.grade,
          confidence_level: u.confidenceLevel,
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  const fixLink = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/picks/${pick.id}/fix-link`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.market_id) {
        onRefresh(pick.id, { market_id: data.market_id });
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-text-dim mr-1">Mark:</span>
      {(["won", "lost", "void"] as const).map((r) => (
        <button
          key={r}
          onClick={() => mark(pick.result === r ? null : r)}
          disabled={saving || refreshing}
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
      <button
        onClick={refresh}
        disabled={saving || refreshing}
        className="text-xs px-2.5 py-1 rounded-full border border-blue-500/30 text-blue-400 hover:border-blue-400 hover:text-blue-300 transition-all disabled:opacity-50 ml-1"
      >
        {refreshing ? "Working…" : "↻ Refresh"}
      </button>
      {pick.platform === "Polymarket" && (
        <button
          onClick={fixLink}
          disabled={saving || refreshing}
          className="text-xs px-2.5 py-1 rounded-full border border-yellow-500/30 text-yellow-400 hover:border-yellow-400 hover:text-yellow-300 transition-all disabled:opacity-50"
        >
          Fix Link
        </button>
      )}
    </div>
  );
}

function BankrollInput({ bankroll, onChange }: { bankroll: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState(bankroll > 0 ? String(bankroll) : "");

  useEffect(() => {
    if (bankroll > 0 && raw === "") setRaw(String(bankroll));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankroll]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-border-subtle">
      <DollarSign size={14} className="text-text-dim shrink-0" />
      <div className="flex-1">
        <p className="text-[10px] text-text-dim uppercase tracking-wider mb-0.5 font-medium">Your Bankroll</p>
        <input
          type="number"
          min="1"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            const n = parseFloat(e.target.value);
            onChange(!isNaN(n) && n > 0 ? n : 0);
          }}
          placeholder="e.g. 500"
          className="w-full bg-transparent text-white text-sm placeholder:text-text-dim outline-none"
        />
      </div>
      {bankroll > 0 && (
        <div className="flex items-center gap-1 text-xs text-[#00dc82]">
          <Calculator size={11} />
          <span>Kelly ready</span>
        </div>
      )}
    </div>
  );
}

function KellyPanel({ pick, bankroll }: { pick: Pick; bankroll: number }) {
  const [fraction, setFraction] = useState<KellyFraction>("half");
  const kelly = calcKelly(pick.implied_probability, pick.true_odds, pick.recommendation);

  if (!kelly.hasEdge) {
    return (
      <div className="rounded-xl p-4 bg-white/5 border border-border-subtle">
        <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1.5 font-semibold">Kelly Bet Sizing</p>
        <p className="text-xs text-red-400">No positive edge — Kelly suggests skipping this bet.</p>
      </div>
    );
  }

  const wager = kellyWager(bankroll, kelly, fraction);
  const entryP = pick.recommendation === "FADE"
    ? 1 - pick.implied_probability / 100
    : pick.implied_probability / 100;
  const profit = entryP > 0 ? wager * ((1 - entryP) / entryP) : 0;

  const fractions: { key: KellyFraction; label: string }[] = [
    { key: "quarter", label: "¼" },
    { key: "half", label: "½" },
    { key: "full", label: "Full" },
  ];

  return (
    <div className="rounded-xl p-4 bg-white/5 border border-border-subtle space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-text-dim uppercase tracking-wider font-semibold">Kelly Bet Sizing</p>
        <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10">
          {fractions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFraction(key)}
              className={`text-xs px-2.5 py-0.5 rounded-md transition-all font-medium ${
                fraction === key
                  ? "bg-[#00dc82] text-[#070d1a]"
                  : "text-text-dim hover:text-white"
              }`}
            >
              {label} Kelly
            </button>
          ))}
        </div>
      </div>

      {bankroll > 0 ? (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-black text-[#00dc82]">
              ${wager < 1 ? wager.toFixed(2) : wager.toFixed(0)}
            </p>
            <p className="text-xs text-text-dim mt-0.5">
              of ${bankroll.toLocaleString()} bankroll
            </p>
          </div>
          <div className="text-right text-xs text-text-dim space-y-0.5">
            <p>If correct: <span className="text-[#00dc82] font-semibold">+${profit < 1 ? profit.toFixed(2) : profit.toFixed(0)}</span></p>
            <p>Raw Kelly: <span className="text-white">{(kelly.fraction * 100).toFixed(1)}%</span></p>
            <p>Edge: <span className="text-[#00dc82]">+{kelly.edge.toFixed(1)}pp</span></p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-text-dim">Enter your bankroll above to see recommended wager.</p>
      )}
    </div>
  );
}

function PickCard({
  pick,
  isAdmin,
  onUpdate,
  onRefresh,
  bankroll,
}: {
  pick: Pick;
  isAdmin: boolean;
  onUpdate: (id: string, result: Pick["result"]) => void;
  onRefresh: (id: string, data: Partial<Pick>) => void;
  bankroll: number;
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
                <a
                  href={getMarketUrl(pick.platform, pick.market_id, pick.event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors"
                >
                  {pick.platform} <ExternalLink size={10} />
                </a>
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
              <AdminControls pick={pick} onUpdate={onUpdate} onRefresh={onRefresh} />
            </div>
          )}

          {pick.platform && pick.result === null && (
            <a
              href={getMarketUrl(pick.platform, pick.market_id, pick.event)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#00dc82]/30 text-[#00dc82] text-sm font-semibold hover:bg-[#00dc82]/10 transition-all"
            >
              <ExternalLink size={14} />
              Place trade on {pick.platform}
            </a>
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

          <KellyPanel pick={pick} bankroll={bankroll} />

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
                <a
                  href={getMarketUrl(pick.platform, pick.market_id, pick.event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors"
                >
                  {pick.platform} <ExternalLink size={10} />
                </a>
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

  // Bankroll + Kelly
  const [bankroll, setBankroll] = useBankroll();

  // Category filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [savedCategoryFilter, setSavedCategoryFilter] = useState<string[] | null>(null);
  const [savingFilter, setSavingFilter] = useState(false);

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
    // Fire checkin for streak (fire-and-forget)
    fetch("/api/streak", { method: "POST" }).catch(() => {});
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
          const saved = d.savedCategoryFilter ?? null;
          setSavedCategoryFilter(saved);
          if (saved && saved.length > 0) setSelectedCategories(saved);
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

  const handleRefresh = useCallback((id: string, data: Partial<Pick>) => {
    setPicks((prev) => prev.map((p) => p.id === id ? { ...p, ...data } : p));
  }, []);

  const saveFilter = async () => {
    setSavingFilter(true);
    const payload = selectedCategories.length > 0 ? selectedCategories : null;
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryFilter: payload }),
    }).catch(() => {});
    setSavedCategoryFilter(payload);
    setSavingFilter(false);
  };

  const allCategories = [...new Set(picks.map((p) => p.category).filter(Boolean))].sort();
  const filteredPicks = selectedCategories.length > 0
    ? picks.filter((p) => selectedCategories.includes(p.category))
    : picks;

  const filterDirty =
    JSON.stringify([...selectedCategories].sort()) !==
    JSON.stringify([...(savedCategoryFilter ?? [])].sort());

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

      {isSignedIn && !loading && !isFree && <MobileNav activeTab="picks" />}
      <div className="max-w-3xl mx-auto px-4 py-10 pb-24 sm:pb-10">
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

        {!loading && picks.length > 0 && allCategories.length > 1 && !isFree && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal size={14} className="text-text-dim" />
              <span className="text-xs text-text-dim font-medium uppercase tracking-wider">Filter by category</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategories([])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedCategories.length === 0
                    ? "bg-[#00dc82] text-[#070d1a] border-[#00dc82]"
                    : "border-border-subtle text-text-dim hover:border-white/30 hover:text-white"
                }`}
              >
                All
              </button>
              {allCategories.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        active ? prev.filter((c) => c !== cat) : [...prev, cat]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? "bg-[#00dc82]/15 text-[#00dc82] border-[#00dc82]/50"
                        : "border-border-subtle text-text-dim hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            {filterDirty && (
              <button
                onClick={saveFilter}
                disabled={savingFilter}
                className="mt-3 text-xs text-[#00dc82] hover:brightness-110 transition-colors disabled:opacity-50 underline underline-offset-2"
              >
                {savingFilter ? "Saving..." : "Save as my default"}
              </button>
            )}
          </div>
        )}

        {!loading && picks.length > 0 && !isFree && (
          <div className="mb-6">
            <BankrollInput bankroll={bankroll} onChange={setBankroll} />
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

            {filteredPicks.length === 0 && selectedCategories.length > 0 ? (
              <p className="text-center text-text-dim text-sm py-8">No picks in the selected categories today.</p>
            ) : filteredPicks.map((pick) =>
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
                  onRefresh={handleRefresh}
                  bankroll={bankroll}
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
