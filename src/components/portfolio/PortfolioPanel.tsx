import { useEffect, useMemo,useRef } from "react";
import { useStockQuotes } from "@/hooks/useStockQuote";
import type { Holding, HoldingRow, Transaction } from "@/types/portfolio.types";
import { PortfolioStats } from "./PortfolioStats";
import { HoldingsTable } from "./HoldingsTable";
import { AllocationDonut } from "./AllocationDonut";
import { PortfolioActions } from "./PortfolioActions";

interface Props {
  portfolio: Holding[];
  transactions: Transaction[];
  cashBalance: number;
  onAddFunds: () => void;
  onWithdraw: () => void;
  onBuy: () => void;
  onSell: (ticker?: string) => void;
  onPricesChange: (prices: Record<string, number>) => void;
}

export function PortfolioPanel({
  portfolio, transactions, cashBalance,
  onAddFunds, onWithdraw, onBuy, onSell, onPricesChange,
}: Props) {
  const tickers = useMemo(() => portfolio.map((h) => h.ticker), [portfolio]);
  const quotes = useStockQuotes(tickers);

  const prices = useMemo(() => {
    const map: Record<string, number> = {};
    quotes.forEach((q) => { if (q.data) map[q.ticker] = q.data.cmp; });
    return map;
  }, [quotes]);
   const onPricesChangeRef = useRef(onPricesChange);
onPricesChangeRef.current = onPricesChange;
  // Push prices up for SellModal
  useEffect(() => {
  onPricesChangeRef.current(prices);
}, [prices]); 

  const { rows, invested, current, realized } = useMemo(() => {
    let inv = 0, cur = 0;
    const sectorByTicker: Record<string, string> = {};
    const nameByTicker: Record<string, string> = {};
    quotes.forEach((q) => {
      if (q.data) {
        sectorByTicker[q.ticker] = q.data.sector;
        nameByTicker[q.ticker] = q.data.name;
      }
    });
    portfolio.forEach((h) => {
      const cp = prices[h.ticker] ?? h.avgPrice;
      inv += h.avgPrice * h.qty;
      cur += cp * h.qty;
    });
    const real = transactions.reduce(
      (a, t) => (t.action === "SELL" && t.meta?.profit != null ? a + t.meta.profit : a),
      0
    );
    const totalMV = cur || 1;
    const computed: HoldingRow[] = portfolio.map((h) => {
      const cp = prices[h.ticker] ?? h.avgPrice;
      const ivd = h.avgPrice * h.qty;
      const val = cp * h.qty;
      const pl = val - ivd;
      const realT = transactions.reduce(
        (a, t) => (t.action === "SELL" && t.stock === h.ticker && t.meta?.profit != null ? a + t.meta.profit : a),
        0
      );
      const daysHeld = h.buyDate
        ? Math.max(0, Math.floor((Date.now() - Date.parse(h.buyDate)) / 86400000))
        : null;
      return {
        ...h,
        cp,
        invested: ivd,
        value: val,
        pl,
        plPct: ivd > 0 ? (pl / ivd) * 100 : 0,
        realized: realT,
        weight: (val / totalMV) * 100,
        sector: sectorByTicker[h.ticker] ?? "Unknown",
        name: nameByTicker[h.ticker] ?? h.ticker,
        daysHeld,
      };
    });
    computed.sort((a, b) => b.value - a.value);
    return { rows: computed, invested: inv, current: cur, realized: real };
  }, [portfolio, transactions, prices, quotes]);

  const allocByStock = rows.map((r) => ({ name: r.ticker, value: r.value }));
  const allocBySector = Object.values(
    rows.reduce<Record<string, { name: string; value: number }>>((acc, r) => {
      acc[r.sector] = acc[r.sector] ?? { name: r.sector, value: 0 };
      acc[r.sector].value += r.value;
      return acc;
    }, {})
  );

  return (
    <div className="space-y-6">
      <PortfolioStats
        invested={invested}
        current={current}
        realized={realized}
        cashBalance={cashBalance}
      />
      <PortfolioActions
        onAddFunds={onAddFunds}
        onWithdraw={onWithdraw}
        onBuy={onBuy}
        onSell={() => onSell()}
        canSell={portfolio.length > 0}
      />
      <HoldingsTable rows={rows} onSell={onSell} />
      {portfolio.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <AllocationDonut title="Allocation by Stock" data={allocByStock} />
          <AllocationDonut title="Allocation by Sector" data={allocBySector} />
        </div>
      )}
    </div>
  );
}
