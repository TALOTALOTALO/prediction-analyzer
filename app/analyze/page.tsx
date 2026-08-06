"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Upload,
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Shield,
  Zap,
  X,
  CheckCircle,
  Lock,
  Settings,
  Sparkles,
  LogIn,
  LogOut,
  Clock,
} from "lucide-react";

interface DetectedBet {
  platform: string;
  event: string;
  position: string;
  odds: string;
  impliedProbability: number;
  stake: string;
  potentialPayout: string;
  expirationDate: string;
  category: string;
  rawText: string;
}

interface BetAnalysis {
  grade: string;
  gradeLabel: string;
  edgeScore: number;
  trueOdds: number;
  recommendation: string;
  recommendationReason: string;
  summary: string;
  bullCase: string;
  bearCase: string;
  keyRisks: string[];
  marketInefficiency: string;
  confidenceLevel: string;
  entryStrategy: string;
  exitStrategy: string;
}

interface DashboardPick {
  id: string;
  event: string;
  platform: string;
  grade: string;
  recommendation: string;
  confidence_level: string;
  edge_score: number;
  true_odds: number;
  implied_probability: number;
}

interface AnalysisResult {
  detected: DetectedBet;
  analysis: BetAnalysis;
  hasLiveContext?: boolean;
}

const GRADE_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; glow: string }
> = {
  S: { bg: "bg-[#00dc82]/10", border: "border-[#00dc82]", text: "text-[#00dc82]", glow: "grade-s" },
  A: { bg: "bg-[#00c86e]/10", border: "border-[#00c86e]", text: "text-[#00c86e]", glow: "grade-a" },
  B: { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-400", glow: "grade-b" },
  C: { bg: "bg-yellow-500/10", border: "border-yellow-500", text: "text-yellow-400", glow: "grade-c" },
  D: { bg: "bg-orange-500/10", border: "border-orange-500", text: "text-orange-400", glow: "grade-d" },
  F: { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-400", glow: "grade-f" },
};

const REC_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bg: string }> = {
  BUY: { icon: TrendingUp, color: "text-[#00dc82]", bg: "bg-[#00dc82]/10" },
  HOLD: { icon: Minus, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  FADE: { icon: TrendingDown, color: "text-red-400", bg: "bg-red-400/10" },
};

type SubStatus = "loading" | "active" | "free" | "upgradeRequired";

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzePageInner />
    </Suspense>
  );
}

