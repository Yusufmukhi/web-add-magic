import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStockQuotes } from "@/hooks/useStockQuote";
import type { Holding, HoldingRow, Transaction } from "@/types/portfolio.types";
import { PortfolioStats } from "./PortfolioStats";
import { HoldingsTable } from "./HoldingsTable";
import { AllocationDonut } from "./AllocationDonut";
import { PortfolioActions } from "./PortfolioActions";
import { PortfolioValueChart } from "./PortfolioValueChart";
import { downloadExcel, parseHoldingsExcel, toSerial, S, n, t, empty, NCOLS } from "@/utils/excel";
import type { CellDef } from "@/utils/excel";
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
  onEditHolding?: (ticker: string) => void;
  onDeleteHolding?: (ticker: string) => void;
}

export function PortfolioPanel({
  portfolio, transactions, cashBalance,
  onAddFunds, onWithdraw, onBuy, onSell, onPricesChange, onImportHoldings,
  onEditHolding, onDeleteHolding,
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
  useEffect(() => { onPricesChangeRef.current(prices); }, [prices]);

  const { rows, invested, current, realized } = useMemo(() => {
    let inv = 0, cur = 0;
    const sectorByTicker: Record<string, string> = {};
    const nameByTicker: Record<string, string> = {};
    quotes.forEach((q) => {
      if (q.data) { sectorByTicker[q.ticker] = q.data.sector; nameByTicker[q.ticker] = q.data.name; }
    });
    portfolio.forEach((h) => {
      const cp = prices[h.ticker] ?? h.avgPrice;
      inv += h.avgPrice * h.qty; cur += cp * h.qty;
    });
    const real = transactions.reduce((a, tx) => (tx.action === "SELL" && tx.meta?.profit != null ? a + tx.meta.profit : a), 0);
    const totalMV = cur || 1;
    const computed: HoldingRow[] = portfolio.map((h) => {
      const cp = prices[h.ticker] ?? h.avgPrice;
      const ivd = h.avgPrice * h.qty, val = cp * h.qty, pl = val - ivd;
      const realT = transactions.reduce((a, tx) => (tx.action === "SELL" && tx.stock === h.ticker && tx.meta?.profit != null ? a + tx.meta.profit : a), 0);
      const daysHeld = h.buyDate ? Math.max(0, Math.floor((Date.now() - Date.parse(h.buyDate)) / 86400000)) : null;
      return { ...h, cp, invested: ivd, value: val, pl, plPct: ivd > 0 ? (pl / ivd) * 100 : 0, realized: realT, weight: (val / totalMV) * 100, sector: sectorByTicker[h.ticker] ?? "Unknown", name: nameByTicker[h.ticker] ?? h.ticker, daysHeld };
    });
    computed.sort((a, b) => b.value - a.value);
    return { rows: computed, invested: inv, current: cur, realized: real };
  }, [portfolio, transactions, prices, quotes]);

  const { cagr, cagrYears } = useMemo(() => {
    if (invested <= 0 || current <= 0) return { cagr: null, cagrYears: null };
    const buyDates = transactions.filter((tx) => tx.action === "BUY" && tx.date).map((tx) => Date.parse(tx.date)).filter((nn) => !isNaN(nn));
    if (!buyDates.length) return { cagr: null, cagrYears: null };
    const years = (Date.now() - Math.min(...buyDates)) / (365.25 * 86400000);
    if (years <= 0.0274) return { cagr: null, cagrYears: null };
    const c = (Math.pow(current / invested, 1 / years) - 1) * 100;
    return { cagr: isFinite(c) ? c : null, cagrYears: years };
  }, [invested, current, transactions]);

  const allocByStock = rows.map((r) => ({ name: r.ticker, value: r.value }));
  const allocBySector = Object.values(rows.reduce<Record<string, { name: string; value: number }>>((acc, r) => {
    acc[r.sector] = acc[r.sector] ?? { name: r.sector, value: 0 };
    acc[r.sector].value += r.value; return acc;
  }, {}));

  const handleExportExcel = useCallback(() => {
    const unrealized = current - invested;
    const totalPL = unrealized + realized;
    const totalReturnPct = invested > 0 ? (totalPL / invested) * 100 : 0;
    const netWorth = current + cashBalance;
    const today = new Date().toISOString().slice(0, 10);
    const todaySerial = toSerial(today)!;

    const sells = transactions.filter((tx) => tx.action === "SELL");
    const buys  = transactions.filter((tx) => tx.action === "BUY");
    const funds = transactions.filter((tx) => tx.action === "DEPOSIT" || tx.action === "WITHDRAW");

    // Helpers
    const E = (s: number) => empty(s);
    const row = (...cells: (CellDef | null)[]): (CellDef | null)[] => cells;
    const spacers = (s: number, count = NCOLS) => Array(count).fill(null).map(() => E(s));

    // Section title — spans full width
    const sectionTitle = (label: string): (CellDef | null)[] =>
      [t(label, S.SECTION_TITLE), ...Array(NCOLS - 1).fill(null).map(() => E(S.SECTION_EMPTY))];

    // Column header row
    const colHeaders = (...labels: (string | null)[]): (CellDef | null)[] =>
      labels.map((lb) => lb ? t(lb, S.COL_HEADER) : E(S.COL_HEADER_EMPTY));

    // Gain / loss style selection
    const plStyle = (v: number, _base: number, gainStyle: number, lossStyle: number) =>
      n(v, v >= 0 ? gainStyle : lossStyle);

    const xlRows: (CellDef | null)[][] = [];

    // ── SECTION 1: PORTFOLIO SUMMARY ──────────────────────────────────────────
    xlRows.push(sectionTitle("PORTFOLIO SUMMARY"));
    xlRows.push(row(t("Generated", S.META_LABEL), n(todaySerial, S.META_DATE), ...Array(NCOLS - 2).fill(null).map(() => E(S.META_EMPTY))));
    xlRows.push(row(t("Metric", S.COL_HEADER), t("Value", S.COL_HEADER), ...Array(NCOLS - 2).fill(null).map(() => E(S.COL_HEADER_EMPTY))));
    xlRows.push(row(t("Invested",       S.DATA_LABEL), n(invested,    S.DATA_INR),   ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("Current Value",  S.DATA_LABEL), n(current,     S.DATA_INR_G), ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("Cash Balance",   S.DATA_LABEL), n(cashBalance, S.DATA_INR_B), ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("Total Net Worth",S.DATA_LABEL), n(netWorth,    S.DATA_INR_G), ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("Unrealized P&L", S.DATA_LABEL), plStyle(unrealized, 0, S.DATA_INR_G, S.DATA_INR),   ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("Realized P&L",   S.DATA_LABEL), plStyle(realized,   0, S.DATA_INR_G, S.DATA_INR),   ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("Total P&L",      S.DATA_LABEL), plStyle(totalPL,    0, S.DATA_INR_G, S.DATA_INR),   ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("Total Return %", S.DATA_LABEL), n(totalReturnPct / 100, S.DATA_PCT), ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("CAGR %",         S.DATA_LABEL), n(cagr != null ? cagr / 100 : null, S.DATA_PCT_G), ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push(row(t("CAGR Years",     S.DATA_LABEL), n(cagrYears ?? null, S.DATA_PLAIN), ...spacers(S.DATA_EMPTY, NCOLS - 2)));
    xlRows.push([]); // blank gap row

    // ── SECTION 2: CURRENT HOLDINGS ───────────────────────────────────────────
    xlRows.push(sectionTitle(`CURRENT HOLDINGS  (${portfolio.length} positions)`));
    xlRows.push(["Ticker","Name","Sector","Qty","Avg Cost","CMP","Invested","Value","P&L","P/L %","Realized"].map(lb => t(lb, S.COL_HEADER)));

    let totInv = 0, totVal = 0, totPL = 0, totReal = 0;
    rows.forEach((r, i) => {
      totInv += r.invested; totVal += r.value; totPL += r.pl; totReal += r.realized;
      const alt = i % 2 === 1;
      const TXT  = alt ? S.HOLD_TEXT_B  : S.HOLD_TEXT;
      const INR  = alt ? S.HOLD_INR_B_ROW : S.HOLD_INR;
      const PCT  = alt ? S.HOLD_PCT_B   : S.HOLD_PCT;
      const REAL = alt ? S.HOLD_REALIZED_B : S.HOLD_REALIZED;
      xlRows.push([
        t(r.ticker, TXT), t(r.name, TXT), t(r.sector, TXT),
        n(r.qty, INR), n(r.avgPrice, INR), n(r.cp, INR),
        n(r.invested, INR), n(r.value, INR),
        plStyle(r.pl, 0, S.SELL_PROFIT_G, S.SELL_PROFIT_R),
        n(r.plPct / 100, PCT),
        n(r.realized, REAL),
      ]);
    });
    // Totals
    xlRows.push([
      t("TOTAL", S.TOTAL_LABEL), E(S.TOTAL_EMPTY), E(S.TOTAL_EMPTY), E(S.TOTAL_EMPTY),
      E(S.TOTAL_EMPTY), E(S.TOTAL_EMPTY),
      n(totInv, S.TOTAL_INR), n(totVal, S.TOTAL_INR),
      n(totPL, totPL >= 0 ? S.TOTAL_INR : S.TOTAL_INR),
      E(S.TOTAL_EMPTY), n(totReal, S.TOTAL_INR),
    ]);
    xlRows.push([]); // gap

    // ── SECTION 3: SELL HISTORY ───────────────────────────────────────────────
    xlRows.push(sectionTitle(`SELL HISTORY  (${sells.length} trades)`));
    if (sells.length === 0) {
      xlRows.push([t("No sales recorded yet.", S.DATA_LABEL), ...spacers(S.DATA_EMPTY, NCOLS - 1)]);
    } else {
      xlRows.push(["Date","Ticker","Qty","Avg Buy Price","Sell Price","Amount","Profit","Profit %","Holding Days","Tax Type","Buy Date"].slice(0,NCOLS).map(lb => t(lb, S.COL_HEADER)));
      const sortedSells = [...sells].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      sortedSells.forEach((tx, i) => {
        const profit = tx.meta?.profit ?? 0;
        const alt = i % 2 === 1;
        const DATE = alt ? S.SELL_DATE_B : S.SELL_DATE;
        const TEXT = alt ? S.SELL_TEXT_B : S.SELL_TEXT;
        const INR  = alt ? S.SELL_INR_B  : S.SELL_INR;
        xlRows.push([
          n(toSerial(tx.date), DATE),
          t(tx.stock ?? "—", TEXT),
          n(tx.qty ?? null, alt ? S.HOLD_DAYS_B : S.HOLD_DAYS),
          n(tx.meta?.avgCost ?? null, INR),
          n(tx.price ?? null, INR),
          n(tx.amount, INR),
          plStyle(profit, 0, S.SELL_PROFIT_G, S.SELL_PROFIT_R),
          n((tx.meta?.profitPct ?? 0) / 100, alt ? S.HOLD_PCT_B : S.HOLD_PCT),
          n(tx.meta?.holdingDays ?? null, alt ? S.SELL_DAYS : S.SELL_DAYS),
          t(tx.meta?.type ?? "—", tx.meta?.type === "LTCG" ? S.SELL_LTCG : S.SELL_STCG),
          n(toSerial(tx.meta?.buyDate ?? null), DATE),
        ]);
      });
      xlRows.push([
        t("TOTAL REALIZED", S.TOTAL_LABEL), E(S.TOTAL_EMPTY), E(S.TOTAL_EMPTY), E(S.TOTAL_EMPTY),
        E(S.TOTAL_EMPTY), E(S.TOTAL_EMPTY), n(realized, S.TOTAL_INR),
        ...Array(NCOLS - 7).fill(null).map(() => E(S.TOTAL_EMPTY)),
      ]);
    }
    xlRows.push([]);

    // ── SECTION 4: FUND HISTORY ───────────────────────────────────────────────
    xlRows.push(sectionTitle("FUND HISTORY  (Deposits & Withdrawals)"));
    const totalDeposits    = funds.filter((tx) => tx.action === "DEPOSIT").reduce((s, tx) => s + tx.amount, 0);
    const totalWithdrawals = funds.filter((tx) => tx.action === "WITHDRAW").reduce((s, tx) => s + tx.amount, 0);
    if (funds.length === 0) {
      xlRows.push([t("No fund movements yet.", S.DATA_LABEL), ...spacers(S.DATA_EMPTY, NCOLS - 1)]);
    } else {
      xlRows.push(["Date","Type","Amount","Running Balance","Note",...Array(NCOLS-5).fill(null)].map((lb, i) => lb ? t(lb as string, S.COL_HEADER) : E(S.COL_HEADER_EMPTY)));
      const sortedFunds = [...funds].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      let runBal = 0;
      sortedFunds.forEach((tx, i) => {
        const isDeposit = tx.action === "DEPOSIT";
        runBal += isDeposit ? tx.amount : -tx.amount;
        const alt = i % 2 === 1;
        xlRows.push([
          n(toSerial(tx.date), alt ? S.SELL_DATE_B : S.SELL_DATE),
          t(isDeposit ? "DEPOSIT" : "WITHDRAW", isDeposit ? S.EVT_DEPOSIT : S.EVT_SELL),
          n(tx.amount, alt ? S.SELL_INR_B : S.SELL_INR),
          n(runBal, alt ? S.SELL_INR_B : S.SELL_INR),
          t(isDeposit ? "Fund Deposit" : "Withdrawal", alt ? S.SELL_TEXT_B : S.SELL_TEXT),
          ...Array(NCOLS - 5).fill(null).map(() => E(S.SELL_EMPTY)),
        ]);
      });
      xlRows.push([t("TOTAL DEPOSITS",    S.TOTAL_LABEL), E(S.TOTAL_EMPTY), n(totalDeposits,                    S.TOTAL_INR), ...Array(NCOLS-3).fill(null).map(()=>E(S.TOTAL_EMPTY))]);
      xlRows.push([t("TOTAL WITHDRAWALS", S.TOTAL_LABEL), E(S.TOTAL_EMPTY), n(totalWithdrawals,                 S.TOTAL_INR), ...Array(NCOLS-3).fill(null).map(()=>E(S.TOTAL_EMPTY))]);
      xlRows.push([t("NET FUNDS IN",      S.TOTAL_LABEL), E(S.TOTAL_EMPTY), n(totalDeposits - totalWithdrawals, S.TOTAL_INR), ...Array(NCOLS-3).fill(null).map(()=>E(S.TOTAL_EMPTY))]);
    }
    xlRows.push([]);

    // ── SECTION 5: BUY HISTORY ────────────────────────────────────────────────
    xlRows.push(sectionTitle(`BUY HISTORY  (${buys.length} trades)`));
    if (buys.length === 0) {
      xlRows.push([t("No buys recorded yet.", S.DATA_LABEL), ...spacers(S.DATA_EMPTY, NCOLS - 1)]);
    } else {
      xlRows.push(["Date","Ticker","Qty","Buy Price (₹)","Total Amount (₹)","Avg Cost After (₹)",...Array(NCOLS-6).fill(null)].map((lb,i) => lb ? t(lb as string, S.COL_HEADER) : E(S.COL_HEADER_EMPTY)));
      const sortedBuys = [...buys].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      sortedBuys.forEach((tx, i) => {
        const alt = i % 2 === 1;
        xlRows.push([
          n(toSerial(tx.date), alt ? S.HOLD_DATE_B : S.HOLD_DATE),
          t(tx.stock ?? "—", alt ? S.SELL_TEXT_B : S.SELL_TEXT),
          n(tx.qty ?? null, alt ? S.HOLD_DAYS_B : S.HOLD_DAYS),
          n(tx.price ?? null, alt ? S.SELL_INR_B : S.SELL_INR),
          n(tx.amount, alt ? S.SELL_INR_B : S.SELL_INR),
          n(tx.meta?.avgCost ?? null, alt ? S.SELL_INR_B : S.SELL_INR),
          ...Array(NCOLS - 6).fill(null).map(() => E(alt ? S.SELL_EMPTY : S.DATA_EMPTY)),
        ]);
      });
      const totalBought = buys.reduce((s, tx) => s + tx.amount, 0);
      xlRows.push([t("TOTAL BUY AMOUNT", S.TOTAL_LABEL), E(S.TOTAL_EMPTY), E(S.TOTAL_EMPTY), E(S.TOTAL_EMPTY), n(totalBought, S.TOTAL_INR), ...Array(NCOLS-5).fill(null).map(()=>E(S.TOTAL_EMPTY))]);
    }
    xlRows.push([]);

    // ── SECTION 6: PORTFOLIO VALUE TIMELINE ───────────────────────────────────
    xlRows.push(sectionTitle("PORTFOLIO VALUE TIMELINE"));
    xlRows.push(["Date","Event","Stock","Qty","Price (₹)","Cash Balance (₹)","Holdings Cost Basis (₹)","Total Portfolio Value (₹)",...Array(NCOLS-8).fill(null)].map((lb,i) => lb ? t(lb as string, S.COL_HEADER) : E(S.COL_HEADER_EMPTY)));
    const allTxChron = [...transactions].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    let tlCash = 0;
    const tlHoldings: Record<string, { qty: number; avgPrice: number }> = {};
    allTxChron.forEach((tx, i) => {
      if (tx.action === "DEPOSIT") { tlCash += tx.amount; }
      else if (tx.action === "WITHDRAW") { tlCash -= tx.amount; }
      else if (tx.action === "BUY" && tx.stock && tx.qty && tx.price) {
        tlCash -= tx.amount;
        const ex = tlHoldings[tx.stock];
        if (ex) { const nq = ex.qty + tx.qty; tlHoldings[tx.stock] = { qty: nq, avgPrice: (ex.avgPrice * ex.qty + tx.price * tx.qty) / nq }; }
        else tlHoldings[tx.stock] = { qty: tx.qty, avgPrice: tx.price };
      } else if (tx.action === "SELL" && tx.stock && tx.qty) {
        tlCash += tx.amount;
        const ex = tlHoldings[tx.stock];
        if (ex) { const nq = ex.qty - tx.qty; if (nq <= 0) delete tlHoldings[tx.stock]; else tlHoldings[tx.stock] = { ...ex, qty: nq }; }
      }
      const holdingsBasis = Object.values(tlHoldings).reduce((s, h) => s + h.qty * h.avgPrice, 0);
      const totalVal = tlCash + holdingsBasis;
      const alt = i % 2 === 1;
      const evtStyle = tx.action === "BUY" ? S.EVT_BUY : tx.action === "SELL" ? S.EVT_SELL : S.EVT_DEPOSIT;
      xlRows.push([
        n(toSerial(tx.date), alt ? S.HOLD_DATE_B : S.HOLD_DATE),
        t(tx.action, evtStyle),
        t(tx.stock ?? "—", alt ? S.SELL_TEXT_B : S.SELL_TEXT),
        n(tx.qty ?? null, alt ? S.HOLD_DAYS_B : S.HOLD_DAYS),
        n(tx.price ?? null, alt ? S.SELL_INR_B : S.SELL_INR),
        n(tlCash, alt ? S.SELL_INR_B : S.SELL_INR),
        n(holdingsBasis, alt ? S.SELL_INR_B : S.SELL_INR),
        n(totalVal, alt ? S.SELL_INR_B : S.SELL_INR),
        ...Array(NCOLS - 8).fill(null).map(() => E(alt ? S.SELL_EMPTY : S.DATA_EMPTY)),
      ]);
    });

    // Column widths (in character units)
    const colWidths = [18, 22, 20, 8, 14, 14, 14, 14, 14, 10, 14];

    downloadExcel(xlRows, colWidths, `portfolio-${today}.xlsx`);
  }, [rows, invested, current, realized, cashBalance, cagr, cagrYears, transactions, portfolio]);

  return (
    <div className="space-y-6">
      <PortfolioStats invested={invested} current={current} realized={realized} cashBalance={cashBalance} cagr={cagr} cagrYears={cagrYears}/>
      <PortfolioActions
        onAddFunds={onAddFunds} onWithdraw={onWithdraw} onBuy={onBuy}
        onSell={() => onSell()} onExportExcel={handleExportExcel}
        onImportExcel={onImportHoldings ? async (file) => {
          const { holdings, errors } = await parseHoldingsExcel(file);
          if (errors.length) errors.slice(0, 3).forEach((e) => toast.error(e));
          if (!holdings.length) { toast.error("No valid rows found."); return; }
          onImportHoldings(holdings);
          toast.success(`✅ Imported ${holdings.length} holding${holdings.length === 1 ? "" : "s"} from Excel!`);
        } : undefined}
        canSell={portfolio.length > 0} canExport={portfolio.length > 0}
      />
      <HoldingsTable rows={rows} onSell={onSell} onEdit={onEditHolding} onDelete={onDeleteHolding} />
      {portfolio.length > 0 && (
        <>
          <PortfolioValueChart portfolio={portfolio} />
          <div className="grid gap-4 md:grid-cols-2">
            <AllocationDonut title="Allocation by Stock" data={allocByStock} />
            <AllocationDonut title="Allocation by Sector" data={allocBySector} />
          </div>
        </>
      )}
    </div>
  );
}
