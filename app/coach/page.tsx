"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import MobileNav from "@/components/MobileNav";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Lock,
  Zap,
  BarChart2,
  TrendingUp,
  BookOpen,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  { icon: BarChart2, label: "How do I calculate my edge on a bet?", desc: "Learn the math behind edge" },
  { icon: TrendingUp, label: "When should I fade vs buy a market?", desc: "BUY vs FADE decision framework" },
  { icon: BookOpen, label: "Explain Kelly criterion for prediction markets", desc: "Optimal bet sizing" },
  { icon: AlertCircle, label: "What makes a market mispriced?", desc: "Find hidden value" },
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setStreaming(true);

    // Placeholder assistant message that will be filled by stream
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        signal: controller.signal,
      });

      if (res.status === 403) { setForbidden(true); setStreaming(false); return; }
      if (res.status === 429) {
        setError("Too many messages — take a breather and try again in a moment.");
        setMessages((prev) => prev.slice(0, -1));
        setStreaming(false);
        return;
      }
      if (!res.ok || !res.body) throw new Error("Coach unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated };
          return updated;
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Something went wrong. Try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  if (forbidden) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <CoachNav />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-dim border border-green-bright/20 flex items-center justify-center mx-auto mb-6">
              <Lock size={28} className="text-green-bright" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Subscribers Only</h2>
            <p className="text-text-dim mb-8 leading-relaxed">
              The AI Coach is available to FadeMe Pro members. Get unlimited analyses, daily picks, and coaching for $1 your first week.
            </p>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-bright text-[#070d1a] font-bold hover:brightness-110 transition-all"
            >
              <Zap size={16} /> Get FadeMe Pro — $1 First Week
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <MobileNav activeTab="coach" />
      <CoachNav />

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-20 sm:pb-4">
        {/* Empty state */}
        {isEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-green-dim border border-green-bright/20 flex items-center justify-center mb-5">
              <Sparkles size={28} className="text-green-bright" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-center">Your AI Trading Coach</h1>
            <p className="text-text-dim text-center max-w-md mb-10 leading-relaxed">
              Ask anything about markets, positions, or strategy. Your coach reads live data and your analysis history to give you grounded, actionable advice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {SUGGESTED_PROMPTS.map(({ icon: Icon, label, desc }) => (
                <button
                  key={label}
                  onClick={() => send(label)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border-subtle bg-card hover:border-green-bright/30 hover:bg-card/80 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-dim border border-green-bright/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={15} className="text-green-bright" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium leading-snug group-hover:text-green-bright transition-colors">{label}</p>
                    <p className="text-text-dim text-xs mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {!isEmpty && (
          <div className="flex-1 py-6 space-y-6 overflow-y-auto">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} isStreaming={streaming && i === messages.length - 1 && msg.role === "assistant"} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-sm text-red-300">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Input */}
        <div className="sticky bottom-0 pt-2 pb-2 bg-bg">
          <div className={`flex items-end gap-3 p-3 rounded-2xl border transition-colors ${streaming ? "border-green-bright/30 bg-card" : "border-border-subtle bg-card focus-within:border-green-bright/40"}`}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder="Ask your coach anything about markets, strategy, or a specific bet…"
              className="flex-1 bg-transparent text-white text-sm placeholder:text-text-dim resize-none outline-none min-h-[24px] leading-6 disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="shrink-0 w-9 h-9 rounded-xl bg-green-bright text-[#070d1a] flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {streaming ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </div>
          <p className="text-center text-xs text-text-dim mt-2">
            Coach reads your analysis history and live market data · Not financial advice
          </p>
        </div>
      </div>
    </div>
  );
}

function CoachNav() {
  return (
    <nav className="border-b border-border-subtle px-6 py-4 shrink-0">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/analyze" className="flex items-center gap-2 text-text-dim hover:text-white transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">Analyze</span>
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-icon.png" alt="FadeMe" width={24} height={24} className="rounded-md" />
          <span className="text-white font-semibold tracking-tight">
            Fade<span className="text-green-bright">Me</span>
          </span>
        </Link>
        <UserButton />
      </div>
    </nav>
  );
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming: boolean }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm bg-green-bright/10 border border-green-bright/20 text-sm text-white leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-8 h-8 rounded-xl bg-green-dim border border-green-bright/20 flex items-center justify-center mt-0.5">
        <Sparkles size={14} className="text-green-bright" />
      </div>
      <div className="flex-1 text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
        {message.content}
        {isStreaming && !message.content && (
          <span className="inline-flex items-center gap-1 text-text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-green-bright animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-green-bright animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-green-bright animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
        {isStreaming && message.content && (
          <span className="inline-block w-0.5 h-4 bg-green-bright ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
}
