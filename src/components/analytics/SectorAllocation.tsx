import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { useSectorOverrides } from "@/hooks/useSectorOverrides";
import { sectorBadgeClass } from "@/utils/colorHelpers";
import { Badge } from "@/components/ui/badge";

interface Props {
  results: QuoteResult[];
}

export function SectorAllocation({ results }: Props) {
  const { resolve } = useSectorOverrides();

  const buckets = useMemo(() => {
    const m = new Map<string, { count: number; gain: number; loss: number }>();
    for (const r of results) {
      if (!r.data) continue;
      const sector = resolve(r.ticker, r.data.sector);
      const b = m.get(sector) ?? { count: 0, gain: 0, loss: 0 };
      b.count += 1;
      if (r.data.dayChangePct >= 0) b.gain += 1;
      else b.loss += 1;
      m.set(sector, b);
    }
    const total = Array.from(m.values()).reduce((a, b) => a + b.count, 0) || 1;
    return Array.from(m.entries())
      .map(([sector, v]) => ({ sector, ...v, pct: (v.count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [results, resolve]);

  return (
    <Card className="creative:shadow-soft minimal:rounded-none minimal:border-2 p-5">
      <h2 className="mb-1 font-display text-lg font-semibold">Sector Distribution</h2>
      <p className="mb-4 text-xs text-muted-foreground">Spread of your watchlist across sectors</p>
      {buckets.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-2.5">
          {buckets.map((b) => (
            <div key={b.sector}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <Badge variant="outline" className={`${sectorBadgeClass(b.sector)}`}>
                  {b.sector}
                </Badge>
                <span className="text-muted-foreground">
                  {b.count} · <span className="text-gain">▲{b.gain}</span> /{" "}
                  <span className="text-loss">▼{b.loss}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted minimal:rounded-none">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 minimal:bg-primary"
                  style={{ width: `${b.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
