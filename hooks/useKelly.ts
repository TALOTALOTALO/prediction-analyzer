"use client";

import { useState, useEffect } from "react";

export type KellyFraction = "quarter" | "half" | "full";

export interface KellyResult {
  fraction: number;
  edge: number;
  hasEdge: boolean;
}

export function calcKelly(
  impliedProbability: number,
  trueOdds: number,
  recommendation: string,
): KellyResult {
  let marketP = impliedProbability / 100;
  let trueP = trueOdds / 100;

  if (recommendation === "FADE") {
    marketP = 1 - marketP;
    trueP = 1 - trueP;
  }

  const safeMarketP = Math.max(0.01, Math.min(0.99, marketP));
  const safeTrueP = Math.max(0, Math.min(1, trueP));

  // Kelly: f = (p - q*b) / b where b = (1-p_market)/p_market
  // Simplifies to: f = (p_true - p_market) / (1 - p_market)
  const raw = (safeTrueP - safeMarketP) / (1 - safeMarketP);
  const fraction = Math.max(0, Math.min(1, raw));
  const edge = (safeTrueP - safeMarketP) * 100;

  return { fraction, edge, hasEdge: fraction > 0.005 };
}

export function kellyWager(
  bankroll: number,
  kelly: KellyResult,
  f: KellyFraction,
): number {
  const multiplier = f === "full" ? 1 : f === "half" ? 0.5 : 0.25;
  return bankroll * kelly.fraction * multiplier;
}

export function useBankroll(): [number, (v: number) => void] {
  const [bankroll, setBankrollState] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem("fademe_bankroll");
    if (stored) {
      const n = parseFloat(stored);
      if (!isNaN(n) && n > 0) setBankrollState(n);
    }
  }, []);

  const setBankroll = (v: number) => {
    setBankrollState(v);
    if (v > 0) localStorage.setItem("fademe_bankroll", String(v));
    else localStorage.removeItem("fademe_bankroll");
  };

  return [bankroll, setBankroll];
}
