import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Zap, Trophy, ChevronRight } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Picks Archive — FadeMe AI",
  description:
    "Browse all FadeMe AI prediction market picks by date. Kalshi, Polymarket, and PredictIt analysis — every call logged publicly.",
  openGraph: {
    title: "Picks Archive — FadeMe AI",
    description:
      "Every AI pick we've ever made, organized by date. Wins and losses — all public.",
  },
};

interface DateRow {
  pick_date: string;
  total: number;
  sa_count: number;
  wins: number;
  losses: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ArchivePage() {
  const { data: rawData } = await getSupabase()
    .from("daily_picks")
    .select("pick_date, grade, result")
    .order("pick_date", { ascending: false });

  const rows = rawData ?? [];

  // Aggregate by date
  const dateMap = new Map<string, DateRow>();
  for (const row of rows) {
    const d = row.pick_date as string;
    if (!dateMap.has(d)) {
      dateMap.set(d, { pick_date: d, total: 0, sa_count: 0, wins: 0, losses: 0 });
    }
    const entry = dateMap.get(d)!;
    entry.total++;
    if (row.grade === "S" || row.grade === "A") entry.sa_count++;
    if (row.result === "won") entry.wins++;
    if (row.result === "lost") entry.losses++;
  }

  const dates = [...dateMap.values()];

  // Group by month for display
  const monthGroups = new Map<string, DateRow[]>();
  for (const row of dates) {
    const monthKey = row.pick_date.slice(0, 7); // YYYY-MM
    if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, []);
    monthGroups.get(monthKey)!.push(row);
  }

  const months = [...monthGroups.entries()].sort((a, b) => b[0].localeCompare(a[0]));

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
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-[#00dc82]" />
            <span className="text-xs font-semibold text-[#00dc82] uppercase tracking-wider">
              Picks Archive
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Every pick, every day</h1>
          <p className="text-text-dim text-sm leading-relaxed max-w-xl">
            Every AI pick we&apos;ve ever made — organized by date. Click any date to see the full
            picks with grades and recommendations. Analysis is unlocked for subscribers.
          </p>
        </div>

        {dates.length === 0 ? (
          <p className="text-text-dim text-center py-24 text-sm">No picks yet.</p>
        ) : (
          <div className="space-y-8">
            {months.map(([monthKey, monthDates]) => {
              const monthLabel = new Date(monthKey + "-01T12:00:00").toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });
              return (
                <div key={monthKey}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-semibold text-text-dim uppercase tracking-wider">
                      {monthLabel}
                    </p>
                    <div className="flex-1 h-px bg-border-subtle" />
                  </div>
                  <div className="space-y-2">
                    {monthDates.map((row) => {
                      const resolved = row.wins + row.losses;
                      return (
                        <Link
                          key={row.pick_date}
                          href={`/picks/${row.pick_date}`}
                          className="group flex items-center gap-4 p-4 rounded-xl border border-border-subtle bg-card hover:border-[#00dc82]/30 hover:bg-[#00dc82]/5 transition-all"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <Calendar size={14} className="text-text-dim group-hover:text-[#00dc82] transition-colors" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium">{formatDate(row.pick_date)}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-text-dim">{row.total} picks</span>
                              {row.sa_count > 0 && (
                                <>
                                  <span className="text-xs text-text-dim">·</span>
                                  <span className="text-xs text-[#00dc82]">{row.sa_count} S/A grade</span>
                                </>
                              )}
                              {resolved > 0 && (
                                <>
                                  <span className="text-xs text-text-dim">·</span>
                                  <span className="text-xs text-text-dim">
                                    {row.wins}W {row.losses}L
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <ChevronRight
                            size={15}
                            className="text-text-dim group-hover:text-[#00dc82] transition-colors shrink-0"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#00dc82]/10 border border-[#00dc82]/20 flex items-center justify-center mx-auto mb-3">
            <Trophy size={18} className="text-[#00dc82]" />
          </div>
          <h2 className="text-lg font-bold mb-1">Unlock full analysis</h2>
          <p className="text-text-dim text-sm mb-4 max-w-xs mx-auto">
            Edge scores, probability bars, bull/bear cases, and Kelly sizing for every pick.
          </p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all"
          >
            <Zap size={14} /> Start for $1/week
          </Link>
          <p className="text-xs text-text-dim mt-2">Then $19.99/month · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}
