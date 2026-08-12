"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  X,
  Zap,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  Shield,
  ChevronRight,
  ChevronDown,
  Layers,
  Calculator,
  DollarSign,
  History,
  Wand2,
  AlertTriangle,
} from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import MobileNav from "@/components/MobileNav";
import { useBankroll, type KellyFraction } from "@/hooks/useKelly";

interface ParlayLeg {
  event: string;
  position: string;
  impliedProbability: number;
  trueProbability: number;
  edge: number;
  legRecommendation: "KEEP" | "REMOVE";
  reason: string;
}

interface ParlayAnalysis {
  platform: string;
  parlayType: string;
  stake: string;
  potentialPayout: string;
  stakeAmount: number;
  payoutAmount: number;
  legs: ParlayLeg[];
  parlayImpliedProbability: number;
  combinedTrueProbability: number;
  parlayEdge: number;
  overallRecommendation: "BUY" | "FADE" | "HOLD";
  overallGrade: string;
  overallSummary: string;
  legsToRemove: string[];
  optimizationNote: string;
}

const GRADE_CONFIG: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  S: { bg: "bg-[#00dc82]/10", border: "border-[#00dc82]", text: "text-[#00dc82]", glow: "grade-s" },
  A: { bg: "bg-[#00c86e]/10", border: "border-[#00c86e]", text: "text-[#00c86e]", glow: "grade-a" },
  B: { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-400", glow: "grade-b" },
  C: { bg: "bg-yellow-500/10", border: "border-yellow-500", text: "text-yellow-400", glow: "grade-c" },
  D: { bg: "bg-orange-500/10", border: "border-orange-500", text: "text-orange-400", glow: "grade-d" },
  F: { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-400", glow: "grade-f" },
};

const REC_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bg: string }> = {
  BUY:  { icon: TrendingUp,   color: "text-[#00dc82]", bg: "bg-[#00dc82]/10" },
  HOLD: { icon: Minus,        color: "text-yellow-400", bg: "bg-yellow-400/10" },
  FADE: { icon: TrendingDown, color: "text-red-400",    bg: "bg-red-400/10" },
};

type SubStatus = "loading" | "active" | "upgradeRequired";

interface HistoryEntry extends ParlayAnalysis {
  analyzedAt: Date;
}

interface PickForBuild {
  id: string;
  event: string;
  position: string;
  platform: string;
  grade: string;
  recommendation: string;
  edge_score: number | null;
  implied_probability: number | null;
  true_odds: number | null;
}

interface ParlayBuildLeg {
  event: string;
  position: string;
  platform: string;
  grade: string;
  recommendation: string;
  impliedProbability: number;
  trueProbability: number;
  edge: number;
  assessment: string;
  keepOrRemove: "KEEP" | "REMOVE";
}

interface ParlayBuildResult {
  grade: string;
  platform: string;
  recommendation: "BUY" | "FADE" | "HOLD";
  recommendationReason: string;
  parlayNarrative: string;
  combinedTrueProbability: number;
  combinedImpliedProbability: number;
  parlayEdge: number;
  correlationRisks: string[];
  legs: ParlayBuildLeg[];
  optimizationNote: string;
}