function AnalyzePageInner() {
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get("success") === "true";

  const [subStatus, setSubStatus] = useState<SubStatus>("loading");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [dashPicks, setDashPicks] = useState<DashboardPick[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<Array<{
    id: string; event: string; grade: string; recommendation: string;
    created_at: string; platform: string; outcome: "correct" | "incorrect" | null;
  }>>([]);

  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => {
        if (d.active) {
          setSubStatus("active");
          fetch("/api/picks")
            .then((r) => r.json())
            .then((data) => { if (data.picks) setDashPicks(data.picks.slice(0, 3)); })
            .catch(() => {});
          fetch("/api/history")
            .then((r) => r.json())
            .then((data) => { if (data.analyses) setRecentAnalyses(data.analyses.slice(0, 4)); })
            .catch(() => {});
        } else if (d.freeAnalysisUsed) {
          setSubStatus("upgradeRequired");
        } else {
          setSubStatus("free");
        }
      })
      .catch(() => setSubStatus("free"));
  }, []);

  const startCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutLoading(false);
        if (res.status === 409) {
          setCheckoutError("You already have an active subscription. Try restoring it below.");
        } else {
          setCheckoutError(data.error ?? "Checkout failed. Please try again.");
        }
      }
    } catch {
      setCheckoutLoading(false);
      setCheckoutError("Something went wrong. Please try again.");
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setPortalLoading(false);
    } catch {
      setPortalLoading(false);
    }
  };

  const restoreSubscription = async () => {
    setSyncLoading(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync-subscription", { method: "POST" });
      const data = await res.json();
      if (data.synced) {
        window.location.reload();
      } else {
        setSyncError(data.message ?? "No active subscription found. Contact support if you believe this is an error.");
        setSyncLoading(false);
      }
    } catch {
      setSyncError("Something went wrong. Please try again.");
      setSyncLoading(false);
    }
  };

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
      return;
    }
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setImageData({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const clearImage = () => {
    setPreview(null);
    setImageData(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyze = async () => {
    if (!imageData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData.base64, mimeType: imageData.mimeType }),
      });
      const data = await res.json();
      if (res.status === 403 && data.upgradeRequired) {
        setSubStatus("upgradeRequired");
        setError("You've used your free analysis. Subscribe below to keep going.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      // Mark free analysis as used — use functional updater to avoid stale closure
      setSubStatus((prev) => (prev === "free" ? "upgradeRequired" : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const grade = result?.analysis.grade ?? "C";
  const gradeStyle = GRADE_CONFIG[grade] ?? GRADE_CONFIG["C"];
  const rec = result?.analysis.recommendation ?? "HOLD";
  const recStyle = REC_CONFIG[rec] ?? REC_CONFIG["HOLD"];
  const RecIcon = recStyle.icon;

  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-dim hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span className="text-sm">Back</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="FadeMe" width={24} height={24} className="rounded-md" />
            <span className="text-white font-semibold tracking-tight">
              Fade<span className="text-green-bright">Me</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {subStatus === "active" && (
              <>
                <Link href="/picks" className="flex items-center gap-1 text-xs text-[#00dc82] hover:brightness-110 transition-colors font-medium">
                  <Sparkles size={12} />
                  Today&apos;s Picks
                </Link>
                <Link href="/coach" className="flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors">
                  AI Coach
                </Link>
                <Link href="/history" className="text-xs text-text-dim hover:text-white transition-colors">
                  History
                </Link>
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="flex items-center gap-1.5 text-xs text-text-dim hover:text-white transition-colors disabled:opacity-50"
                >
                  {portalLoading ? (
                    <span className="inline-block w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                  ) : (
                    <Settings size={13} />
                  )}
                  Manage Plan
                </button>
              </>
            )}
            <UserButton />
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Success banner */}
        {justSubscribed && (
          <div className="mb-6 p-4 rounded-xl bg-green-bright/10 border border-green-bright/30 flex items-center gap-3">
            <CheckCircle size={18} className="text-green-bright shrink-0" />
            <p className="text-green-bright text-sm font-medium">
              Welcome to FadeMe Pro! Your first week is just $1. Start analyzing below.
            </p>
          </div>
        )}

        {/* Loading */}
        {subStatus === "loading" && (
          <div className="flex items-center justify-center py-32">
            <div className="w-6 h-6 border-2 border-white/10 border-t-green-bright rounded-full animate-spin" />
          </div>
        )}

        {/* Analyzer */}
        {(subStatus === "active" || subStatus === "free" || subStatus === "upgradeRequired") && (
          <>
            {/* Today's Picks preview — subscribers only */}
            {subStatus === "active" && dashPicks.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-green-bright" />
                    <span className="text-sm font-semibold text-white">Today&apos;s Picks</span>
                  </div>
                  <Link href="/picks" className="flex items-center gap-1 text-xs text-green-bright hover:brightness-110 transition-colors">
                    View all <ChevronRight size={12} />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {dashPicks.map((pick) => {
                    const isBuy = pick.recommendation === "BUY";
                    const gs = GRADE_CONFIG[pick.grade] ?? GRADE_CONFIG["C"];
                    return (
                      <Link
                        key={pick.id}
                        href="/picks"
                        className={`rounded-xl border ${gs.border} ${gs.bg} p-4 hover:brightness-110 transition-all block`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xl font-black ${gs.text}`}>{pick.grade}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? "bg-green-bright/10 text-green-bright" : "bg-red-500/10 text-red-400"}`}>
                            {pick.recommendation}
                          </span>
                        </div>
                        <p className="text-white text-xs font-medium leading-snug line-clamp-2 mb-2">{pick.event}</p>
                        <div className="flex items-center justify-between text-xs text-text-dim">
                          <span>{pick.platform}</span>
                          <span>{pick.confidence_level}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Analyze Your Bet</h1>
              <p className="text-text-dim">
                Upload a screenshot from any prediction market — we&apos;ll grade it instantly.
              </p>
            </div>

            {/* Free tier badge */}
            {subStatus === "free" && (
              <div className="mb-6 p-4 rounded-xl bg-[#00dc82]/10 border border-[#00dc82]/25 flex items-center gap-3">
                <Zap size={16} className="text-green-bright shrink-0" />
                <p className="text-green-bright text-sm font-medium">
                  1 free analysis included — no credit card required
                </p>
              </div>
            )}

            {!preview ? (
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                  dragActive
                    ? "border-green-bright bg-green-dim"
                    : "border-border-subtle hover:border-green-bright/40 hover:bg-card"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-green-dim border border-green-bright/20 flex items-center justify-center">
                    <Upload className="text-green-bright" size={28} />
                  </div>
                  <div>
                    <p className="text-white font-semibold mb-1">Drop your screenshot here</p>
                    <p className="text-text-dim text-sm">
                      or <span className="text-green-bright">browse files</span> · PNG, JPG, WEBP up to 10MB
                    </p>
                  </div>
                  <p className="text-xs text-text-dim">Works with Kalshi, Polymarket, PredictIt, and any other platform</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-border-subtle bg-card">
                  <button onClick={clearImage} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors">
                    <X size={14} className="text-white" />
                  </button>
                  <img src={preview} alt="Bet screenshot" className="w-full max-h-80 object-contain" />
                </div>

                {!result && (
                  <button
                    onClick={analyze}
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-green-bright text-[#070d1a] font-bold text-base hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <><Zap size={18} /> Analyze Bet</>
                    )}
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Pro subscription card — shown for upgradeRequired users without a result */}
            {subStatus === "upgradeRequired" && !result && (
              <div className="mt-6 rounded-2xl border border-green-bright/30 bg-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-white font-semibold mb-0.5">Go unlimited with FadeMe Pro</p>
                    <p className="text-text-dim text-sm">
                      <span className="text-white font-bold">$1</span> first week, then $19.99/month — cancel anytime
                    </p>
                  </div>
                  <button
                    onClick={startCheckout}
                    disabled={checkoutLoading}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-bright text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60"
                  >
                    {checkoutLoading ? (
                      <span className="inline-block w-3.5 h-3.5 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                    ) : (
                      <Zap size={13} />
                    )}
                    {checkoutLoading ? "Redirecting..." : "$1 First Week"}
                  </button>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 mb-3">
                  {[
                    "Unlimited screenshot analyses",
                    "Daily AI picks (Kalshi, Polymarket)",
                    "AI edge detection & grading (S–F)",
                    "Bull case, bear case & key risks",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/70">
                      <CheckCircle size={11} className="text-green-bright shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {checkoutError && (
                  <p className="text-red-400 text-xs mb-2">{checkoutError}</p>
                )}
                <p className="text-xs text-text-dim">
                  Already subscribed?{" "}
                  <button
                    onClick={restoreSubscription}
                    disabled={syncLoading}
                    className="text-white underline underline-offset-2 hover:text-green-bright transition-colors disabled:opacity-50"
                  >
                    {syncLoading ? "Restoring..." : "Restore subscription"}
                  </button>
                  {syncError && <span className="text-red-400 ml-2">{syncError}</span>}
                </p>
              </div>
            )}

            {result && (
              <div className="mt-8 space-y-5">
                {result.hasLiveContext && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-xs text-blue-400 font-medium">Powered by live web data</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-2xl border ${gradeStyle.border} ${gradeStyle.bg} ${gradeStyle.glow} p-6 flex flex-col items-center justify-center gap-2`}>
                    <p className="text-text-dim text-xs uppercase tracking-widest font-medium">Grade</p>
                    <p className={`text-7xl font-black ${gradeStyle.text}`}>{grade}</p>
                    <p className={`text-sm font-medium ${gradeStyle.text}`}>{result.analysis.gradeLabel}</p>
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-card p-6 flex flex-col items-center justify-center gap-3">
                    <p className="text-text-dim text-xs uppercase tracking-widest font-medium">Recommendation</p>
                    <div className={`w-14 h-14 rounded-2xl ${recStyle.bg} flex items-center justify-center`}>
                      <RecIcon size={28} className={recStyle.color} />
                    </div>
                    <p className={`text-2xl font-black ${recStyle.color}`}>{rec}</p>
                    <p className="text-text-dim text-xs text-center leading-snug">{result.analysis.recommendationReason}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-4">
                  <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">Probability Assessment</h3>
                  <div className="space-y-3">
                    <ProbBar label="Market Implied" value={result.detected.impliedProbability} color="bg-blue-500" />
                    <ProbBar label="AI True Estimate" value={result.analysis.trueOdds} color="bg-green-bright" />
                  </div>
                  <div className="pt-2 flex items-center justify-between text-sm">
                    <span className="text-text-dim">Edge</span>
                    <span className={`font-bold ${result.analysis.trueOdds > result.detected.impliedProbability ? "text-green-bright" : "text-red-400"}`}>
                      {result.analysis.trueOdds > result.detected.impliedProbability ? "+" : ""}
                      {(result.analysis.trueOdds - result.detected.impliedProbability).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-card p-6">
                  <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest mb-4">Detected Bet</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Platform" value={result.detected.platform} />
                    <DetailRow label="Category" value={result.detected.category} />
                    <DetailRow label="Position" value={result.detected.position} />
                    <DetailRow label="Odds" value={result.detected.odds} />
                    <DetailRow label="Stake" value={result.detected.stake} />
                    <DetailRow label="Payout" value={result.detected.potentialPayout} />
                  </div>
                  <div className="mt-3 pt-3 border-t border-border-subtle">
                    <p className="text-xs text-text-dim mb-1">Event</p>
                    <p className="text-sm text-white leading-snug">{result.detected.event}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-4">
                  <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">Analysis</h3>
                  <p className="text-white/80 text-sm leading-relaxed">{result.analysis.summary}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <CaseCard type="bull" text={result.analysis.bullCase} />
                    <CaseCard type="bear" text={result.analysis.bearCase} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-3">
                  <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">Key Risks</h3>
                  {result.analysis.keyRisks.map((risk, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle size={11} className="text-orange-400" />
                      </div>
                      <p className="text-sm text-white/80 leading-snug">{risk}</p>
                    </div>
                  ))}
                </div>

                {result.analysis.marketInefficiency && (
                  <div className="rounded-2xl border border-green-bright/20 bg-green-dim p-5 flex items-start gap-3">
                    <Shield size={18} className="text-green-bright shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-green-bright font-semibold uppercase tracking-wider mb-1">Market Insight</p>
                      <p className="text-sm text-white/80 leading-snug">{result.analysis.marketInefficiency}</p>
                    </div>
                  </div>
                )}

                {(result.analysis.entryStrategy || result.analysis.exitStrategy) && (
                  <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">Entry & Exit Strategy</h3>
                    {result.analysis.entryStrategy && (
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-green-bright/10 flex items-center justify-center shrink-0 mt-0.5">
                          <LogIn size={13} className="text-green-bright" />
                        </div>
                        <div>
                          <p className="text-xs text-green-bright font-semibold uppercase tracking-wider mb-1">When to enter</p>
                          <p className="text-sm text-white/80 leading-snug">{result.analysis.entryStrategy}</p>
                        </div>
                      </div>
                    )}
                    {result.analysis.exitStrategy && (
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <LogOut size={13} className="text-red-400" />
                        </div>
                        <div>
                          <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-1">When to walk away</p>
                          <p className="text-sm text-white/80 leading-snug">{result.analysis.exitStrategy}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-text-dim text-sm">
                    Confidence: <span className="text-white">{result.analysis.confidenceLevel}</span>
                  </p>
                  {subStatus === "active" && (
                    <button onClick={clearImage} className="flex items-center gap-1 text-sm text-green-bright hover:brightness-110 transition-colors">
                      Analyze another <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Past Analyses gallery — subscribers only */}
            {subStatus === "active" && recentAnalyses.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-text-dim" />
                    <span className="text-sm font-semibold text-white">Past Analyses</span>
                  </div>
                  <Link href="/history" className="flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors">
                    View all <ChevronRight size={12} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {recentAnalyses.map((a) => {
                    const gs = GRADE_CONFIG[a.grade ?? "C"] ?? GRADE_CONFIG["C"];
                    const rec = a.recommendation ?? "HOLD";
                    const rs = REC_CONFIG[rec];
                    const RecIcon = rs?.icon ?? Minus;
                    const isCorrect = a.outcome === "correct";
                    return (
                      <Link
                        key={a.id}
                        href="/history"
                        className={`relative rounded-xl border ${gs.border} ${gs.bg} p-3 block hover:brightness-110 transition-all overflow-hidden ${
                          isCorrect ? "shadow-[0_0_12px_rgba(0,220,130,0.12)]" : ""
                        }`}
                      >
                        {isCorrect && (
                          <div className="absolute inset-0 bg-[#00dc82]/10 pointer-events-none" />
                        )}
                        {isCorrect && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#00dc82] flex items-center justify-center">
                            <CheckCircle size={8} className="text-[#070d1a]" />
                          </div>
                        )}
                        <div className="relative">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xl font-black ${gs.text}`}>{a.grade ?? "C"}</span>
                            <span className={`text-xs font-bold flex items-center gap-0.5 ${
                              rec === "BUY" ? "text-[#00dc82]" : rec === "FADE" ? "text-red-400" : "text-yellow-400"
                            }`}>
                              <RecIcon size={10} />{rec}
                            </span>
                          </div>
                          <p className="text-white text-xs font-medium leading-snug line-clamp-2 mb-1.5">{a.event || "Unknown"}</p>
                          <p className="text-text-dim text-xs">{a.platform || ""}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sticky conversion banner — shown after free analysis result */}
            {result && subStatus === "upgradeRequired" && (
              <div className="sticky bottom-4 z-10 rounded-2xl border border-[#00dc82]/40 bg-[#070d1a]/95 backdrop-blur-md p-4 flex flex-col gap-2 shadow-[0_0_30px_rgba(0,220,130,0.1)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold text-sm">You&apos;ve used your free analysis</p>
                    <p className="text-text-dim text-xs">
                      Get unlimited analyses + daily AI picks for $1/week ·{" "}
                      <button onClick={restoreSubscription} disabled={syncLoading} className="underline underline-offset-2 hover:text-white transition-colors disabled:opacity-50">
                        {syncLoading ? "Restoring..." : "Already subscribed?"}
                      </button>
                    </p>
                  </div>
                  <button
                    onClick={startCheckout}
                    disabled={checkoutLoading}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {checkoutLoading ? (
                      <span className="inline-block w-3.5 h-3.5 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                    ) : (
                      <Zap size={13} />
                    )}
                    $1 First Week
                  </button>
                </div>
                {(checkoutError || syncError) && (
                  <p className="text-red-400 text-xs">{checkoutError ?? syncError}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-text-dim">{label}</span>
        <span className="text-white font-medium">{value?.toFixed(1) ?? "—"}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(value ?? 0, 100)}%` }} />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-dim mb-0.5">{label}</p>
      <p className="text-sm text-white font-medium">{value || "—"}</p>
    </div>
  );
}

function CaseCard({ type, text }: { type: "bull" | "bear"; text: string }) {
  const isBull = type === "bull";
  return (
    <div className={`rounded-xl p-4 ${isBull ? "bg-green-bright/5 border border-green-bright/15" : "bg-red-500/5 border border-red-500/15"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isBull ? "text-green-bright" : "text-red-400"}`}>
        {isBull ? "Bull Case" : "Bear Case"}
      </p>
      <p className="text-sm text-white/75 leading-snug">{text}</p>
    </div>
  );
}
