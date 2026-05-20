import { useMemo } from "react";
import { useHistories, type HistoryPoint } from "@/hooks/useHistories";
import type { Holding } from "@/types/portfolio.types";

export type SeriesPoint = { date: string; portfolio: number; nifty: number; sensex: number };

const BENCHMARKS = ["^NSEI", "^BSESN"] as const;

function indexByDate(points: HistoryPoint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of points) m.set(p.date.slice(0, 10), p.close);
  return m;
}

export function useBenchmarkSeries(
  portfolio: Holding[],
  period: string
) {
  const holdingTickers = useMemo(() => portfolio.map((h) => h.ticker), [portfolio]);
  const allTickers = useMemo(
    () => [...BENCHMARKS, ...holdingTickers],
    [holdingTickers]
  );
  const { map, isLoading } = useHistories(allTickers, period);

  const series: SeriesPoint[] = useMemo(() => {
    const nifty = map["^NSEI"] ?? [];
    const sensex = map["^BSESN"] ?? [];
    if (!nifty.length || !sensex.length) return [];

    const niftyIdx = indexByDate(nifty);
    const sensexIdx = indexByDate(sensex);
    const holdingIdx = holdingTickers.map((t) => ({
      qty: portfolio.find((h) => h.ticker === t)?.qty ?? 0,
      idx: indexByDate(map[t] ?? []),
    }));

    const dates = nifty.map((p) => p.date.slice(0, 10));
    let baseP = 0;
    let baseN = 0;
    let baseS = 0;
    const out: SeriesPoint[] = [];

    for (const d of dates) {
      const n = niftyIdx.get(d);
      const s = sensexIdx.get(d);
      if (n == null || s == null) continue;

      let pv = 0;
      let valid = holdingIdx.length === 0;
      for (const h of holdingIdx) {
        const c = h.idx.get(d);
        if (c != null) {
          pv += c * h.qty;
          valid = true;
        }
      }
      if (!valid) continue;

      if (baseN === 0) {
        baseN = n;
        baseS = s;
        baseP = pv || 1;
      }
      out.push({
        date: d,
        nifty: (n / baseN) * 100,
        sensex: (s / baseS) * 100,
        portfolio: pv > 0 ? (pv / baseP) * 100 : 100,
      });
    }
    return out;
  }, [map, holdingTickers, portfolio]);

  return { series, isLoading };
}