export default function ParlayPage() {
  const [activeTab, setActiveTab] = useState<"analyze" | "build">("analyze");
  const [subStatus, setSubStatus] = useState<SubStatus>("loading");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParlayAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => setSubStatus(d.active ? "active" : "upgradeRequired"))
      .catch(() => setSubStatus("upgradeRequired"));
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
        setCheckoutError(data.error ?? "Checkout failed. Please try again.");
      }
    } catch {
      setCheckoutLoading(false);
      setCheckoutError("Something went wrong. Please try again.");
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
        setSyncError(data.message ?? "No active subscription found.");
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
    reader.onerror = () => setError("Failed to read file. Please try again.");
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

  const clearImage = () => {
    setPreview(null);
    setImageData(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAnalyzeAnother = () => {
    if (result) {
      setHistory((prev) => [{ ...result, analyzedAt: new Date() }, ...prev.slice(0, 9)]);
    }
    clearImage();
  };

  const analyze = async () => {
    if (!imageData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-parlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData.base64, mimeType: imageData.mimeType }),
      });
      const data = await res.json();
      if (res.status === 403 && data.upgradeRequired) {
        setSubStatus("upgradeRequired");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const grade = result?.overallGrade ?? "C";
  const gradeStyle = GRADE_CONFIG[grade] ?? GRADE_CONFIG["C"];
  const rec = result?.overallRecommendation ?? "HOLD";
  const recStyle = REC_CONFIG[rec] ?? REC_CONFIG["HOLD"];
  const RecIcon = recStyle.icon;

  const legs = Array.isArray(result?.legs) ? result.legs : [];
  const keepLegs = legs.filter((l) => l.legRecommendation === "KEEP");
  const removeLegs = legs.filter((l) => l.legRecommendation === "REMOVE");
  const trimmedTrueProbability = keepLegs.length > 0
    ? keepLegs.reduce((acc, l) => acc * ((l.trueProbability ?? 0) / 100), 1) * 100
    : 0;

  return (
    <div className="min-h-screen bg-bg">
      {subStatus === "active" && <MobileNav activeTab="parlay" />}
      <DashboardNav activeTab="parlay" />

      <div className="max-w-4xl mx-auto px-4 py-10 pb-24 sm:pb-10">
        {subStatus === "loading" && (
          <div className="flex items-center justify-center py-32">
            <div className="w-6 h-6 border-2 border-white/10 border-t-green-bright rounded-full animate-spin" />
          </div>
        )}

        {subStatus === "upgradeRequired" && (
          <div className="max-w-lg mx-auto mt-16">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[#00dc82]/10 border border-[#00dc82]/20 flex items-center justify-center mb-4">
                <Layers size={28} className="text-[#00dc82]" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Parlay Analyzer</h1>
              <p className="text-text-dim text-sm">
                Upload any parlay screenshot and get an instant breakdown — which legs are value, which are dragging you down, and the true combined probability vs what the book is offering.
              </p>
            </div>
            <div className="rounded-2xl border border-[#00dc82]/30 bg-card p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-white font-semibold mb-0.5">FadeMe Pro required</p>
                  <p className="text-text-dim text-sm">
                    <span className="text-white font-bold">$1</span> first week, then $19.99/month
                  </p>
                </div>
                <button
                  onClick={startCheckout}
                  disabled={checkoutLoading}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60"
                >
                  {checkoutLoading ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                  ) : (
                    <Zap size={13} />
                  )}
                  {checkoutLoading ? "Redirecting..." : "$1 First Week"}
                </button>
              </div>
              <ul className="space-y-1.5 mb-3">
                {[
                  "Per-leg KEEP / REMOVE recommendations",
                  "True combined probability vs payout implied probability",
                  "Identifies weak links dragging down your parlay",
                  "Optimized trimmed parlay suggestion",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/70">
                    <CheckCircle size={11} className="text-[#00dc82] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {checkoutError && <p className="text-red-400 text-xs mb-2">{checkoutError}</p>}
              <p className="text-xs text-text-dim">
                Already subscribed?{" "}
                <button
                  onClick={restoreSubscription}
                  disabled={syncLoading}
                  className="text-white underline underline-offset-2 hover:text-[#00dc82] transition-colors disabled:opacity-50"
                >
                  {syncLoading ? "Restoring..." : "Restore subscription"}
                </button>
                {syncError && <span className="text-red-400 ml-2">{syncError}</span>}
              </p>
            </div>
          </div>
        )}

        {subStatus === "active" && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-2">Parlay Tools</h1>
              <p className="text-text-dim">Analyze an existing parlay or build one from today&apos;s top picks.</p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-8 max-w-xs">
              {([
                { key: "analyze", label: "Analyze", icon: Layers },
                { key: "build", label: "Build", icon: Wand2 },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === key
                      ? "bg-[#00dc82] text-[#070d1a]"
                      : "text-text-dim hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "analyze" && (
            <>
            <div className="sr-only">
              <p>Upload a screenshot of your parlay — we&apos;ll grade every leg and tell you which ones to cut.</p>
            </div>

            {!result && (
              !preview ? (
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                    dragActive
                      ? "border-[#00dc82] bg-[#00dc82]/5"
                      : "border-border-subtle hover:border-[#00dc82]/40 hover:bg-card"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#00dc82]/10 border border-[#00dc82]/20 flex items-center justify-center">
                      <Upload className="text-[#00dc82]" size={28} />
                    </div>
                    <div>
                      <p className="text-white font-semibold mb-1">Drop your parlay screenshot here</p>
                      <p className="text-text-dim text-sm">
                        or <span className="text-[#00dc82]">browse files</span> · PNG, JPG, WEBP up to 10MB
                      </p>
                    </div>
                    <p className="text-xs text-text-dim">Works with FanDuel, DraftKings, Betway, Kalshi combos, and any other platform</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden border border-border-subtle bg-card">
                    <button
                      onClick={clearImage}
                      className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <X size={14} className="text-white" />
                    </button>
                    <img src={preview} alt="Parlay screenshot" className="w-full max-h-80 object-contain" />
                  </div>
                  <button
                    onClick={analyze}
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-base hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                        Analyzing parlay...
                      </>
                    ) : (
                      <><Layers size={18} /> Analyze Parlay</>
                    )}
                  </button>
                </div>
              )
            )}

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {result && (
              <div className="mt-8 space-y-5">
                {/* Overall verdict */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-2xl border ${gradeStyle.border} ${gradeStyle.bg} ${gradeStyle.glow} p-6 flex flex-col items-center justify-center gap-2`}>
                    <p className="text-text-dim text-xs uppercase tracking-widest font-medium">Parlay Grade</p>
                    <p className={`text-7xl font-black ${gradeStyle.text}`}>{grade}</p>
                    <p className="text-text-dim text-xs text-center">{result.parlayType}</p>
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-card p-6 flex flex-col items-center justify-center gap-3">
                    <p className="text-text-dim text-xs uppercase tracking-widest font-medium">Verdict</p>
                    <div className={`w-14 h-14 rounded-2xl ${recStyle.bg} flex items-center justify-center`}>
                      <RecIcon size={28} className={recStyle.color} />
                    </div>
                    <p className={`text-2xl font-black ${recStyle.color}`}>{rec}</p>
                    <p className="text-text-dim text-xs text-center leading-snug">{result.platform}</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-2xl border border-border-subtle bg-card p-6">
                  <p className="text-white/80 text-sm leading-relaxed">{result.overallSummary}</p>
                </div>

                {/* The Math */}
                <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-4">
                  <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">The Math</h3>

                  <div className="grid grid-cols-3 gap-3">
                    <MathStat
                      label="Payout Implied"
                      value={`${(result.parlayImpliedProbability ?? 0).toFixed(2)}%`}
                      caption="break-even probability"
                      color="text-blue-400"
                    />
                    <MathStat
                      label="True Combined"
                      value={`${(result.combinedTrueProbability ?? 0).toFixed(2)}%`}
                      caption="all legs multiplied"
                      color="text-[#00dc82]"
                    />
                    <MathStat
                      label="Parlay Edge"
                      value={`${(result.parlayEdge ?? 0) >= 0 ? "+" : ""}${(result.parlayEdge ?? 0).toFixed(2)}%`}
                      caption={(result.parlayEdge ?? 0) >= 0 ? "you have edge" : "book has edge"}
                      color={(result.parlayEdge ?? 0) >= 0 ? "text-[#00dc82]" : "text-red-400"}
                    />
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <ProbBarDuo
                      label="Payout implied probability"
                      value={result.parlayImpliedProbability ?? 0}
                      color="bg-blue-500"
                      scale={Math.max(result.parlayImpliedProbability ?? 0, result.combinedTrueProbability ?? 0) * 2}
                    />
                    <ProbBarDuo
                      label="True combined probability"
                      value={result.combinedTrueProbability ?? 0}
                      color="bg-[#00dc82]"
                      scale={Math.max(result.parlayImpliedProbability ?? 0, result.combinedTrueProbability ?? 0) * 2}
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs text-text-dim border-t border-border-subtle">
                    <span>{result.stake} stake</span>
                    <span className="text-white font-semibold">{result.stake} pays {result.potentialPayout}</span>
                  </div>
                </div>

                {/* Kelly sizing — shown whenever stake/payout data is available */}
                {(result.payoutAmount ?? 0) > 0 && (result.stakeAmount ?? 0) > 0 && (
                  <ParlayKellyCard
                    combinedTrueProbability={result.combinedTrueProbability ?? 0}
                    stakeAmount={result.stakeAmount}
                    payoutAmount={result.payoutAmount}
                    recommendation={result.overallRecommendation}
                  />
                )}

                {/* Per-leg breakdown */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">Leg Breakdown</h3>

                  {legs.map((leg, i) => {
                    const keep = leg.legRecommendation === "KEEP";
                    return (
                      <div
                        key={i}
                        className={`rounded-xl border p-4 ${
                          keep
                            ? "border-[#00dc82]/25 bg-[#00dc82]/5"
                            : "border-red-500/25 bg-red-500/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium leading-snug">{leg.event}</p>
                            <p className="text-text-dim text-xs mt-0.5">{leg.position}</p>
                          </div>
                          <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                            keep
                              ? "bg-[#00dc82]/15 text-[#00dc82]"
                              : "bg-red-500/15 text-red-400"
                          }`}>
                            {keep ? "KEEP" : "REMOVE"}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <LegStat label="Market Implied" value={`${leg.impliedProbability}%`} />
                          <LegStat label="True Estimate" value={`${leg.trueProbability}%`} highlight={keep} />
                          <LegStat
                            label="Edge"
                            value={`${(leg.edge ?? 0) >= 0 ? "+" : ""}${(leg.edge ?? 0).toFixed(1)}%`}
                            positive={(leg.edge ?? 0) >= 0}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <MiniProbBar label="Implied" value={leg.impliedProbability} color="bg-white/20" />
                          <MiniProbBar label="True" value={leg.trueProbability} color={keep ? "bg-[#00dc82]" : "bg-red-400"} />
                        </div>

                        <p className="text-xs text-text-dim mt-3 leading-snug">{leg.reason}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Optimization advice */}
                {removeLegs.length > 0 && (
                  <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-5 flex items-start gap-3">
                    <Shield size={18} className="text-[#00dc82] shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-xs text-[#00dc82] font-semibold uppercase tracking-wider">Optimization</p>
                      <p className="text-sm text-white/80 leading-snug">{result.optimizationNote}</p>
                      {keepLegs.length > 0 && (
                        <div className="pt-2 border-t border-[#00dc82]/15">
                          <p className="text-xs text-text-dim mb-1.5">Trimmed parlay ({keepLegs.length} legs):</p>
                          <div className="space-y-1">
                            {keepLegs.map((l, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <p className="text-xs text-white/70 leading-snug">{l.event}</p>
                                <span className="text-xs text-[#00dc82] font-medium shrink-0">{l.trueProbability}%</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 pt-2 border-t border-[#00dc82]/15 flex items-center justify-between text-xs">
                            <span className="text-text-dim">Trimmed combined true probability</span>
                            <span className="text-[#00dc82] font-bold">{trimmedTrueProbability.toFixed(2)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-text-dim text-sm">
                    {legs.length} legs · {keepLegs.length} keep · {removeLegs.length} remove
                  </p>
                  <button
                    onClick={handleAnalyzeAnother}
                    className="flex items-center gap-1 text-sm text-[#00dc82] hover:brightness-110 transition-colors"
                  >
                    Analyze another <ChevronRight size={14} />
                  </button>
                </div>

                <p className="text-text-dim text-xs leading-relaxed border-t border-border-subtle pt-4">
                  <span className="text-white font-semibold">Important:</span> This analysis is for informational purposes only and is not financial advice. You can lose 100% of your money in prediction markets and sports betting. FadeMe helps you make more informed decisions — it does not guarantee any outcome. Never bet money you can&apos;t afford to lose.
                </p>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="mt-10 space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-border-subtle">
                  <History size={14} className="text-text-dim" />
                  <h3 className="text-sm text-text-dim uppercase tracking-widest font-semibold">Previous Parlays</h3>
                </div>
                {history.map((entry, i) => (
                  <ParlayHistoryCard key={i} entry={entry} />
                ))}
              </div>
            )}
            </>
            )} {/* end analyze tab */}

            {activeTab === "build" && (
              <ParlayBuilderTab />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ParlayKellyCard({
  combinedTrueProbability,
  stakeAmount,
  payoutAmount,
  recommendation,
}: {
  combinedTrueProbability: number;
  stakeAmount: number;
  payoutAmount: number;
  recommendation: "BUY" | "FADE" | "HOLD";
}) {
  const [bankroll, setBankroll] = useBankroll();
  const [rawBankroll, setRawBankroll] = useState("");
  const [fraction, setFraction] = useState<KellyFraction>("half");

  useEffect(() => {
    if (bankroll > 0 && rawBankroll === "") setRawBankroll(String(bankroll));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankroll]);

  const trueP = (combinedTrueProbability ?? 0) / 100;
  // b = net odds: stake $stakeAmount, net win = payoutAmount - stakeAmount
  const b = stakeAmount > 0 ? (payoutAmount - stakeAmount) / stakeAmount : 0;
  // Kelly for parlay: f* = (b*p - (1-p)) / b = p - (1-p)/b
  const rawKelly = b > 0 ? trueP - (1 - trueP) / b : -1;
  const kellyFrac = Math.max(0, Math.min(1, rawKelly));
  const hasEdge = rawKelly > 0.001;

  const multiplier = fraction === "full" ? 1 : fraction === "half" ? 0.5 : 0.25;
  const wager = bankroll * kellyFrac * multiplier;
  const netProfit = wager * b;

  const fractions: { key: KellyFraction; label: string }[] = [
    { key: "quarter", label: "¼ Kelly" },
    { key: "half", label: "½ Kelly" },
    { key: "full", label: "Full Kelly" },
  ];

  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator size={15} className="text-[#00dc82]" />
        <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">Kelly Parlay Sizing</h3>
      </div>
      <p className="text-xs text-text-dim leading-snug">
        Kelly formula for parlays: <span className="text-white font-mono">f = p − (1−p) / b</span> where p = true combined probability and b = net payout odds ({stakeAmount > 0 ? ((payoutAmount - stakeAmount) / stakeAmount).toFixed(1) : "—"}×).
      </p>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-border-subtle">
        <DollarSign size={14} className="text-text-dim shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] text-text-dim uppercase tracking-wider mb-0.5 font-medium">Your Bankroll</p>
          <input
            type="number"
            min="1"
            value={rawBankroll}
            onChange={(e) => {
              setRawBankroll(e.target.value);
              const n = parseFloat(e.target.value);
              setBankroll(!isNaN(n) && n > 0 ? n : 0);
            }}
            placeholder="e.g. 500"
            className="w-full bg-transparent text-white text-sm placeholder:text-text-dim outline-none"
          />
        </div>
      </div>

      {!hasEdge ? (
        <p className="text-sm text-red-400">
          {recommendation === "FADE"
            ? "Kelly says don't bet this. The book has edge on the combined parlay — walking away is the correct play."
            : "Kelly detects no positive edge on this parlay. Compounded vig often negates individual leg value. Consider placing only the trimmed KEEP legs as a smaller parlay."}
        </p>
      ) : (
        <>
          <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10 w-fit">
            {fractions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFraction(key)}
                className={`text-xs px-3 py-1 rounded-md transition-all font-medium ${
                  fraction === key
                    ? "bg-[#00dc82] text-[#070d1a]"
                    : "text-text-dim hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {bankroll > 0 ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-black text-[#00dc82]">
                  ${wager < 1 ? wager.toFixed(2) : wager.toFixed(0)}
                </p>
                <p className="text-xs text-text-dim mt-1">recommended stake from ${bankroll.toLocaleString()}</p>
              </div>
              <div className="text-right text-sm space-y-1">
                <p className="text-text-dim text-xs">If parlay hits</p>
                <p className="text-[#00dc82] font-bold">+${netProfit < 1 ? netProfit.toFixed(2) : netProfit.toFixed(0)} net profit</p>
                <p className="text-text-dim text-xs">
                  Raw Kelly: <span className="text-white">{(kellyFrac * 100).toFixed(2)}%</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-dim">Enter your bankroll above to see the recommended stake.</p>
          )}
        </>
      )}
    </div>
  );
}

function ParlayBuilderTab() {
  const [buildPlatform, setBuildPlatform] = useState<"Kalshi" | "Polymarket">("Kalshi");
  const [picks, setPicks] = useState<PickForBuild[]>([]);
  const [picksLoading, setPicksLoading] = useState(true);
  const [picksError, setPicksError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildResult, setBuildResult] = useState<ParlayBuildResult | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  const loadPicks = useCallback(() => {
    setPicksLoading(true);
    setPicksError(null);
    fetch("/api/picks")
      .then((r) => r.json())
      .then((d) => {
        const all: PickForBuild[] = (d.picks ?? []).filter(
          (p: Record<string, unknown>) => p.recommendation === "BUY" || p.recommendation === "HOLD"
        );
        setPicks(all);
        // Auto-select the platform that has picks if the default (Kalshi) has none
        const hasKalshi = all.some((p) => p.platform === "Kalshi");
        const hasPolymarket = all.some((p) => p.platform === "Polymarket");
        if (!hasKalshi && hasPolymarket) setBuildPlatform("Polymarket");
      })
      .catch(() => setPicksError("Failed to load today's picks."))
      .finally(() => setPicksLoading(false));
  }, []);

  useEffect(() => { loadPicks(); }, [loadPicks]);

  const platformPicks = picks.filter((p) => p.platform === buildPlatform);

  const togglePick = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 6) {
        next.add(id);
      }
      return next;
    });
    setBuildResult(null);
    setBuildError(null);
  };

  const selectedPicks = platformPicks.filter((p) => selectedIds.has(p.id));
  const combinedTrue = selectedPicks.reduce((acc, p) => acc * ((p.true_odds ?? p.implied_probability ?? 50) / 100), 1) * 100;
  const combinedImplied = selectedPicks.reduce((acc, p) => acc * ((p.implied_probability ?? 50) / 100), 1) * 100;
  const liveEdge = combinedTrue - combinedImplied;

  const buildParlay = async () => {
    if (selectedIds.size < 2) return;
    setBuildLoading(true);
    setBuildError(null);
    setBuildResult(null);
    try {
      const res = await fetch("/api/build-parlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickIds: [...selectedIds] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Build failed");
      setBuildResult(data as ParlayBuildResult);
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBuildLoading(false);
    }
  };

  const resetBuild = () => {
    setSelectedIds(new Set());
    setBuildResult(null);
    setBuildError(null);
  };

  const grade = buildResult?.grade ?? "C";
  const gradeStyle = GRADE_CONFIG[grade] ?? GRADE_CONFIG["C"];
  const rec = buildResult?.recommendation ?? "HOLD";
  const recStyle = REC_CONFIG[rec] ?? REC_CONFIG["HOLD"];
  const RecIcon = recStyle.icon;

  return (
    <div className="space-y-6">
      {/* Platform selector */}
      <div className="flex gap-2">
        {(["Kalshi", "Polymarket"] as const).map((p) => (
          <button
            key={p}
            onClick={() => {
              setBuildPlatform(p);
              setSelectedIds(new Set());
              setBuildResult(null);
              setBuildError(null);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              buildPlatform === p
                ? "bg-[#00dc82]/10 border-[#00dc82]/40 text-[#00dc82]"
                : "border-border-subtle text-text-dim hover:text-white"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {picksLoading && (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-white/10 border-t-green-bright rounded-full animate-spin" />
        </div>
      )}

      {picksError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-300 text-sm">{picksError}</p>
          </div>
          <button
            onClick={loadPicks}
            className="shrink-0 text-xs text-red-400 border border-red-500/40 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!picksLoading && !picksError && (
        <>
          {platformPicks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-dim text-sm">No BUY or HOLD picks for {buildPlatform} today.</p>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-text-dim">
                    Select 2–6 legs to parlay · <span className="text-white">{selectedIds.size} selected</span>
                  </p>
                  {selectedIds.size > 0 && (
                    <button onClick={resetBuild} className="text-xs text-text-dim hover:text-white transition-colors">
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {platformPicks.map((pick) => {
                    const selected = selectedIds.has(pick.id);
                    const disabled = !selected && selectedIds.size >= 6;
                    const gs = GRADE_CONFIG[pick.grade] ?? GRADE_CONFIG["C"];
                    const rs = REC_CONFIG[pick.recommendation] ?? REC_CONFIG["HOLD"];
                    const RIcon = rs.icon;
                    return (
                      <button
                        key={pick.id}
                        onClick={() => !disabled && togglePick(pick.id)}
                        disabled={disabled}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                          selected
                            ? "border-[#00dc82]/50 bg-[#00dc82]/10"
                            : disabled
                            ? "border-border-subtle bg-transparent opacity-40 cursor-not-allowed"
                            : "border-border-subtle bg-transparent hover:bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg ${gs.bg} border ${gs.border} flex items-center justify-center shrink-0`}>
                          <span className={`text-sm font-black ${gs.text}`}>{pick.grade}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium leading-snug truncate">{pick.event}</p>
                          <p className="text-text-dim text-xs mt-0.5">{pick.position || pick.platform}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${rs.bg}`}>
                            <RIcon size={10} className={rs.color} />
                            <span className={`text-[10px] font-bold ${rs.color}`}>{pick.recommendation}</span>
                          </div>
                          <span className="text-xs text-[#00dc82] font-medium">+{Number(pick.edge_score ?? 0).toFixed(1)}%</span>
                          {selected && (
                            <div className="w-5 h-5 rounded-full bg-[#00dc82] flex items-center justify-center">
                              <CheckCircle size={12} className="text-[#070d1a]" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live preview bar */}
              {selectedPicks.length >= 2 && (
                <div className="rounded-xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-4 space-y-3">
                  <p className="text-xs text-[#00dc82] font-semibold uppercase tracking-wider">{selectedPicks.length}-leg parlay preview</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-0.5">True Combined</p>
                      <p className="text-sm font-bold text-[#00dc82]">{combinedTrue.toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-0.5">Market Implied</p>
                      <p className="text-sm font-bold text-blue-400">{combinedImplied.toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-0.5">Parlay Edge</p>
                      <p className={`text-sm font-bold ${liveEdge >= 0 ? "text-[#00dc82]" : "text-red-400"}`}>
                        {liveEdge >= 0 ? "+" : ""}{liveEdge.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={buildParlay}
                    disabled={buildLoading}
                    className="w-full py-3.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {buildLoading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                        Building parlay...
                      </>
                    ) : (
                      <><Wand2 size={16} /> Build Parlay</>
                    )}
                  </button>
                </div>
              )}

              {selectedPicks.length === 1 && (
                <p className="text-center text-text-dim text-sm">Select at least one more leg to build a parlay.</p>
              )}

              {buildError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                  <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-300 text-sm">{buildError}</p>
                </div>
              )}

              {/* Build Result */}
              {buildResult && (
                <div className="space-y-5 mt-2">
                  {/* Grade + verdict */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`rounded-2xl border ${gradeStyle.border} ${gradeStyle.bg} ${gradeStyle.glow} p-6 flex flex-col items-center justify-center gap-2`}>
                      <p className="text-text-dim text-xs uppercase tracking-widest font-medium">Parlay Grade</p>
                      <p className={`text-7xl font-black ${gradeStyle.text}`}>{grade}</p>
                      <p className="text-text-dim text-xs">{buildResult.platform}</p>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-card p-6 flex flex-col items-center justify-center gap-3">
                      <p className="text-text-dim text-xs uppercase tracking-widest font-medium">Verdict</p>
                      <div className={`w-14 h-14 rounded-2xl ${recStyle.bg} flex items-center justify-center`}>
                        <RecIcon size={28} className={recStyle.color} />
                      </div>
                      <p className={`text-2xl font-black ${recStyle.color}`}>{rec}</p>
                    </div>
                  </div>

                  {/* Narrative */}
                  <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-2">
                    <p className="text-white/80 text-sm leading-relaxed">{buildResult.parlayNarrative}</p>
                    <p className="text-text-dim text-xs leading-snug">{buildResult.recommendationReason}</p>
                  </div>

                  {/* Math */}
                  <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">The Math</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <MathStat label="Market Implied" value={`${buildResult.combinedImpliedProbability.toFixed(2)}%`} caption="payout break-even" color="text-blue-400" />
                      <MathStat label="True Combined" value={`${buildResult.combinedTrueProbability.toFixed(2)}%`} caption="all legs multiplied" color="text-[#00dc82]" />
                      <MathStat
                        label="Parlay Edge"
                        value={`${buildResult.parlayEdge >= 0 ? "+" : ""}${buildResult.parlayEdge.toFixed(2)}%`}
                        caption={buildResult.parlayEdge >= 0 ? "you have edge" : "book has edge"}
                        color={buildResult.parlayEdge >= 0 ? "text-[#00dc82]" : "text-red-400"}
                      />
                    </div>
                    <div className="space-y-2.5">
                      <ProbBarDuo label="Market implied probability" value={buildResult.combinedImpliedProbability} color="bg-blue-500" scale={Math.max(buildResult.combinedImpliedProbability, buildResult.combinedTrueProbability) * 2} />
                      <ProbBarDuo label="True combined probability" value={buildResult.combinedTrueProbability} color="bg-[#00dc82]" scale={Math.max(buildResult.combinedImpliedProbability, buildResult.combinedTrueProbability) * 2} />
                    </div>
                  </div>

                  {/* Kelly sizing */}
                  <BuildKellyCard
                    combinedTrueProbability={buildResult.combinedTrueProbability}
                    combinedImpliedProbability={buildResult.combinedImpliedProbability}
                    recommendation={buildResult.recommendation}
                  />

                  {/* Correlation risks */}
                  {buildResult.correlationRisks.length > 0 && (
                    <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 flex items-start gap-3">
                      <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                      <div className="space-y-1.5">
                        <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">Correlation Risks</p>
                        {buildResult.correlationRisks.map((risk, i) => (
                          <p key={i} className="text-sm text-white/75 leading-snug">{risk}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leg breakdown */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">Leg Breakdown</h3>
                    {buildResult.legs.map((leg, i) => {
                      const keep = leg.keepOrRemove === "KEEP";
                      return (
                        <div key={i} className={`rounded-xl border p-4 ${keep ? "border-[#00dc82]/25 bg-[#00dc82]/5" : "border-red-500/25 bg-red-500/5"}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium leading-snug">{leg.event}</p>
                              <p className="text-text-dim text-xs mt-0.5">{leg.position}</p>
                            </div>
                            <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${keep ? "bg-[#00dc82]/15 text-[#00dc82]" : "bg-red-500/15 text-red-400"}`}>
                              {keep ? "KEEP" : "REMOVE"}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-2">
                            <LegStat label="Market" value={`${leg.impliedProbability.toFixed(1)}%`} />
                            <LegStat label="True" value={`${leg.trueProbability.toFixed(1)}%`} highlight={keep} />
                            <LegStat label="Edge" value={`${leg.edge >= 0 ? "+" : ""}${leg.edge.toFixed(1)}%`} positive={leg.edge >= 0} />
                          </div>
                          <p className="text-xs text-text-dim leading-snug">{leg.assessment}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Optimization note */}
                  {buildResult.optimizationNote && (
                    <div className="rounded-2xl border border-[#00dc82]/20 bg-[#00dc82]/5 p-5 flex items-start gap-3">
                      <Shield size={18} className="text-[#00dc82] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-[#00dc82] font-semibold uppercase tracking-wider mb-1">Optimization</p>
                        <p className="text-sm text-white/80 leading-snug">{buildResult.optimizationNote}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={resetBuild}
                    className="flex items-center gap-1 text-sm text-[#00dc82] hover:brightness-110 transition-colors"
                  >
                    Build another <ChevronRight size={14} />
                  </button>

                  <p className="text-text-dim text-xs leading-relaxed border-t border-border-subtle pt-4">
                    <span className="text-white font-semibold">Important:</span> This analysis is for informational purposes only and is not financial advice. Never bet money you can&apos;t afford to lose.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function BuildKellyCard({
  combinedTrueProbability,
  combinedImpliedProbability,
  recommendation,
}: {
  combinedTrueProbability: number;
  combinedImpliedProbability: number;
  recommendation: "BUY" | "FADE" | "HOLD";
}) {
  const [bankroll, setBankroll] = useBankroll();
  const [rawBankroll, setRawBankroll] = useState("");
  const [fraction, setFraction] = useState<KellyFraction>("half");

  useEffect(() => {
    if (bankroll > 0 && rawBankroll === "") setRawBankroll(String(bankroll));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankroll]);

  const trueP = combinedTrueProbability / 100;
  const impliedP = combinedImpliedProbability / 100;
  // Net payout odds: $1 bet at implied prob P pays 1/P - 1 net
  const b = impliedP > 0 ? (1 / impliedP) - 1 : 0;
  const rawKelly = b > 0 ? trueP - (1 - trueP) / b : -1;
  const kellyFrac = Math.max(0, Math.min(1, rawKelly));
  const hasEdge = rawKelly > 0.001;

  const multiplier = fraction === "full" ? 1 : fraction === "half" ? 0.5 : 0.25;
  const wager = bankroll * kellyFrac * multiplier;
  const netProfit = impliedP > 0 ? wager * ((1 / impliedP) - 1) : 0;

  const fractions: { key: KellyFraction; label: string }[] = [
    { key: "quarter", label: "¼ Kelly" },
    { key: "half", label: "½ Kelly" },
    { key: "full", label: "Full Kelly" },
  ];

  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator size={15} className="text-[#00dc82]" />
        <h3 className="font-semibold text-sm text-text-dim uppercase tracking-widest">Kelly Sizing</h3>
      </div>
      <p className="text-xs text-text-dim leading-snug">
        Based on true combined probability of <span className="text-white">{combinedTrueProbability.toFixed(1)}%</span> vs market-implied {combinedImpliedProbability.toFixed(1)}%.
      </p>
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-border-subtle">
        <DollarSign size={14} className="text-text-dim shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] text-text-dim uppercase tracking-wider mb-0.5 font-medium">Your Bankroll</p>
          <input
            type="number"
            min="1"
            value={rawBankroll}
            onChange={(e) => {
              setRawBankroll(e.target.value);
              const n = parseFloat(e.target.value);
              setBankroll(!isNaN(n) && n > 0 ? n : 0);
            }}
            placeholder="e.g. 500"
            className="w-full bg-transparent text-white text-sm placeholder:text-text-dim outline-none"
          />
        </div>
      </div>
      {!hasEdge ? (
        <p className="text-sm text-red-400">
          {recommendation === "FADE"
            ? "Kelly says don't bet this — the book has edge on this parlay combination."
            : "Kelly detects no positive edge after accounting for parlay vig."}
        </p>
      ) : (
        <>
          <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10 w-fit">
            {fractions.map(({ key, label }) => (
              <button key={key} onClick={() => setFraction(key)} className={`text-xs px-3 py-1 rounded-md transition-all font-medium ${fraction === key ? "bg-[#00dc82] text-[#070d1a]" : "text-text-dim hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
          {bankroll > 0 ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-black text-[#00dc82]">${wager < 1 ? wager.toFixed(2) : wager.toFixed(0)}</p>
                <p className="text-xs text-text-dim mt-1">recommended stake from ${bankroll.toLocaleString()}</p>
              </div>
              <div className="text-right text-sm space-y-1">
                <p className="text-text-dim text-xs">If parlay hits</p>
                <p className="text-[#00dc82] font-bold">+${netProfit < 1 ? netProfit.toFixed(2) : netProfit.toFixed(0)} net profit</p>
                <p className="text-text-dim text-xs">Raw Kelly: <span className="text-white">{(kellyFrac * 100).toFixed(2)}%</span></p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-dim">Enter your bankroll above to see the recommended stake.</p>
          )}
        </>
      )}
    </div>
  );
}

function ParlayHistoryCard({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const grade = entry.overallGrade ?? "C";
  const gradeStyle = GRADE_CONFIG[grade] ?? GRADE_CONFIG["C"];
  const recStyle = REC_CONFIG[entry.overallRecommendation] ?? REC_CONFIG["HOLD"];
  const RecIcon = recStyle.icon;
  const legs = Array.isArray(entry.legs) ? entry.legs : [];
  const keepLegs = legs.filter((l) => l.legRecommendation === "KEEP");
  const timeLabel = entry.analyzedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="rounded-2xl border border-border-subtle bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className={`text-lg font-black ${gradeStyle.text} w-6 shrink-0`}>{grade}</span>
        <div className={`w-7 h-7 rounded-lg ${recStyle.bg} flex items-center justify-center shrink-0`}>
          <RecIcon size={14} className={recStyle.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{entry.platform} · {legs.length} legs</p>
          <p className="text-text-dim text-xs">{keepLegs.length} keep · {legs.length - keepLegs.length} remove · analyzed at {timeLabel}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold ${recStyle.color}`}>{entry.overallRecommendation}</span>
          <ChevronDown size={14} className={`text-text-dim transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-subtle pt-3">
          <p className="text-white/70 text-sm leading-relaxed">{entry.overallSummary}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/5 p-2 text-center">
              <p className="text-[10px] text-text-dim uppercase tracking-wider">Implied</p>
              <p className="text-sm font-bold text-blue-400">{(entry.parlayImpliedProbability ?? 0).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-white/5 p-2 text-center">
              <p className="text-[10px] text-text-dim uppercase tracking-wider">True</p>
              <p className="text-sm font-bold text-[#00dc82]">{(entry.combinedTrueProbability ?? 0).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-white/5 p-2 text-center">
              <p className="text-[10px] text-text-dim uppercase tracking-wider">Edge</p>
              <p className={`text-sm font-bold ${(entry.parlayEdge ?? 0) >= 0 ? "text-[#00dc82]" : "text-red-400"}`}>
                {(entry.parlayEdge ?? 0) >= 0 ? "+" : ""}{(entry.parlayEdge ?? 0).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {legs.map((leg, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${leg.legRecommendation === "KEEP" ? "bg-[#00dc82]/15 text-[#00dc82]" : "bg-red-500/15 text-red-400"}`}>
                  {leg.legRecommendation}
                </span>
                <span className="text-white/70 flex-1 truncate">{leg.event}</span>
                <span className="text-text-dim shrink-0">{leg.trueProbability}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MathStat({ label, value, caption, color }: { label: string; value: string; caption: string; color: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-border-subtle p-3 text-center">
      <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-text-dim text-[10px] mt-0.5">{caption}</p>
    </div>
  );
}

function ProbBarDuo({ label, value, color, scale }: { label: string; value: number; color: string; scale: number }) {
  const pct = scale > 0 ? Math.min((value / scale) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-dim">{label}</span>
        <span className="text-white font-medium">{Math.min(value, 100).toFixed(2)}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LegStat({
  label, value, highlight, positive,
}: {
  label: string; value: string; highlight?: boolean; positive?: boolean;
}) {
  const color =
    positive === true ? "text-[#00dc82]" :
    positive === false ? "text-red-400" :
    highlight ? "text-[#00dc82]" : "text-white";
  return (
    <div>
      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function MiniProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-dim w-10 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-[10px] text-text-dim w-8 text-right">{value}%</span>
    </div>
  );
}
