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
  Layers,
  Calculator,
  DollarSign,
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

export default function ParlayPage() {
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
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Parlay Analyzer</h1>
              <p className="text-text-dim">
                Upload a screenshot of your parlay — we&apos;ll grade every leg and tell you which ones to cut.
              </p>
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

                {/* Kelly sizing — only shown when parlay has positive edge */}
                {result.overallRecommendation === "BUY" && (result.payoutAmount ?? 0) > 0 && (result.stakeAmount ?? 0) > 0 && (
                  <ParlayKellyCard
                    combinedTrueProbability={result.combinedTrueProbability ?? 0}
                    stakeAmount={result.stakeAmount}
                    payoutAmount={result.payoutAmount}
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
                    onClick={clearImage}
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
}: {
  combinedTrueProbability: number;
  stakeAmount: number;
  payoutAmount: number;
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
        <p className="text-sm text-red-400">Kelly detects no positive edge — even a BUY-grade parlay may have a negative Kelly fraction due to compounded vig. Consider placing only the trimmed KEEP legs as a smaller parlay.</p>
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
