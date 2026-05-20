import { useMemo } from "react";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { formatIndianNumber, formatChangePct } from "@/utils/formatters";
import { changeColorClass } from "@/utils/colorHelpers";
import { Skeleton } from "@/components/ui/skeleton";

interface Stat {
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss" | "neutral";
}

export function PortfolioSummary({ results }: { results: QuoteResult[] }) {
  const stats = useMemo<Stat[]>(() => {
    const quotes = results.map((r) => r.data).filter((q) => !!q);
    const total = results.length;
    if (quotes.length === 0) {
      return [
        { label: "Stocks Tracked", value: String(total), tone: "neutral" },
        { label: "Avg P/E", value: "—" },
        { label: "Top Gainer", value: "—" },
        { label: "Top Loser", value: "—" },
      ];
    }
    const pes = quotes.map((q) => q.pe).filter((v): v is number => v != null && isFinite(v));
    const avgPe = pes.length ? pes.reduce((a, b) => a + b, 0) / pes.length : null;
    const sorted = [...quotes].sort((a, b) => b.dayChangePct - a.dayChangePct);
    const top = sorted[0];
    const bot = sorted[sorted.length - 1];
    return [
      { label: "Stocks Tracked", value: String(total) },
      { label: "Avg P/E", value: avgPe == null ? "—" : formatIndianNumber(avgPe, 2) },
      {
        label: "Top Gainer",
        value: top.ticker,
        sub: formatChangePct(top.dayChangePct),
        tone: top.dayChangePct >= 0 ? "gain" : "loss",
      },
      {
        label: "Top Loser",
        value: bot.ticker,
        sub: formatChangePct(bot.dayChangePct),
        tone: bot.dayChangePct >= 0 ? "gain" : "loss",
      },
    ];
  }, [results]);

  const anyLoading = results.some((r) => r.isLoading);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-border bg-card p-4 creative:gradient-card creative:shadow-soft minimal:rounded-none minimal:border-l-2 minimal:border-y-0 minimal:border-r-0 minimal:bg-transparent minimal:p-3"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {s.label}
          </p>
          {anyLoading && s.value === "—" ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p
              className={`mt-1 font-display text-2xl font-bold ${
                s.tone ? changeColorClass(s.tone === "gain" ? 1 : s.tone === "loss" ? -1 : 0) : ""
              }`}
            >
              {s.value}
            </p>
          )}
          {s.sub && (
            <p className={`mt-0.5 font-mono text-xs ${s.tone === "gain" ? "text-gain" : "text-loss"}`}>
              {s.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
