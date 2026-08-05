"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
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
}

interface AnalysisResult {
  detected: DetectedBet;
  analysis: BetAnalysis;
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

type SubStatus = "loading" | "active" | "none";

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
      .then((d) => setSubStatus(d.active ? "active" : "none"));
  }, []);

  const startCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setCheckoutLoading(false);
    } catch {
      setCheckoutLoading(false);
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
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
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
          <span className="text-white font-semibold tracking-tight">
            Fade<span className="text-green-bright">Me</span>
          </span>
          <UserButton />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Success banner */}
        {justSubscribed && (
          <div className="mb-6 p-4 rounded-xl bg-green-bright/10 border border-green-bright/30 flex items-center gap-3">
            <CheckCircle size={18} className="text-green-bright shrink-0" />
            <p className="text-green-bright text-sm font-medium">
              Welcome to FadeMe Pro! Your first month is just $1. Start analyzing below.
            </p>
          </div>
        )}

        {/* Loading */}
        {subStatus === "loading" && (
          <div className="flex items-center justify-center py-32">
            <div className="w-6 h-6 border-2 border-white/10 border-t-green-bright rounded-full animate-spin" />
          </div>
        )}

        {/* Upgrade wall */}
        {subStatus === "none" && (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-green-dim border border-green-bright/20 flex items-center justify-center mx-auto mb-6">
              <Lock size={28} className="text-green-bright" />
            </div>
            <h1 className="text-2xl font-bold mb-3">Unlock FadeMe Pro</h1>
            <p className="text-text-dim mb-8 leading-relaxed">
              Get unlimited AI bet analyses, edge detection, and clear recommendations.
            </p>

            <div className="rounded-2xl border border-green-bright/30 bg-card p-6 mb-6 text-left">
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-black text-white">$1</span>
                <span className="text-text-dim text-sm mb-1">first month</span>
              </div>
              <p className="text-text-dim text-sm mb-5">
                then <span className="text-white font-semibold">$19.99/month</span> — cancel anytime
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  "Unlimited screenshot analyses",
                  "AI edge detection & grading (S–F)",
                  "BUY / HOLD / FADE recommendations",
                  "Bull case, bear case & key risks",
                  "Works with Kalshi, Polymarket, PredictIt & more",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/80">
                    <CheckCircle size={14} className="text-green-bright shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={startCheckout}
                disabled={checkoutLoading}
                className="w-full py-3.5 rounded-xl bg-green-bright text-[#070d1a] font-bold text-base hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checkoutLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                    Redirecting to checkout...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Get Started — $1 First Month
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-text-dim">Secure checkout via Stripe. No hidden fees.</p>
          </div>
        )}

        {/* Full analyzer — subscribers only */}
        {subStatus === "active" && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Analyze Your Bet</h1>
              <p className="text-text-dim">
                Upload a screenshot from any prediction market — we&apos;ll grade it instantly.
              </p>
            </div>

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

            {result && (
              <div className="mt-8 space-y-5">
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

                <div className="flex items-center justify-between pt-2">
                  <p className="text-text-dim text-sm">
                    Confidence: <span className="text-white">{result.analysis.confidenceLevel}</span>
                  </p>
                  <button onClick={clearImage} className="flex items-center gap-1 text-sm text-green-bright hover:brightness-110 transition-colors">
                    Analyze another <ChevronRight size={14} />
                  </button>
                </div>
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
