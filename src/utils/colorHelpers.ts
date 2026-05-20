import type { RatingResult } from "@/types/stock.types";

export function changeColorClass(n: number | null | undefined): string {
  if (n == null || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-gain" : "text-loss";
}

export function calculateRating(
  roe: number | null,
  pe: number | null,
  revenueGrowth: number | null,
  debtToEquity: number | null
): RatingResult {
  let score = 0;
  if (roe != null) {
    const r = roe * 100;
    score += r > 20 ? 2 : r > 15 ? 1 : r < 0 ? -2 : 0;
  }
  if (pe != null) {
    score += pe < 35 ? 2 : pe < 45 ? 1 : pe > 60 ? -1 : 0;
  }
  if (revenueGrowth != null) {
    const g = revenueGrowth * 100;
    score += g > 15 ? 2 : g > 8 ? 1 : g < 0 ? -2 : 0;
  }
  if (debtToEquity != null) {
    const d = debtToEquity / 100;
    score += d < 0.5 ? 1 : d > 2 ? -2 : 0;
  }
  if (score >= 5) return { className: "strong-buy", label: "STRONG BUY", emoji: "🟢" };
  if (score >= 3) return { className: "buy", label: "BUY", emoji: "🔵" };
  if (score >= 0) return { className: "accumulate", label: "ACCUMULATE", emoji: "🟡" };
  if (score >= -2) return { className: "hold", label: "HOLD", emoji: "🟠" };
  return { className: "sell", label: "SELL", emoji: "🔴" };
}

const SECTOR_COLORS: Record<string, string> = {
  Technology: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Information Technology": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Financial Services": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Banking: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Consumer Defensive": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Consumer Cyclical": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Energy: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  Healthcare: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  Industrials: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  "Basic Materials": "bg-stone-500/15 text-stone-400 border-stone-500/30",
  Utilities: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "Communication Services": "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "Real Estate": "bg-lime-500/15 text-lime-400 border-lime-500/30",
};

export function sectorBadgeClass(sector: string): string {
  return (
    SECTOR_COLORS[sector] ??
    "bg-muted text-muted-foreground border-border"
  );
}

export function isNear52WeekHigh(cmp: number, high: number): boolean {
  if (!high || !cmp) return false;
  return (high - cmp) / high <= 0.03;
}

export function isNear52WeekLow(cmp: number, low: number): boolean {
  if (!low || !cmp) return false;
  return (cmp - low) / low <= 0.03;
}
