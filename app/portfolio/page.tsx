"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeft, TrendingUp, TrendingDown, CheckCircle, XCircle,
  MinusCircle, Clock, Zap, BarChart2, Trophy,
} from "lucide-react";

interface Trade {
  id: string;
  created_at: string;
  virtual_stake: number;
  position: string;
  entry_price: number;
  result: "won" | "lost" | "void" | null;
  virtual_payout: number | null;
  daily_picks: {
    event: string;
    platform: string;
    grade: string;
    recommendation: string;
    pick_date: string;
  } | null;
}

interface Portfolio {
  balance: number;
  pnl: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number | null;
  totalStaked: number;
  startingBalance: number;
}

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  S: { text: "text-[#00dc82]", bg: "bg-[#00dc82]/10", border: "border-[#00dc82]/40" },
  A: { text: "text-[#00c86e]", bg: "bg-[#00c86e]/10", border: "border-[#00c86e]/40" },
  B: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/40" },
  C: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/40" },
};

function ResultBadge({ result }: { result: Trade["result"] }) {
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
    <span className="flex items-center gap-1 text-xs text-text-dim bg-white/5 px-2.5 py-1 rounded-full">
      <Clock size={11} /> Pending
    </span>
  );
}

export default function PortfolioPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/paper-trades")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setTrades(d.trades ?? []);
          setPortfolio(d.portfolio ?? null);
        }
      })
      .catch(() => setError("Failed to load portfolio"))
      .finally(() => setLoading(false));
  }, []);

  const pnlPositive = (portfolio?.pnl ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/picks" className="flex items-center gap-2 text-text-dim hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm">Picks</span>
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Paper Portfolio</h1>
          <p className="text-text-dim text-sm">Track how you&apos;d do trading AI picks with virtual money.</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#00dc82] rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}

        {!loading && !error && portfolio && (
          <>
            {/* Portfolio stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Virtual Balance"
                value={`$${portfolio.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                sub={`Started with $${portfolio.startingBalance.toLocaleString()}`}
                highlight
              />
              <StatCard
                label="P&L"
                value={`${pnlPositive ? "+" : ""}$${portfolio.pnl.toFixed(2)}`}
                sub={`${pnlPositive ? "+" : ""}${portfolio.startingBalance > 0 ? ((portfolio.pnl / portfolio.startingBalance) * 100).toFixed(1) : 0}%`}
                positive={pnlPositive}
                negative={!pnlPositive}
              />
              <StatCard
                label="Win Rate"
                value={portfolio.winRate !== null ? `${portfolio.winRate}%` : "—"}
                sub={`${portfolio.wins}W · ${portfolio.losses}L`}
              />
              <StatCard
                label="Pending"
                value={String(portfolio.pending)}
                sub="awaiting resolution"
              />
            </div>

            {/* Conversion CTA for free users */}
            <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={15} className="text-[#00dc82]" />
                  <p className="text-white font-semibold text-sm">
                    {pnlPositive
                      ? `You'd be up $${portfolio.pnl.toFixed(2)} in real money.`
                      : "See the full analysis behind every pick."}
                  </p>
                </div>
                <p className="text-text-dim text-xs">
                  Subscribe to unlock edge scores, entry strategy, and the AI Coach — $1 your first week.
                </p>
              </div>
              <Link
                href="/analyze"
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all"
              >
                <Zap size={13} /> Get Pro — $1
              </Link>
            </div>

            {/* Trade history */}
            {trades.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-border-subtle flex items-center justify-center mx-auto mb-4">
                  <BarChart2 size={24} className="text-text-dim" />
                </div>
                <h2 className="text-lg font-semibold mb-2">No paper trades yet</h2>
                <p className="text-text-dim text-sm mb-6">Head to today&apos;s picks and place your first virtual trade.</p>
                <Link
                  href="/picks"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
                >
                  See Today&apos;s Picks
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-text-dim uppercase tracking-wider font-semibold mb-3">Trade History</p>
                {trades.map((trade) => {
                  const pick = trade.daily_picks;
                  const gs = GRADE_CONFIG[pick?.grade ?? "B"] ?? GRADE_CONFIG["B"];
                  const payout = trade.virtual_payout;
                  const tradePnl = payout !== null
                    ? payout - trade.virtual_stake
                    : null;

                  return (
                    <div key={trade.id} className="rounded-2xl border border-border-subtle bg-card p-4">
                      <div className="flex items-start gap-3">
                        {pick?.grade && (
                          <div className={`shrink-0 w-10 h-10 rounded-xl border ${gs.border} ${gs.bg} flex items-center justify-center`}>
                            <span className={`font-black text-base ${gs.text}`}>{pick.grade}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium leading-snug truncate">{pick?.event ?? "Unknown pick"}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-text-dim">{pick?.platform}</span>
                            <span className="text-xs text-text-dim">·</span>
                            <span className="text-xs text-text-dim">{trade.position} @ {trade.entry_price.toFixed(0)}¢</span>
                            <span className="text-xs text-text-dim">·</span>
                            <span className="text-xs text-text-dim">${trade.virtual_stake} staked</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <ResultBadge result={trade.result} />
                          {tradePnl !== null && (
                            <span className={`text-xs font-bold ${tradePnl >= 0 ? "text-[#00dc82]" : "text-red-400"}`}>
                              {tradePnl >= 0 ? "+" : ""}${tradePnl.toFixed(2)}
                            </span>
                          )}
                          {trade.result === null && (
                            <span className="text-xs text-text-dim">
                              wins → ${(trade.virtual_stake * (100 / trade.entry_price)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!loading && !error && !portfolio && (
          <div className="text-center py-20 text-text-dim text-sm">No data available.</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, highlight, positive, negative }: {
  label: string; value: string; sub: string;
  highlight?: boolean; positive?: boolean; negative?: boolean;
}) {
  const valueColor = positive ? "text-[#00dc82]" : negative ? "text-red-400" : highlight ? "text-white" : "text-white";
  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-4">
      <p className="text-xs text-text-dim uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-xl font-black ${valueColor}`}>{value}</p>
      <p className="text-xs text-text-dim mt-1">{sub}</p>
    </div>
  );
}
