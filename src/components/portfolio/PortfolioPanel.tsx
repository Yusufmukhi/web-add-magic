import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStockQuotes } from "@/hooks/useStockQuote";
import type { Holding, HoldingRow, Transaction } from "@/types/portfolio.types";
import { PortfolioStats } from "./PortfolioStats";
import { HoldingsTable } from "./HoldingsTable";
import { AllocationDonut } from "./AllocationDonut";
import { PortfolioActions } from "./PortfolioActions";
import { PortfolioValueChart } from "./PortfolioValueChart";
import {
  downloadExcel, parseHoldingsExcel,
  sc, plCell,
  S_SECTION_HEADER, S_COL_HEADER, S_TOTAL, S_META_LABEL,
  S_METRIC_LABEL, S_METRIC_VAL, S_DATA, S_ALT_ROW,
} from "@/utils/excel";
import type { StyledCell } from "@/utils/excel";
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

  const handleExportExcel = useCallback(() => {
    const unrealized     = current - invested;
    const totalPL        = unrealized + realized;
    const totalReturnPct = invested > 0 ? (totalPL / invested) * 100 : 0;
    const netWorth       = current + cashBalance;
    const today          = new Date().toISOString().slice(0, 10);

    const sells = transactions.filter((t) => t.action === "SELL");
    const buys  = transactions.filter((t) => t.action === "BUY");
    const funds = transactions.filter((t) => t.action === "DEPOSIT" || t.action === "WITHDRAW");

    // ── Formatting helpers ────────────────────────────────────────────────────
    const inr = (n: number | null | undefined): string => {
      if (n == null || !isFinite(n)) return "—";
      const sign = n < 0 ? "-" : "";
      const abs  = Math.abs(n);
      if (abs >= 1_00_00_000) return `${sign}Rs. ${(abs / 1_00_00_000).toFixed(2)} Cr`;
      if (abs >= 1_00_000)    return `${sign}Rs. ${(abs / 1_00_000).toFixed(2)} L`;
      if (abs >= 1_000)       return `${sign}Rs. ${(abs / 1_000).toFixed(1)} K`;
      return `${sign}Rs. ${abs.toFixed(2)}`;
    };

    const raw = (n: number | null | undefined): string => {
      if (n == null || !isFinite(n)) return "—";
      const sign = n < 0 ? "-" : "";
      const abs  = Math.abs(n);
      const [int, frac = "00"] = abs.toFixed(2).split(".");
      const last3 = int.slice(-3);
      const rest  = int.slice(0, -3);
      const fmt   = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
      return `${sign}${fmt}.${frac}`;
    };

    const pct = (n: number | null | undefined): string =>
      n == null || !isFinite(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

    // Helper: create alternating-row styled cell
    const d = (v: string | number | null | undefined, alt: boolean): StyledCell =>
      sc(v, alt ? S_ALT_ROW : S_DATA);

    // Section title row spanning full width
    const sectionRow = (title: string) => [sc(title, S_SECTION_HEADER)];

    const csv: (string | number | StyledCell)[][] = [];

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 1 — PORTFOLIO SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(sectionRow("  PORTFOLIO SUMMARY"));
    csv.push([
      sc("Generated On", S_META_LABEL), sc(today, S_DATA), "",
      sc("Active Positions", S_META_LABEL), sc(rows.length, S_DATA), "",
      sc("Total Trades", S_META_LABEL), sc(buys.length + sells.length, S_DATA),
    ]);
    csv.push([]);

    // Key metrics block
    csv.push([sc("Metric", S_COL_HEADER), sc("Amount", S_COL_HEADER), sc("Exact (₹)", S_COL_HEADER)]);
    const metrics: [string, number | null][] = [
      ["Total Invested",       invested],
      ["Current Market Value", current],
      ["Cash Available",       cashBalance],
      ["Total Net Worth",      netWorth],
    ];
    metrics.forEach(([label, val]) => {
      csv.push([sc(label, S_METRIC_LABEL), sc(inr(val), S_METRIC_VAL), sc(raw(val), S_DATA)]);
    });
    csv.push([]);

    // P&L block
    csv.push([sc("P&L Breakdown", S_COL_HEADER), sc("Amount", S_COL_HEADER), sc("Return %", S_COL_HEADER)]);
    csv.push([sc("Unrealized P&L", S_METRIC_LABEL), plCell(unrealized, inr(unrealized)), sc(pct((unrealized / (invested || 1)) * 100), unrealized >= 0 ? { bold: true, fontColor: "1A6B3A" } : { bold: true, fontColor: "C0392B" })]);
    csv.push([sc("Realized P&L",   S_METRIC_LABEL), plCell(realized,   inr(realized)),   sc("—", S_DATA)]);
    csv.push([sc("Total P&L",      S_METRIC_LABEL), plCell(totalPL,    inr(totalPL)),     sc(pct(totalReturnPct), totalPL >= 0 ? { bold: true, fontColor: "1A6B3A" } : { bold: true, fontColor: "C0392B" })]);
    csv.push([]);

    // Performance block
    csv.push([sc("Performance", S_COL_HEADER), sc("Value", S_COL_HEADER), sc("Note", S_COL_HEADER)]);
    csv.push([sc("CAGR",         S_METRIC_LABEL), sc(cagr != null ? pct(cagr) : "—",  S_METRIC_VAL), sc(cagrYears != null ? `Over ${cagrYears.toFixed(2)} years` : "Needs >10 days of data", S_META_LABEL)]);
    csv.push([sc("Total Return", S_METRIC_LABEL), sc(pct(totalReturnPct),                S_METRIC_VAL), sc("Unrealized + Realized vs Invested", S_META_LABEL)]);
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 2 — CURRENT HOLDINGS
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(sectionRow(`  CURRENT HOLDINGS  (${rows.length} positions)`));
    csv.push([
      sc("Ticker", S_COL_HEADER), sc("Company", S_COL_HEADER), sc("Sector", S_COL_HEADER),
      sc("Qty", S_COL_HEADER),
      sc("Avg Buy Price", S_COL_HEADER), sc("CMP", S_COL_HEADER),
      sc("Invested", S_COL_HEADER), sc("Invested (Exact ₹)", S_COL_HEADER),
      sc("Market Value", S_COL_HEADER), sc("Mkt Val (Exact ₹)", S_COL_HEADER),
      sc("Unrealized P&L", S_COL_HEADER), sc("Unreal. (Exact ₹)", S_COL_HEADER), sc("P&L %", S_COL_HEADER),
      sc("Realized P&L (₹)", S_COL_HEADER),
      sc("Weight %", S_COL_HEADER),
      sc("Days Held", S_COL_HEADER), sc("First Buy Date", S_COL_HEADER),
    ]);
    rows.forEach((r, i) => {
      const alt = i % 2 === 1;
      csv.push([
        d(r.ticker, alt),
        d(r.name, alt),
        d(r.sector, alt),
        d(r.qty, alt),
        d(`₹ ${raw(r.avgPrice)}`, alt),
        d(`₹ ${raw(r.cp)}`, alt),
        d(inr(r.invested), alt),
        d(raw(r.invested), alt),
        d(inr(r.value), alt),
        d(raw(r.value), alt),
        plCell(r.pl, inr(r.pl)),
        d(raw(r.pl), alt),
        sc(pct(r.plPct), r.plPct >= 0 ? { fontColor: "1A6B3A", bold: true, border: true } : { fontColor: "C0392B", bold: true, border: true }),
        d(raw(r.realized), alt),
        d(`${r.weight.toFixed(2)}%`, alt),
        d(r.daysHeld != null ? `${r.daysHeld} days` : "—", alt),
        d(r.buyDate ?? "—", alt),
      ]);
    });

    // Totals row
    csv.push([
      sc("PORTFOLIO TOTAL", S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL),
      sc(rows.reduce((s, r) => s + r.qty, 0), S_TOTAL),
      sc("", S_TOTAL), sc("", S_TOTAL),
      sc(inr(invested), S_TOTAL), sc(raw(invested), S_TOTAL),
      sc(inr(current), S_TOTAL), sc(raw(current), S_TOTAL),
      plCell(unrealized, inr(unrealized)),
      sc(raw(unrealized), S_TOTAL),
      sc(pct(totalReturnPct), totalReturnPct >= 0 ? { ...S_TOTAL, fontColor: "1A6B3A" } : { ...S_TOTAL, fontColor: "C0392B" }),
      sc(raw(realized), S_TOTAL),
      sc("100%", S_TOTAL),
      sc("", S_TOTAL), sc("", S_TOTAL),
    ]);
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 3 — SELL HISTORY
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(sectionRow(`  SELL HISTORY  (${sells.length} trades)`));
    if (sells.length === 0) {
      csv.push([sc("No sales recorded yet. Sell a stock to see history here.", S_META_LABEL)]);
    } else {
      csv.push([
        sc("Sell Date", S_COL_HEADER), sc("Buy Date", S_COL_HEADER), sc("Ticker", S_COL_HEADER),
        sc("Qty Sold", S_COL_HEADER),
        sc("Avg Buy Price", S_COL_HEADER), sc("Sell Price", S_COL_HEADER),
        sc("Amount Received", S_COL_HEADER), sc("Received (Exact ₹)", S_COL_HEADER),
        sc("Profit / Loss", S_COL_HEADER), sc("P&L (Exact ₹)", S_COL_HEADER), sc("P&L %", S_COL_HEADER),
        sc("Holding Period", S_COL_HEADER), sc("Tax Category", S_COL_HEADER),
      ]);
      const sortedSells = [...sells].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      sortedSells.forEach((t, i) => {
        const profit = t.meta?.profit ?? 0;
        const alt = i % 2 === 1;
        csv.push([
          d(t.date, alt),
          d(t.meta?.buyDate ?? "—", alt),
          d(t.stock ?? "—", alt),
          d(t.qty ?? "—", alt),
          d(t.meta?.avgCost != null ? `₹ ${raw(t.meta.avgCost)}` : "—", alt),
          d(t.price != null         ? `₹ ${raw(t.price)}`        : "—", alt),
          d(inr(t.amount), alt),
          d(raw(t.amount), alt),
          plCell(profit, inr(profit)),
          d(raw(profit), alt),
          sc(t.meta?.profitPct != null ? pct(t.meta.profitPct) : "—",
            (t.meta?.profitPct ?? 0) >= 0
              ? { fontColor: "1A6B3A", bold: true, border: true }
              : { fontColor: "C0392B", bold: true, border: true }),
          d(t.meta?.holdingDays != null ? `${t.meta.holdingDays} days` : "—", alt),
          sc(t.meta?.type ?? "—", t.meta?.type === "LTCG"
            ? { bgColor: "D5F5E3", fontColor: "1A6B3A", bold: true, border: true }
            : { bgColor: "FDECEA", fontColor: "C0392B", bold: true, border: true }),
        ]);
      });
      csv.push([]);
      csv.push([
        sc("TOTAL REALIZED P&L", S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL),
        sc("", S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL),
        sc(inr(realized), S_TOTAL), sc(raw(realized), S_TOTAL),
        sc("", S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL),
      ]);
    }
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 4 — BUY HISTORY
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(sectionRow(`  BUY HISTORY  (${buys.length} trades)`));
    if (buys.length === 0) {
      csv.push([sc("No buys recorded yet.", S_META_LABEL)]);
    } else {
      csv.push([
        sc("Buy Date", S_COL_HEADER), sc("Ticker", S_COL_HEADER),
        sc("Qty Bought", S_COL_HEADER), sc("Buy Price", S_COL_HEADER),
        sc("Total Deployed", S_COL_HEADER), sc("Deployed (Exact ₹)", S_COL_HEADER),
        sc("Avg Cost After Buy", S_COL_HEADER),
      ]);
      const sortedBuys = [...buys].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      sortedBuys.forEach((t, i) => {
        const alt = i % 2 === 1;
        csv.push([
          d(t.date, alt),
          d(t.stock ?? "—", alt),
          d(t.qty ?? "—", alt),
          d(t.price != null ? `₹ ${raw(t.price)}` : "—", alt),
          d(inr(t.amount), alt),
          d(raw(t.amount), alt),
          d(t.meta?.avgCost != null ? `₹ ${raw(t.meta.avgCost)}` : "—", alt),
        ]);
      });
      const totalBought = buys.reduce((s, t) => s + t.amount, 0);
      csv.push([]);
      csv.push([
        sc("TOTAL CAPITAL DEPLOYED", S_TOTAL), sc("", S_TOTAL),
        sc("", S_TOTAL), sc("", S_TOTAL),
        sc(inr(totalBought), S_TOTAL), sc(raw(totalBought), S_TOTAL), sc("", S_TOTAL),
      ]);
    }
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 5 — FUND HISTORY  (Deposits & Withdrawals)
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(sectionRow("  FUND HISTORY  (Deposits & Withdrawals)"));
    const totalDeposits    = funds.filter((t) => t.action === "DEPOSIT").reduce((s, t) => s + t.amount, 0);
    const totalWithdrawals = funds.filter((t) => t.action === "WITHDRAW").reduce((s, t) => s + t.amount, 0);
    if (funds.length === 0) {
      csv.push([sc("No fund movements yet. Add funds to get started.", S_META_LABEL)]);
    } else {
      csv.push([
        sc("Date", S_COL_HEADER), sc("Type", S_COL_HEADER),
        sc("Amount", S_COL_HEADER), sc("Amount (Exact ₹)", S_COL_HEADER),
        sc("Running Balance", S_COL_HEADER), sc("Balance (Exact ₹)", S_COL_HEADER),
      ]);
      const sortedFunds = [...funds].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      let runBal = 0;
      sortedFunds.forEach((t, i) => {
        const isDeposit = t.action === "DEPOSIT";
        runBal += isDeposit ? t.amount : -t.amount;
        const alt = i % 2 === 1;
        csv.push([
          d(t.date, alt),
          sc(isDeposit ? "Deposit  ▲" : "Withdrawal  ▼",
            isDeposit
              ? { bgColor: "D5F5E3", fontColor: "1A6B3A", bold: true, border: true }
              : { bgColor: "FDECEA", fontColor: "C0392B", bold: true, border: true }),
          d(inr(t.amount), alt),
          d(raw(t.amount), alt),
          d(inr(runBal), alt),
          d(raw(runBal), alt),
        ]);
      });
      csv.push([]);
      csv.push([sc("Total Deposited",    S_TOTAL), sc("", S_TOTAL), sc(inr(totalDeposits),                    S_TOTAL), sc(raw(totalDeposits),                    S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL)]);
      csv.push([sc("Total Withdrawn",    S_TOTAL), sc("", S_TOTAL), sc(inr(totalWithdrawals),                 S_TOTAL), sc(raw(totalWithdrawals),                 S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL)]);
      csv.push([sc("Net Funds Injected", S_TOTAL), sc("", S_TOTAL), sc(inr(totalDeposits - totalWithdrawals), S_TOTAL), sc(raw(totalDeposits - totalWithdrawals), S_TOTAL), sc("", S_TOTAL), sc("", S_TOTAL)]);
    }
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 6 — PORTFOLIO VALUE TIMELINE
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(sectionRow("  PORTFOLIO VALUE TIMELINE"));
    csv.push([sc("Tip: Select Date + Total Portfolio Value columns → Insert > Line Chart to visualise growth over time.", S_META_LABEL)]);
    csv.push([
      sc("Date", S_COL_HEADER), sc("Event", S_COL_HEADER),
      sc("Stock", S_COL_HEADER), sc("Qty", S_COL_HEADER), sc("Price", S_COL_HEADER),
      sc("Cash Balance", S_COL_HEADER), sc("Cash (₹)", S_COL_HEADER),
      sc("Holdings Cost Basis", S_COL_HEADER), sc("Holdings (₹)", S_COL_HEADER),
      sc("Total Portfolio Value", S_COL_HEADER), sc("Total Value (₹)", S_COL_HEADER),
    ]);
    const allTxChron = [...transactions].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    let tlCash = 0;
    const tlHoldings: Record<string, { qty: number; avgPrice: number }> = {};
    allTxChron.forEach((t, i) => {
      if (t.action === "DEPOSIT") {
        tlCash += t.amount;
      } else if (t.action === "WITHDRAW") {
        tlCash -= t.amount;
      } else if (t.action === "BUY" && t.stock && t.qty && t.price) {
        tlCash -= t.amount;
        const ex = tlHoldings[t.stock];
        if (ex) {
          const nq = ex.qty + t.qty;
          tlHoldings[t.stock] = { qty: nq, avgPrice: (ex.avgPrice * ex.qty + t.price * t.qty) / nq };
        } else {
          tlHoldings[t.stock] = { qty: t.qty, avgPrice: t.price };
        }
      } else if (t.action === "SELL" && t.stock && t.qty) {
        tlCash += t.amount;
        const ex = tlHoldings[t.stock];
        if (ex) {
          const nq = ex.qty - t.qty;
          if (nq <= 0) delete tlHoldings[t.stock];
          else tlHoldings[t.stock] = { ...ex, qty: nq };
        }
      }
      const holdingsBasis = Object.values(tlHoldings).reduce((s, h) => s + h.qty * h.avgPrice, 0);
      const totalVal      = tlCash + holdingsBasis;
      const alt = i % 2 === 1;

      // Color the event type cell
      const eventStyle =
        t.action === "BUY"      ? { bgColor: "D5F5E3", fontColor: "1A6B3A", bold: true, border: true } :
        t.action === "SELL"     ? { bgColor: "FDECEA", fontColor: "C0392B", bold: true, border: true } :
        t.action === "DEPOSIT"  ? { bgColor: "EAF4FF", fontColor: "2E5A9C", bold: true, border: true } :
                                  { bgColor: "FFF8E7", fontColor: "9B6B00", bold: true, border: true };

      csv.push([
        d(t.date, alt),
        sc(t.action, eventStyle),
        d(t.stock ?? "—", alt),
        d(t.qty?.toString() ?? "—", alt),
        d(t.price != null ? `₹ ${raw(t.price)}` : "—", alt),
        d(inr(tlCash), alt),
        d(raw(tlCash), alt),
        d(inr(holdingsBasis), alt),
        d(raw(holdingsBasis), alt),
        d(inr(totalVal), alt),
        d(raw(totalVal), alt),
      ]);
    });

    downloadExcel([{ name: "Portfolio Report", rows: csv }], `portfolio-${today}.xlsx`);
  }, [rows, invested, current, realized, cashBalance, cagr, cagrYears, transactions]);


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
        onExportExcel={handleExportExcel}
        onImportExcel={onImportHoldings ? async (file) => {
          const { holdings, errors } = await parseHoldingsExcel(file);
          if (errors.length) errors.slice(0, 3).forEach((e) => toast.error(e));
          if (holdings.length === 0) {
            toast.error("No valid rows found in Excel file. Please check the format and try again.");
            return;
          }
          onImportHoldings(holdings);
          toast.success(
            `✅ Successfully imported ${holdings.length} holding${holdings.length === 1 ? "" : "s"} from Excel!` +
            (errors.length ? ` (${errors.length} row${errors.length === 1 ? "" : "s"} skipped — check errors above)` : "")
          );
        } : undefined}
        canSell={portfolio.length > 0}
        canExport={portfolio.length > 0}
      />
      <HoldingsTable rows={rows} onSell={onSell} />
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
