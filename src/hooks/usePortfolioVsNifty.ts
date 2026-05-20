import { useMemo } from "react";
import { useHistories } from "@/hooks/useHistories";
import type { Holding } from "@/types/portfolio.types";

export type VsNiftyPoint = {
  date: string;
  portfolio: number;
  nifty: number;
  cash: number;
};

export type VsNiftySummary = {
  totalInvested: number;
  portfolioNow: number;
  niftyNow: number;
  portfolioGain: number;
  niftyGain: number;
  portfolioGainPct: number;
  niftyGainPct: number;
  beatNifty: boolean;
  alpha: number; // portfolio return - nifty return (pp)
};

function indexByDate(points: { date: string; close: number }[]) {
  const m = new Map<string, number>();
  for (const p of points) m.set(p.date.slice(0, 10), p.close);
  return m;
}

export function usePortfolioVsNifty(portfolio: Holding[], period: string) {
  const tickers = useMemo(() => portfolio.map((h) => h.ticker), [portfolio]);
  const allTickers = useMemo(() => ["^NSEI", ...tickers], [tickers]);
  const { map, isLoading } = useHistories(allTickers, period);

  const { series, summary } = useMemo(() => {
    const niftyHistory = map["^NSEI"] ?? [];
    if (!niftyHistory.length || !portfolio.length) {
      return { series: [] as VsNiftyPoint[], summary: null };
    }

    const totalInvested = portfolio.reduce(
      (s, h) => s + h.avgPrice * h.qty,
      0
    );
    if (totalInvested === 0) return { series: [] as VsNiftyPoint[], summary: null };

    const niftyIdx = indexByDate(niftyHistory);
    const stockIdxs = portfolio.map((h) => ({
      qty: h.qty,
      avgPrice: h.avgPrice,
      idx: indexByDate(map[h.ticker] ?? []),
    }));

    const niftyBase = niftyHistory[0].close;
    const out: VsNiftyPoint[] = [];

    for (const point of niftyHistory) {
      const date = point.date.slice(0, 10);
      const niftyClose = niftyIdx.get(date);
      if (niftyClose == null) continue;

      // Portfolio value: sum of qty * price_on_date (fallback to avgPrice if no data)
      let portfolioValue = 0;
      for (const s of stockIdxs) {
        const price = s.idx.get(date) ?? s.avgPrice;
        portfolioValue += s.qty * price;
      }

      // Nifty value: if you put totalInvested into Nifty on day 0
      const niftyValue = totalInvested * (niftyClose / niftyBase);

      out.push({
        date,
        portfolio: Math.round(portfolioValue * 100) / 100,
        nifty: Math.round(niftyValue * 100) / 100,
        cash: Math.round(totalInvested * 100) / 100,
      });
    }

    const last = out[out.length - 1];
    const portfolioNow = last?.portfolio ?? totalInvested;
    const niftyNow = last?.nifty ?? totalInvested;
    const portfolioGain = portfolioNow - totalInvested;
    const niftyGain = niftyNow - totalInvested;
    const portfolioGainPct =
      totalInvested > 0 ? (portfolioGain / totalInvested) * 100 : 0;
    const niftyGainPct =
      totalInvested > 0 ? (niftyGain / totalInvested) * 100 : 0;

    const summary: VsNiftySummary = {
      totalInvested,
      portfolioNow,
      niftyNow,
      portfolioGain,
      niftyGain,
      portfolioGainPct,
      niftyGainPct,
      beatNifty: portfolioGainPct > niftyGainPct,
      alpha: portfolioGainPct - niftyGainPct,
    };

    return { series: out, summary };
  }, [map, portfolio]);

  return { series, summary, isLoading };
}
