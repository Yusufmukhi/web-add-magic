import { useMemo } from "react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

function heatColor(pct: number): { bg: string; text: string } {
  if (pct >= 3) return { bg: "bg-emerald-600/90", text: "text-white" };
  if (pct >= 1.5) return { bg: "bg-emerald-500/75", text: "text-white" };
  if (pct >= 0.3) return { bg: "bg-emerald-400/60", text: "text-emerald-950" };
  if (pct > -0.3) return { bg: "bg-muted", text: "text-muted-foreground" };
  if (pct > -1.5) return { bg: "bg-red-400/60", text: "text-red-950" };
  if (pct > -3) return { bg: "bg-red-500/75", text: "text-white" };
  return { bg: "bg-red-600/90", text: "text-white" };
}

export function HoldingsHeatmap({ portfolio, results }: Props) {
  const cells = useMemo(() => {
    const quoteMap = new Map(
      results
        .filter((r) => !!r.data && !r.error)
        .map((r) => [r.data!.ticker, r.data!])
    );

    return portfolio
      .map((h) => {
        const q = quoteMap.get(h.ticker);
        const cmp = q?.cmp ?? h.avgPrice;
        const value = cmp * h.qty;
        const dayChangePct = q?.dayChangePct ?? 0;
        return { ticker: h.ticker, name: q?.name ?? h.ticker, value, dayChangePct };
      })
      .sort((a, b) => b.value - a.value);
  }, [portfolio, results]);

  if (cells.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground minimal:rounded-none">
        Add holdings to see heatmap
      </div>
    );
  }

  const totalValue = cells.reduce((s, c) => s + c.value, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 creative:gradient-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Holdings Heatmap — Day % Change
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-600/90" /> ≤ −3%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted border border-border" /> Flat</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600/90" /> ≥ +3%</span>
        </div>
      </div>

      <div className="grid auto-rows-fr gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(cells.length, 5)}, 1fr)` }}>
        {cells.map((c) => {
          const { bg, text } = heatColor(c.dayChangePct);
          const weightPct = totalValue > 0 ? (c.value / totalValue) * 100 : 0;
          // Bigger holdings get taller cells via row span (1–3)
          const span = weightPct >= 25 ? 3 : weightPct >= 12 ? 2 : 1;
          return (
            <div
              key={c.ticker}
              className={`${bg} ${text} flex flex-col items-center justify-center gap-0.5 rounded-lg p-2 transition-transform hover:scale-[1.03] cursor-default`}
              style={{ gridRow: `span ${span}`, minHeight: `${span * 52}px` }}
              title={`${c.name}\nDay: ${c.dayChangePct >= 0 ? "+" : ""}${c.dayChangePct.toFixed(2)}%\nWeight: ${weightPct.toFixed(1)}%`}
            >
              <span className="text-[11px] font-bold leading-none">{c.ticker}</span>
              <span className="text-[10px] font-medium leading-none">
                {c.dayChangePct >= 0 ? "+" : ""}{c.dayChangePct.toFixed(2)}%
              </span>
              <span className="text-[9px] leading-none opacity-70">{weightPct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
