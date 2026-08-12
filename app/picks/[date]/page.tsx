import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  MinusCircle,
  Lock,
  Zap,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BarChart2,
  Calendar,
  Shield,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getMarketUrl } from "@/lib/market-url";

export const revalidate = 3600;

interface PublicPick {
  id: string;
  pick_date: string;
  platform: string;
  event: string;
  position: string;
  odds: string | null;
  implied_probability: number;
  category: string | null;
  grade: string;
  grade_label: string | null;
  recommendation: string;
  result: "won" | "lost" | "void" | null;
  market_id: string | null;
}

const GRADE_CONFIG: Record<string, { border: string; text: string; bg: string }> = {
  S: { border: "border-[#00dc82]", text: "text-[#00dc82]", bg: "bg-[#00dc82]/10" },
  A: { border: "border-[#00c86e]", text: "text-[#00c86e]", bg: "bg-[#00c86e]/10" },
  B: { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
  C: { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
  D: { border: "border-orange-500", text: "text-orange-400", bg: "bg-orange-500/10" },
  F: { border: "border-red-500", text: "text-red-400", bg: "bg-red-500/10" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function ResultBadge({ result }: { result: PublicPick["result"] }) {
  if (result === "won")
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-[#00dc82] bg-[#00dc82]/10 px-2 py-0.5 rounded-full">
        <CheckCircle size={10} /> Won
      </span>
    );
  if (result === "lost")
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
        <XCircle size={10} /> Lost
      </span>
    );
  if (result === "void")
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">
        <MinusCircle size={10} /> Void
      </span>
    );
  return <span className="text-xs text-text-dim bg-white/5 px-2 py-0.5 rounded-full">Pending</span>;
}

function RecBadge({ rec, position }: { rec: string; position: string }) {
  if (rec === "BUY")
    return (
      <div className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#00dc82]/15 text-[#00dc82]">
        <TrendingUp size={11} /> BUY {position}
      </div>
    );
  if (rec === "FADE")
    return (
      <div className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400">
        <TrendingDown size={11} /> FADE {position}
      </div>
    );
  return (
    <div className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-yellow-500/15 text-yellow-400">
      <Minus size={11} /> HOLD {position}
    </div>
  );
}

function PublicPickCard({ pick }: { pick: PublicPick }) {
  const gs = GRADE_CONFIG[pick.grade] ?? GRADE_CONFIG["D"];
  const marketUrl = getMarketUrl(pick.platform, pick.market_id, pick.event);

  return (
    <div className={`rounded-2xl border ${gs.border} ${gs.bg} overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <div
              className={`w-12 h-12 rounded-xl border ${gs.border} ${gs.bg} flex items-center justify-center`}
            >
              <span className={`text-xl font-black ${gs.text}`}>{pick.grade}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {pick.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-text-dim">
                  {pick.category}
                </span>
              )}
              <a
                href={marketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors"
              >
                {pick.platform} <ExternalLink size={9} />
              </a>
              <ResultBadge result={pick.result} />
            </div>
            <p className="text-white font-semibold text-sm leading-snug mb-2">{pick.event}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <RecBadge rec={pick.recommendation} position={pick.position} />
              {pick.odds && (
                <span className="text-xs text-text-dim">{pick.odds}</span>
              )}
            </div>
          </div>
        </div>

        {/* Locked analysis preview */}
        <div className="mt-4 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="p-4 blur-sm select-none pointer-events-none" aria-hidden="true">
            <div className="flex gap-4 mb-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-dim">Market Implied</span>
                  <span className="text-white">——%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full w-full" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-dim">AI True Estimate</span>
                  <span className="text-[#00dc82]">——%</span>
                </div>
                <div className="h-1.5 bg-[#00dc82]/50 rounded-full w-4/5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#00dc82]/5 border border-[#00dc82]/15 p-2.5">
                <p className="text-[10px] text-[#00dc82] uppercase font-semibold mb-1.5">Bull Case</p>
                <div className="space-y-1">
                  <div className="h-2 bg-white/15 rounded w-full" />
                  <div className="h-2 bg-white/15 rounded w-4/5" />
                  <div className="h-2 bg-white/15 rounded w-3/5" />
                </div>
              </div>
              <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-2.5">
                <p className="text-[10px] text-red-400 uppercase font-semibold mb-1.5">Bear Case</p>
                <div className="space-y-1">
                  <div className="h-2 bg-white/15 rounded w-full" />
                  <div className="h-2 bg-white/15 rounded w-3/4" />
                  <div className="h-2 bg-white/15 rounded w-2/3" />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-black/10 to-black/30">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm">
              <Lock size={12} className="text-[#00dc82]" />
              <span className="text-xs font-semibold text-white">Subscribe to unlock analysis</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return {};
  const formattedDate = formatDate(date);
  return {
    title: `FadeMe AI Picks — ${formattedDate}`,
    description: `AI-powered prediction market picks for ${formattedDate}. Kalshi, Polymarket, and PredictIt analysis with edge scores and recommendations.`,
    openGraph: {
      title: `FadeMe AI Picks — ${formattedDate}`,
      description: `AI-curated prediction market picks for ${formattedDate}. See which bets have real edge — powered by Claude AI.`,
    },
  };
}

export default async function PublicPicksPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const today = new Date().toISOString().split("T")[0];
  if (date > today) notFound();

  const { data, error } = await getSupabase()
    .from("daily_picks")
    .select(
      "id, pick_date, platform, event, position, odds, implied_probability, category, grade, grade_label, recommendation, result, market_id"
    )
    .eq("pick_date", date)
    .order("edge_score", { ascending: false });

  if (error || !data || data.length === 0) notFound();

  const picks = data as PublicPick[];

  // Adjacent dates for prev/next navigation
  const { data: allDateRows } = await getSupabase()
    .from("daily_picks")
    .select("pick_date")
    .order("pick_date", { ascending: false });

  const allDates = [
    ...new Set((allDateRows ?? []).map((r) => r.pick_date as string)),
  ];
  const dateIdx = allDates.indexOf(date);
  const prevDate = dateIdx !== -1 && dateIdx < allDates.length - 1 ? allDates[dateIdx + 1] : null;
  const nextDate = dateIdx > 0 ? allDates[dateIdx - 1] : null;

  const formattedDate = formatDate(date);
  const platforms = [...new Set(picks.map((p) => p.platform))];
  const topGrades = picks.filter((p) => p.grade === "S" || p.grade === "A").length;
  const resolvedPicks = picks.filter((p) => p.result !== null);
  const winCount = resolvedPicks.filter((p) => p.result === "won").length;

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-icon.png"
              alt="FadeMe"
              width={24}
              height={24}
              className="rounded-md"
            />
            <span className="text-white font-semibold tracking-tight">
              Fade<span className="text-[#00dc82]">Me</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/record"
              className="text-sm text-text-dim hover:text-white transition-colors hidden sm:block"
            >
              Track Record
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
        {/* Date navigation */}
        <div className="flex items-center justify-between mb-6">
          {prevDate ? (
            <Link
              href={`/picks/${prevDate}`}
              className="flex items-center gap-1.5 text-xs text-text-dim hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              <ChevronLeft size={15} />
              <span className="hidden sm:inline">{formatDateShort(prevDate)}</span>
            </Link>
          ) : (
            <div />
          )}

          <Link
            href="/archive"
            className="flex items-center gap-2 text-xs font-semibold text-[#00dc82] hover:brightness-110 transition-colors uppercase tracking-wider"
          >
            <Calendar size={14} />
            Picks Archive
          </Link>

          {nextDate ? (
            <Link
              href={`/picks/${nextDate}`}
              className="flex items-center gap-1.5 text-xs text-text-dim hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              <span className="hidden sm:inline">{formatDateShort(nextDate)}</span>
              <ChevronRight size={15} />
            </Link>
          ) : (
            <Link
              href="/picks"
              className="text-xs text-[#00dc82] hover:brightness-110 transition-colors p-2"
            >
              Today →
            </Link>
          )}
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">{formattedDate}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-dim">
            <span>{picks.length} AI picks</span>
            <span>·</span>
            <span>{platforms.join(", ")}</span>
            {topGrades > 0 && (
              <>
                <span>·</span>
                <span className="text-[#00dc82] font-medium">{topGrades} S/A grade</span>
              </>
            )}
            {resolvedPicks.length > 0 && (
              <>
                <span>·</span>
                <span>
                  {winCount}/{resolvedPicks.length} correct
                </span>
              </>
            )}
          </div>
        </div>

        {/* Picks list */}
        <div className="space-y-4 mb-10">
          {picks.map((pick) => (
            <PublicPickCard key={pick.id} pick={pick} />
          ))}
        </div>

        {/* Upsell CTA */}
        <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-7 text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#00dc82]/10 border border-[#00dc82]/20 flex items-center justify-center mx-auto mb-4">
            <BarChart2 size={22} className="text-[#00dc82]" />
          </div>
          <h2 className="text-xl font-bold mb-2">See the full analysis</h2>
          <p className="text-text-dim text-sm mb-5 max-w-sm mx-auto leading-relaxed">
            Edge scores, probability analysis, bull/bear cases, key risks, and Kelly bet sizing — unlocked for subscribers.
          </p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all"
          >
            <Zap size={14} /> Start for $1/week
          </Link>
          <p className="text-xs text-text-dim mt-3">Then $19.99/month · Cancel anytime</p>
        </div>

        {/* Transparency note */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3 mb-8">
          <Shield size={15} className="text-[#00dc82] shrink-0 mt-0.5" />
          <div>
            <p className="text-white text-sm font-semibold mb-0.5">
              Results verified by market settlement APIs
            </p>
            <p className="text-text-dim text-xs leading-relaxed">
              Outcomes are resolved automatically via Kalshi and Polymarket&apos;s public settlement
              APIs — not by us. Every pick links to its original market for independent
              verification.{" "}
              <Link
                href="/record"
                className="text-white/60 hover:text-white transition-colors underline underline-offset-2"
              >
                See our full track record →
              </Link>
            </p>
          </div>
        </div>

        {/* Recent dates */}
        {allDates.length > 1 && (
          <div>
            <p className="text-xs text-text-dim uppercase tracking-wider mb-3 font-semibold">
              Recent Picks
            </p>
            <div className="flex flex-wrap gap-2">
              {allDates.slice(0, 8).map((d) => (
                <Link
                  key={d}
                  href={`/picks/${d}`}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    d === date
                      ? "border-[#00dc82]/40 bg-[#00dc82]/10 text-[#00dc82]"
                      : "border-border-subtle text-text-dim hover:border-white/20 hover:text-white"
                  }`}
                >
                  {formatDateShort(d)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
