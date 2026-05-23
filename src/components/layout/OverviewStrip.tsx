import { useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Activity } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { formatINR, formatChangePct, formatNumber } from "@/utils/formatters";

interface Props {
  portfolio: Holding[];
  portfolioQuotes: QuoteResult[];
  cashBalance: number;
  realized: number;
  cagr: number | null;
}

export function OverviewStrip({
  portfolio, portfolioQuotes, cashBalance, realized, cagr,
}: Props) {
  const { invested, current, dayPL } = useMemo(() => {
    let inv = 0, cur = 0, day = 0;
    const priceByTicker: Record<string, { cmp: number; prev: number }> = {};
    portfolioQuotes.forEach((q) => {
      if (q.data) {
        priceByTicker[q.ticker] = {
          cmp: q.data.cmp,
          prev: q.data.cmp - q.data.dayChange,
        };
      }
    });
    portfolio.forEach((h) => {
      const p = priceByTicker[h.ticker];
      const cp = p?.cmp ?? h.avgPrice;
      const prev = p?.prev ?? h.avgPrice;
      inv += h.avgPrice * h.qty;
      cur += cp * h.qty;
      day += (cp - prev) * h.qty;
    });
    return { invested: inv, current: cur, dayPL: day };
  }, [portfolio, portfolioQuotes]);

  const totalPL = current - invested;
  const totalPLPct = invested > 0 ? (totalPL / invested) * 100 : 0;
  const dayPct = current - dayPL > 0 ? (dayPL / (current - dayPL)) * 100 : 0;
  const totalValue = current + cashBalance;

  const tone = (n: number) =>
    n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-muted-foreground";

  const stats = [
    {
      label: "Portfolio Value",
      value: formatINR(totalValue),
      sub: portfolio.length === 0 ? "No holdings" : `${portfolio.length} holdings`,
      icon: Wallet,
      tone: "",
    },
    {
      label: "Day P&L",
      value: `${dayPL >= 0 ? "+" : ""}${formatINR(dayPL)}`,
      sub: invested > 0 ? formatChangePct(dayPct) : "—",
      icon: dayPL >= 0 ? TrendingUp : TrendingDown,
      tone: tone(dayPL),
    },
    {
      label: "Total P&L",
      value: `${totalPL >= 0 ? "+" : ""}${formatINR(totalPL + realized)}`,
      sub: `Unreal ${formatNumber(totalPLPct, 2)}%`,
      icon: totalPL + realized >= 0 ? TrendingUp : TrendingDown,
      tone: tone(totalPL + realized),
    },
    {
      label: "Cash",
      value: formatINR(cashBalance),
      sub: invested > 0 ? `Invested ${formatINR(invested)}` : "Add funds to start",
      icon: PiggyBank,
      tone: "",
    },
    {
      label: "CAGR",
      value: cagr != null ? `${cagr >= 0 ? "+" : ""}${formatNumber(cagr, 2)}%` : "—",
      sub: cagr != null ? "Annualized" : "Buy to track",
      icon: Activity,
      tone: cagr != null ? tone(cagr) : "",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="min-w-0 rounded-xl border border-border bg-card p-2.5 creative:gradient-card creative:shadow-soft minimal:rounded-none minimal:border-l-2 minimal:border-y-0 minimal:border-r-0 minimal:bg-transparent sm:p-3"
          >
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <Icon className={`h-3.5 w-3.5 shrink-0 ${s.tone || "text-muted-foreground"}`} />
            </div>
            <p className={`mt-1 truncate font-display text-base font-bold leading-tight sm:text-xl ${s.tone}`}>{s.value}</p>
            {s.sub && (
              <p className={`mt-0.5 truncate font-mono text-[10px] sm:text-[11px] ${s.tone || "text-muted-foreground"}`}>{s.sub}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
