"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import MobileNav from "@/components/MobileNav";
import DashboardNav from "@/components/DashboardNav";
import {
  Plus,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  Trash2,
  TrendingUp,
  TrendingDown,
  Camera,
  Link2,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

interface ManualTrade {
  id: string;
  market: string;
  platform: string | null;
  position: string;
  entry_price: number;
  stake: number;
  result: "won" | "lost" | "void" | null;
  notes: string | null;
  created_at: string;
  market_id: string | null;
}

interface Portfolio {
  balance: number;
  pnl: number;
  startingBalance: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number | null;
}

interface ParsedTrade {
  platform: string | null;
  market: string | null;
  position: string | null;
  entry_price: number | null;
  stake: number | null;
  market_id: string | null;
}

type ModalStep = "input" | "parsing" | "confirm" | "saving";
type InputTab = "screenshot" | "url";

const PLATFORMS = ["Kalshi", "Polymarket", "PredictIt", "FanDuel", "Robinhood", "Other"];

function tradePnl(trade: ManualTrade): number | null {
  if (trade.result === null) return null;
  if (trade.result === "won") return (trade.stake * (100 - trade.entry_price)) / trade.entry_price;
  if (trade.result === "lost") return -trade.stake;
  return 0;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ResultBadge({ result }: { result: ManualTrade["result"] }) {
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
  if (result === "void")
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full whitespace-nowrap">
        <MinusCircle size={11} /> Void
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-text-dim bg-white/5 px-2.5 py-1 rounded-full whitespace-nowrap">
      <Clock size={11} /> Pending
    </span>
  );
}

function TradeCard({
  trade,
  onUpdate,
  onDelete,
}: {
  trade: ManualTrade;
  onUpdate: (id: string, result: ManualTrade["result"]) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pnl = tradePnl(trade);
  const pnlPositive = pnl !== null && pnl >= 0;
  const autoResolves = trade.market_id && trade.result === null;

  const mark = async (result: ManualTrade["result"]) => {
    setSaving(true);
    const next = trade.result === result ? null : result;
    try {
      const res = await fetch(`/api/manual-trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: next }),
      });
      if (res.ok) onUpdate(trade.id, next);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/manual-trades/${trade.id}`, { method: "DELETE" });
      if (res.ok) onDelete(trade.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-card overflow-hidden transition-all">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium leading-snug truncate">{trade.market}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <p className="text-text-dim text-xs">
                {[trade.platform, `${trade.position} @ ${trade.entry_price.toFixed(0)}¢`, `$${trade.stake.toLocaleString()} staked`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {autoResolves && (
                <span className="flex items-center gap-1 text-[10px] text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                  <RefreshCw size={8} /> Auto-resolving
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pnl !== null && trade.result !== "void" ? (
              <span className={`text-sm font-bold ${pnlPositive ? "text-[#00dc82]" : "text-red-400"}`}>
                {pnlPositive ? "+" : ""}${fmt(Math.abs(pnl))}
              </span>
            ) : (
              <ResultBadge result={trade.result} />
            )}
            {expanded ? <ChevronUp size={15} className="text-text-dim" /> : <ChevronDown size={15} className="text-text-dim" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-4">
          <div className="flex gap-4 text-xs flex-wrap">
            {trade.platform && (
              <div>
                <p className="text-text-dim mb-0.5">Platform</p>
                <p className="text-white font-medium">{trade.platform}</p>
              </div>
            )}
            <div>
              <p className="text-text-dim mb-0.5">Position</p>
              <p className="text-white font-medium">{trade.position}</p>
            </div>
            <div>
              <p className="text-text-dim mb-0.5">Entry Price</p>
              <p className="text-white font-medium">{trade.entry_price.toFixed(0)}¢</p>
            </div>
            <div>
              <p className="text-text-dim mb-0.5">Staked</p>
              <p className="text-white font-medium">${trade.stake.toLocaleString()}</p>
            </div>
            {trade.result === "won" && pnl !== null && (
              <div>
                <p className="text-text-dim mb-0.5">Profit</p>
                <p className="text-[#00dc82] font-bold">+${fmt(pnl)}</p>
              </div>
            )}
            {trade.result === "lost" && pnl !== null && (
              <div>
                <p className="text-text-dim mb-0.5">Loss</p>
                <p className="text-red-400 font-bold">-${fmt(Math.abs(pnl))}</p>
              </div>
            )}
            {trade.result === null && (
              <div>
                <p className="text-text-dim mb-0.5">If wins</p>
                <p className="text-[#00dc82] font-medium">
                  +${fmt((trade.stake * (100 - trade.entry_price)) / trade.entry_price)}
                </p>
              </div>
            )}
          </div>

          {trade.notes && <p className="text-xs text-text-dim italic leading-snug">{trade.notes}</p>}

          {autoResolves && (
            <p className="text-xs text-blue-400/70">
              This trade will auto-resolve once the market settles.
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-dim mr-1">Mark result:</span>
              {(["won", "lost", "void"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => mark(r)}
                  disabled={saving}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all disabled:opacity-50 ${
                    trade.result === r
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
            </div>
            <button
              onClick={del}
              disabled={deleting}
              className="text-text-dim hover:text-red-400 transition-colors disabled:opacity-50"
              title="Delete trade"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const [trades, setTrades] = useState<ManualTrade[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");

  // Modal state
  const [modalStep, setModalStep] = useState<ModalStep | null>(null);
  const [inputTab, setInputTab] = useState<InputTab>("screenshot");
  const [urlInput, setUrlInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedTrade | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Confirm form state
  const [confirmMarket, setConfirmMarket] = useState("");
  const [confirmPlatform, setConfirmPlatform] = useState("");
  const [confirmPosition, setConfirmPosition] = useState("YES");
  const [confirmPrice, setConfirmPrice] = useState("");
  const [confirmStake, setConfirmStake] = useState("");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmMarketId, setConfirmMarketId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/manual-trades");
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      setTrades(d.trades ?? []);
      setPortfolio(d.portfolio ?? null);
    } catch {
      setError("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => {
    setModalStep(null);
    setUrlInput("");
    setParseError(null);
    setParsed(null);
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setConfirmMarket("");
    setConfirmPlatform("");
    setConfirmPosition("YES");
    setConfirmPrice("");
    setConfirmStake("");
    setConfirmNotes("");
    setConfirmMarketId(null);
    setConfirmError(null);
  };

  const openConfirmWith = (data: ParsedTrade) => {
    setParsed(data);
    setConfirmMarket(data.market ?? "");
    setConfirmPlatform(data.platform ?? "");
    setConfirmPosition(data.position ?? "YES");
    setConfirmPrice(data.entry_price != null ? String(data.entry_price) : "");
    setConfirmStake(data.stake != null ? String(data.stake) : "");
    setConfirmMarketId(data.market_id ?? null);
    setModalStep("confirm");
  };

  const handleFileChange = async (file: File) => {
    setParseError(null);
    setModalStep("parsing");

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);

    const reader = new FileReader();
    reader.onerror = () => {
      setParseError("Failed to read file. Please try again.");
      setModalStep("input");
    };
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      const mimeType = file.type || "image/jpeg";

      try {
        const res = await fetch("/api/manual-trades/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (!res.ok) {
          setParseError(data.error ?? "Failed to parse image");
          setModalStep("input");
          return;
        }
        openConfirmWith(data);
      } catch {
        setParseError("Something went wrong. Try again.");
        setModalStep("input");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlParse = async () => {
    if (!urlInput.trim()) return;
    setParseError(null);
    setModalStep("parsing");

    try {
      const res = await fetch("/api/manual-trades/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error ?? "Failed to fetch market");
        setModalStep("input");
        return;
      }
      openConfirmWith(data);
    } catch {
      setParseError("Something went wrong. Try again.");
      setModalStep("input");
    }
  };

  const handleSave = async () => {
    setConfirmError(null);
    const price = parseFloat(confirmPrice);
    const amount = parseFloat(confirmStake);
    if (!confirmMarket.trim()) { setConfirmError("Market name is required."); return; }
    if (isNaN(price) || price <= 0 || price >= 100) { setConfirmError("Entry price must be between 1 and 99."); return; }
    if (isNaN(amount) || amount <= 0) { setConfirmError("Stake must be a positive number."); return; }

    setModalStep("saving");
    try {
      const res = await fetch("/api/manual-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: confirmMarket,
          platform: confirmPlatform || null,
          position: confirmPosition,
          entry_price: price,
          stake: amount,
          notes: confirmNotes || null,
          market_id: confirmMarketId || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setConfirmError(d.error ?? "Failed to save trade."); setModalStep("confirm"); return; }
      setTrades((prev) => [d.trade, ...prev]);
      setPortfolio((prev) => prev ? { ...prev, pending: prev.pending + 1 } : prev);
      closeModal();
      load();
    } catch {
      setConfirmError("Something went wrong. Try again.");
      setModalStep("confirm");
    }
  };

  const handleUpdate = useCallback((id: string, result: ManualTrade["result"]) => {
    setTrades((prev) => prev.map((t) => t.id === id ? { ...t, result } : t));
    if (result !== null) setActiveTab("resolved");
    load();
  }, [load]);

  const handleDelete = useCallback((id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
    load();
  }, [load]);

  const pnlPositive = (portfolio?.pnl ?? 0) >= 0;

  const potentialProfit = (() => {
    const price = parseFloat(confirmPrice);
    const amount = parseFloat(confirmStake);
    if (isNaN(price) || isNaN(amount) || price <= 0 || price >= 100 || amount <= 0) return null;
    return (amount * (100 - price)) / price;
  })();

  return (
    <div className="min-h-screen bg-bg">
      {!loading && !error && <MobileNav activeTab="portfolio" />}

      <DashboardNav activeTab="portfolio" />

      <div className="max-w-3xl mx-auto px-4 py-8 pb-32 sm:pb-10">
        {portfolio && (
          <div className="rounded-2xl border border-border-subtle bg-card px-6 py-5 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-text-dim uppercase tracking-wider mb-1 font-medium">Balance</p>
                <p className="text-3xl font-black text-white">${fmt(portfolio.balance)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-dim uppercase tracking-wider mb-1 font-medium">P&amp;L</p>
                <p className={`text-3xl font-black ${pnlPositive ? "text-[#00dc82]" : "text-red-400"}`}>
                  {pnlPositive ? "+" : "−"}${fmt(Math.abs(portfolio.pnl))}
                </p>
              </div>
            </div>
            {(portfolio.wins + portfolio.losses > 0 || portfolio.pending > 0) && (
              <div className="flex gap-4 text-xs text-text-dim mt-4 pt-4 border-t border-white/5">
                <span>{portfolio.wins}W · {portfolio.losses}L</span>
                {portfolio.winRate !== null && <span>{portfolio.winRate}% win rate</span>}
                {portfolio.pending > 0 && <span>{portfolio.pending} pending</span>}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#00dc82] rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        {!loading && (
          <>
            {trades.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-border-subtle flex items-center justify-center mx-auto mb-4">
                  <TrendingUp size={24} className="text-text-dim" />
                </div>
                <h2 className="text-lg font-semibold mb-2">No trades yet</h2>
                <p className="text-text-dim text-sm mb-6">
                  Upload a screenshot or paste a market URL to log your first trade.
                </p>
                <button
                  onClick={() => { setInputTab("screenshot"); setModalStep("input"); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00dc82] text-[#070d1a] font-semibold text-sm hover:brightness-110 transition-all"
                >
                  <Plus size={14} /> Log Trade
                </button>
              </div>
            ) : (
              <>
                {/* Active / Resolved tabs */}
                {(() => {
                  const activeTrades = trades.filter((t) => t.result === null);
                  const resolvedTrades = trades.filter((t) => t.result !== null);
                  return (
                    <>
                      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-4">
                        {([
                          { key: "active", label: "Active", count: activeTrades.length },
                          { key: "resolved", label: "Resolved", count: resolvedTrades.length },
                        ] as const).map(({ key, label, count }) => (
                          <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                              activeTab === key
                                ? "bg-[#00dc82] text-[#070d1a]"
                                : "text-text-dim hover:text-white"
                            }`}
                          >
                            {label}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                              activeTab === key
                                ? "bg-[#070d1a]/20 text-[#070d1a]"
                                : "bg-white/10 text-text-dim"
                            }`}>
                              {count}
                            </span>
                          </button>
                        ))}
                      </div>

                      {activeTab === "active" && (
                        activeTrades.length === 0 ? (
                          <div className="text-center py-16">
                            <p className="text-text-dim text-sm">No pending trades.</p>
                            <p className="text-text-dim text-xs mt-1">Tap the <span className="text-[#00dc82]">+</span> button to log one.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {activeTrades.map((trade) => (
                              <TradeCard key={trade.id} trade={trade} onUpdate={handleUpdate} onDelete={handleDelete} />
                            ))}
                          </div>
                        )
                      )}

                      {activeTab === "resolved" && (
                        resolvedTrades.length === 0 ? (
                          <div className="text-center py-16">
                            <p className="text-text-dim text-sm">No resolved trades yet.</p>
                            <p className="text-text-dim text-xs mt-1">Mark a trade Won, Lost, or Void to see it here.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {resolvedTrades.map((trade) => (
                              <TradeCard key={trade.id} trade={trade} onUpdate={handleUpdate} onDelete={handleDelete} />
                            ))}
                          </div>
                        )
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}
      </div>

      {/* Floating action button */}
      {!loading && (
        <button
          onClick={() => { setInputTab("screenshot"); setModalStep("input"); }}
          className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-40 flex items-center gap-2 px-4 py-3.5 sm:px-5 rounded-2xl bg-[#00dc82] text-[#070d1a] font-bold text-sm shadow-lg shadow-[#00dc82]/20 hover:brightness-110 active:scale-95 transition-all"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Log Trade</span>
        </button>
      )}

      {/* Modal overlay */}
      {modalStep !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md bg-[#0d1526] border border-border-subtle rounded-3xl overflow-hidden shadow-2xl">

            {/* Input step */}
            {(modalStep === "input") && (
              <div>
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
                  <h2 className="text-white font-semibold text-base">Log Trade</h2>
                  <button onClick={closeModal} className="text-text-dim hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0 px-6 pt-4">
                  {(["screenshot", "url"] as InputTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setInputTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium border-b-2 transition-all ${
                        inputTab === tab
                          ? "border-[#00dc82] text-[#00dc82]"
                          : "border-transparent text-text-dim hover:text-white"
                      }`}
                    >
                      {tab === "screenshot" ? <Camera size={14} /> : <Link2 size={14} />}
                      {tab === "screenshot" ? "Screenshot" : "URL"}
                    </button>
                  ))}
                </div>

                <div className="px-6 py-5 space-y-4">
                  {parseError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      {parseError}
                    </div>
                  )}

                  {inputTab === "screenshot" ? (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileChange(file);
                        }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-border-subtle hover:border-[#00dc82]/40 hover:bg-[#00dc82]/5 transition-all"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                          <Camera size={22} className="text-text-dim" />
                        </div>
                        <div className="text-center">
                          <p className="text-white text-sm font-medium">Upload bet screenshot</p>
                          <p className="text-text-dim text-xs mt-0.5">Tap to take a photo or choose from library</p>
                        </div>
                      </button>
                      <p className="text-center text-xs text-text-dim">
                        AI will extract the market, price, and position automatically
                      </p>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs text-text-dim uppercase tracking-wider font-medium block mb-1.5">
                          Kalshi or Polymarket URL
                        </label>
                        <input
                          type="url"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUrlParse(); }}
                          placeholder="https://kalshi.com/markets/..."
                          className="w-full bg-white/5 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-[#00dc82]/50 transition-colors"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={handleUrlParse}
                        disabled={!urlInput.trim()}
                        className="w-full py-3 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Fetch Market
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Parsing step */}
            {modalStep === "parsing" && (
              <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
                {imagePreview && (
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border border-border-subtle mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Loader2 size={28} className="text-[#00dc82] animate-spin" />
                <div className="text-center">
                  <p className="text-white font-medium text-sm">Analyzing your bet…</p>
                  <p className="text-text-dim text-xs mt-1">AI is extracting the trade details</p>
                </div>
              </div>
            )}

            {/* Confirm step */}
            {(modalStep === "confirm" || modalStep === "saving") && parsed !== null && (
              <div>
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
                  <div>
                    <h2 className="text-white font-semibold text-base">Confirm Trade</h2>
                    <p className="text-text-dim text-xs mt-0.5">Review and edit the detected details</p>
                  </div>
                  <button onClick={closeModal} className="text-text-dim hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  {/* Market name */}
                  <div>
                    <label className="text-xs text-text-dim uppercase tracking-wider font-medium block mb-1.5">
                      Market / Event
                    </label>
                    <input
                      type="text"
                      value={confirmMarket}
                      onChange={(e) => setConfirmMarket(e.target.value)}
                      placeholder="e.g. Will the Fed cut rates in September?"
                      className="w-full bg-white/5 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-[#00dc82]/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Platform */}
                    <div>
                      <label className="text-xs text-text-dim uppercase tracking-wider font-medium block mb-1.5">
                        Platform
                      </label>
                      <select
                        value={confirmPlatform}
                        onChange={(e) => setConfirmPlatform(e.target.value)}
                        className="w-full bg-white/5 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00dc82]/50 transition-colors appearance-none"
                      >
                        <option value="">Select</option>
                        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    {/* Position */}
                    <div>
                      <label className="text-xs text-text-dim uppercase tracking-wider font-medium block mb-1.5">
                        Position
                      </label>
                      <div className="flex gap-1 p-0.5 rounded-xl bg-white/5 border border-border-subtle h-[42px]">
                        {["YES", "NO"].map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setConfirmPosition(pos)}
                            className={`flex-1 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1 ${
                              confirmPosition === pos
                                ? pos === "YES"
                                  ? "bg-[#00dc82] text-[#070d1a]"
                                  : "bg-red-500 text-white"
                                : "text-text-dim hover:text-white"
                            }`}
                          >
                            {pos === "YES" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Entry price */}
                    <div>
                      <label className="text-xs text-text-dim uppercase tracking-wider font-medium block mb-1.5">
                        Entry Price
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={confirmPrice}
                          onChange={(e) => setConfirmPrice(e.target.value)}
                          placeholder="65"
                          className="w-full bg-white/5 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-[#00dc82]/50 transition-colors pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">¢</span>
                      </div>
                    </div>

                    {/* Stake */}
                    <div>
                      <label className="text-xs text-text-dim uppercase tracking-wider font-medium block mb-1.5">
                        Stake
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">$</span>
                        <input
                          type="number"
                          min="1"
                          value={confirmStake}
                          onChange={(e) => setConfirmStake(e.target.value)}
                          placeholder="100"
                          className="w-full bg-white/5 border border-border-subtle rounded-xl pl-7 pr-4 py-2.5 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-[#00dc82]/50 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs text-text-dim uppercase tracking-wider font-medium block mb-1.5">
                      Notes <span className="normal-case text-text-dim">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={confirmNotes}
                      onChange={(e) => setConfirmNotes(e.target.value)}
                      placeholder="Why are you taking this position?"
                      className="w-full bg-white/5 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-[#00dc82]/50 transition-colors"
                    />
                  </div>

                  {/* Auto-resolve badge */}
                  {confirmMarketId && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <RefreshCw size={13} className="text-blue-400 shrink-0" />
                      <p className="text-xs text-blue-400">
                        This trade will auto-resolve when the market settles.
                      </p>
                    </div>
                  )}

                  {/* Profit preview */}
                  {potentialProfit !== null && (
                    <div className="flex items-center justify-between text-xs px-4 py-2.5 rounded-xl bg-[#00dc82]/5 border border-[#00dc82]/15">
                      <span className="text-text-dim">If this wins:</span>
                      <span className="text-[#00dc82] font-bold">+${fmt(potentialProfit)} profit</span>
                    </div>
                  )}

                  {confirmError && <p className="text-red-400 text-xs">{confirmError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setModalStep("input")}
                      disabled={modalStep === "saving"}
                      className="flex-1 py-3 rounded-xl border border-border-subtle text-text-dim text-sm font-medium hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={modalStep === "saving"}
                      className="flex-1 py-3 rounded-xl bg-[#00dc82] text-[#070d1a] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {modalStep === "saving" ? (
                        <><Loader2 size={14} className="animate-spin" /> Saving…</>
                      ) : (
                        "Save Trade"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
