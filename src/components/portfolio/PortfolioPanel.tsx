import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStockQuotes } from "@/hooks/useStockQuote";
import type { Holding, HoldingRow, Transaction } from "@/types/portfolio.types";
import { PortfolioStats } from "./PortfolioStats";
import { HoldingsTable } from "./HoldingsTable";
import { AllocationDonut } from "./AllocationDonut";
import { PortfolioActions } from "./PortfolioActions";
import { downloadCSV, parseHoldingsCSV } from "@/utils/csv";
import { toast } from "sonner";

interface Props {
  portfolio: Holding[];
  transactions: Transaction[];
  cashBalance: number;
  onAddFunds: () => void;
  onWithdraw: () => void;
  onBuy: () => void;
  onSell: (ticker?: string) => void;
  onPricesChange: (prices: Record<string, number>) => void;
  onImportHoldings?: (rows: { ticker: string; qty: number; price: number; date: string }[]) => void;
}

export function PortfolioPanel({
  portfolio, transactions, cashBalance,
  onAddFunds, onWithdraw, onBuy, onSell, onPricesChange, onImportHoldings,
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

  // CAGR: based on earliest BUY transaction date and current open-holding values
  const { cagr, cagrYears } = useMemo(() => {
    if (invested <= 0 || current <= 0) return { cagr: null, cagrYears: null };
    const buyDates = transactions
      .filter((t) => t.action === "BUY" && t.date)
      .map((t) => Date.parse(t.date))
      .filter((n) => !isNaN(n));
    if (buyDates.length === 0) return { cagr: null, cagrYears: null };
    const earliest = Math.min(...buyDates);
    const years = (Date.now() - earliest) / (365.25 * 86400000);
    if (years <= 0.0274) return { cagr: null, cagrYears: null }; // <10 days: meaningless
    const ratio = current / invested;
    const c = (Math.pow(ratio, 1 / years) - 1) * 100;
    return { cagr: isFinite(c) ? c : null, cagrYears: years };
  }, [invested, current, transactions]);

  const allocByStock = rows.map((r) => ({ name: r.ticker, value: r.value }));
  const allocBySector = Object.values(
    rows.reduce<Record<string, { name: string; value: number }>>((acc, r) => {
      acc[r.sector] = acc[r.sector] ?? { name: r.sector, value: 0 };
      acc[r.sector].value += r.value;
      return acc;
    }, {})
  );

  const handleExportCSV = useCallback(() => {
    downloadCSV(
      [
        ["Ticker", "Name", "Sector", "Qty", "Avg Cost", "CMP", "Invested", "Value", "P&L", "P/L %", "Realized", "Weight %", "Days Held", "Buy Date"],
        ...rows.map((r) => [
          r.ticker, r.name, r.sector, r.qty, r.avgPrice.toFixed(2), r.cp.toFixed(2),
          r.invested.toFixed(2), r.value.toFixed(2), r.pl.toFixed(2), r.plPct.toFixed(2),
          r.realized.toFixed(2), r.weight.toFixed(2), r.daysHeld ?? "", r.buyDate ?? "",
        ]),
        [],
        ["Totals", "", "", "", "", "", invested.toFixed(2), current.toFixed(2), (current - invested).toFixed(2), "", realized.toFixed(2), "", "", ""],
        ["Cash Balance", "", "", "", "", "", "", cashBalance.toFixed(2), "", "", "", "", "", ""],
        ["CAGR %", "", "", "", "", "", "", cagr != null ? cagr.toFixed(2) : "—", "", "", "", "", "", ""],
      ],
      `portfolio-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }, [rows, invested, current, realized, cashBalance, cagr]);

  return (
    <div className="space-y-6">
      <PortfolioStats
        invested={invested}
        current={current}
        realized={realized}
        cashBalance={cashBalance}
        cagr={cagr}
        cagrYears={cagrYears}
      />
      <PortfolioActions
        onAddFunds={onAddFunds}
        onWithdraw={onWithdraw}
        onBuy={onBuy}
        onSell={() => onSell()}
        onExportCSV={handleExportCSV}
        canSell={portfolio.length > 0}
        canExport={portfolio.length > 0}
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
