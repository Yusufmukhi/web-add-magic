import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStockQuotes } from "@/hooks/useStockQuote";
import type { Holding, HoldingRow, Transaction } from "@/types/portfolio.types";
import { PortfolioStats } from "./PortfolioStats";
import { HoldingsTable } from "./HoldingsTable";
import { AllocationDonut } from "./AllocationDonut";
import { PortfolioActions } from "./PortfolioActions";
import { PortfolioValueChart } from "./PortfolioValueChart";
import { downloadExcel, parseHoldingsExcel } from "@/utils/excel";
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
    // Human-readable: Rs. 1.10 Cr | Rs. 2.50 L | Rs. 45.3 K | Rs. 999.00
    const inr = (n: number | null | undefined): string => {
      if (n == null || !isFinite(n)) return "—";
      const sign = n < 0 ? "-" : "";
      const abs  = Math.abs(n);
      if (abs >= 1_00_00_000) return `${sign}Rs. ${(abs / 1_00_00_000).toFixed(2)} Cr`;
      if (abs >= 1_00_000)    return `${sign}Rs. ${(abs / 1_00_000).toFixed(2)} L`;
      if (abs >= 1_000)       return `${sign}Rs. ${(abs / 1_000).toFixed(1)} K`;
      return `${sign}Rs. ${abs.toFixed(2)}`;
    };

    // Exact rupee with Indian comma style: 1,10,50,000.00
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

    // Percentage with sign: +12.34% | -3.50%
    const pct = (n: number | null | undefined): string =>
      n == null || !isFinite(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

    // Gain/loss arrow for readability
    const arrow = (n: number): string => (n >= 0 ? "▲" : "▼");

    const csv: (string | number)[][] = [];

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 1 — PORTFOLIO SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(["============================================================"]);
    csv.push(["  SECTION 1 — PORTFOLIO SUMMARY"]);
    csv.push(["============================================================"]);
    csv.push(["Generated On", today, "", "Active Positions", rows.length, "", "Total Trades", buys.length + sells.length]);
    csv.push([]);
    csv.push(["Metric", "Readable Amount", "Exact Amount (₹)"]);
    csv.push(["Total Invested",       inr(invested),    raw(invested)]);
    csv.push(["Current Market Value", inr(current),     raw(current)]);
    csv.push(["Cash Available",       inr(cashBalance), raw(cashBalance)]);
    csv.push(["Total Net Worth",      inr(netWorth),    raw(netWorth)]);
    csv.push([]);
    csv.push(["P&L Breakdown", "Readable Amount", "Return %"]);
    csv.push(["Unrealized P&L",  `${arrow(unrealized)} ${inr(unrealized)}`,  pct((unrealized / (invested || 1)) * 100)]);
    csv.push(["Realized P&L",    `${arrow(realized)}  ${inr(realized)}`,     "—"]);
    csv.push(["Total P&L",       `${arrow(totalPL)}  ${inr(totalPL)}`,       pct(totalReturnPct)]);
    csv.push([]);
    csv.push(["Performance",     "Value", "Note"]);
    csv.push(["CAGR",       cagr != null ? pct(cagr) : "—",                          cagrYears != null ? `Over ${cagrYears.toFixed(2)} years` : "Needs >10 days of data"]);
    csv.push(["Total Return", pct(totalReturnPct),                                    "Unrealized + Realized vs Invested"]);
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 2 — CURRENT HOLDINGS
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(["============================================================"]);
    csv.push([`  SECTION 2 — CURRENT HOLDINGS  (${rows.length} positions)`]);
    csv.push(["============================================================"]);
    csv.push([
      "Ticker", "Company Name", "Sector",
      "Qty Held",
      "Avg Buy Price", "Current Price (CMP)",
      "Invested (Readable)", "Invested (Exact ₹)",
      "Market Value (Readable)", "Market Value (Exact ₹)",
      "Unrealized P&L (Readable)", "Unrealized P&L (Exact ₹)", "P&L %",
      "Realized P&L (Exact ₹)",
      "Portfolio Weight %",
      "Days Held", "First Buy Date",
    ]);
    rows.forEach((r) => {
      csv.push([
        r.ticker,
        r.name,
        r.sector,
        r.qty,
        `Rs. ${raw(r.avgPrice)}`,
        `Rs. ${raw(r.cp)}`,
        inr(r.invested),
        raw(r.invested),
        inr(r.value),
        raw(r.value),
        `${arrow(r.pl)} ${inr(r.pl)}`,
        raw(r.pl),
        pct(r.plPct),
        raw(r.realized),
        `${r.weight.toFixed(2)}%`,
        r.daysHeld != null ? `${r.daysHeld} days` : "—",
        r.buyDate ?? "—",
      ]);
    });
    csv.push([]);
    csv.push([
      "PORTFOLIO TOTAL", "", "",
      rows.reduce((s, r) => s + r.qty, 0),
      "", "",
      inr(invested), raw(invested),
      inr(current),  raw(current),
      `${arrow(unrealized)} ${inr(unrealized)}`, raw(unrealized), pct(totalReturnPct),
      raw(realized),
      "100%", "", "",
    ]);
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 3 — SELL HISTORY
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(["============================================================"]);
    csv.push([`  SECTION 3 — SELL HISTORY  (${sells.length} trades)`]);
    csv.push(["============================================================"]);
    if (sells.length === 0) {
      csv.push(["No sales recorded yet. Sell a stock to see history here."]);
    } else {
      csv.push([
        "Sell Date", "Buy Date", "Ticker",
        "Qty Sold",
        "Avg Buy Price", "Sell Price",
        "Amount Received (Readable)", "Amount Received (Exact ₹)",
        "Profit / Loss (Readable)", "Profit / Loss (Exact ₹)", "P&L %",
        "Holding Period", "Tax Category",
      ]);
      const sortedSells = [...sells].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      sortedSells.forEach((t) => {
        const profit = t.meta?.profit ?? 0;
        csv.push([
          t.date,
          t.meta?.buyDate ?? "—",
          t.stock ?? "—",
          t.qty ?? "—",
          t.meta?.avgCost != null ? `Rs. ${raw(t.meta.avgCost)}` : "—",
          t.price != null         ? `Rs. ${raw(t.price)}`        : "—",
          inr(t.amount),
          raw(t.amount),
          `${arrow(profit)} ${inr(profit)}`,
          raw(profit),
          t.meta?.profitPct != null ? pct(t.meta.profitPct) : "—",
          t.meta?.holdingDays != null ? `${t.meta.holdingDays} days` : "—",
          t.meta?.type ?? "—",
        ]);
      });
      csv.push([]);
      csv.push(["TOTAL REALIZED P&L", "", "", "", "", "", inr(realized), raw(realized), "", "", "", "", ""]);
    }
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 4 — BUY HISTORY
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(["============================================================"]);
    csv.push([`  SECTION 4 — BUY HISTORY  (${buys.length} trades)`]);
    csv.push(["============================================================"]);
    if (buys.length === 0) {
      csv.push(["No buys recorded yet."]);
    } else {
      csv.push([
        "Buy Date", "Ticker",
        "Qty Bought", "Buy Price",
        "Total Deployed (Readable)", "Total Deployed (Exact ₹)",
        "Avg Cost After This Buy",
      ]);
      const sortedBuys = [...buys].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      sortedBuys.forEach((t) => {
        csv.push([
          t.date,
          t.stock ?? "—",
          t.qty ?? "—",
          t.price != null ? `Rs. ${raw(t.price)}` : "—",
          inr(t.amount),
          raw(t.amount),
          t.meta?.avgCost != null ? `Rs. ${raw(t.meta.avgCost)}` : "—",
        ]);
      });
      const totalBought = buys.reduce((s, t) => s + t.amount, 0);
      csv.push([]);
      csv.push(["TOTAL CAPITAL DEPLOYED", "", "", "", inr(totalBought), raw(totalBought), ""]);
    }
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 5 — FUND HISTORY  (Deposits & Withdrawals)
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(["============================================================"]);
    csv.push(["  SECTION 5 — FUND HISTORY  (Deposits & Withdrawals)"]);
    csv.push(["============================================================"]);
    const totalDeposits    = funds.filter((t) => t.action === "DEPOSIT").reduce((s, t) => s + t.amount, 0);
    const totalWithdrawals = funds.filter((t) => t.action === "WITHDRAW").reduce((s, t) => s + t.amount, 0);
    if (funds.length === 0) {
      csv.push(["No fund movements yet. Add funds to get started."]);
    } else {
      csv.push(["Date", "Type", "Amount (Readable)", "Amount (Exact ₹)", "Running Balance (Readable)", "Running Balance (Exact ₹)"]);
      const sortedFunds = [...funds].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      let runBal = 0;
      sortedFunds.forEach((t) => {
        runBal += t.action === "DEPOSIT" ? t.amount : -t.amount;
        csv.push([
          t.date,
          t.action === "DEPOSIT" ? "Deposit  ▲" : "Withdrawal  ▼",
          inr(t.amount),
          raw(t.amount),
          inr(runBal),
          raw(runBal),
        ]);
      });
      csv.push([]);
      csv.push(["Total Deposited",    "", inr(totalDeposits),                           raw(totalDeposits),                           "", ""]);
      csv.push(["Total Withdrawn",    "", inr(totalWithdrawals),                        raw(totalWithdrawals),                        "", ""]);
      csv.push(["Net Funds Injected", "", inr(totalDeposits - totalWithdrawals),        raw(totalDeposits - totalWithdrawals),        "", ""]);
    }
    csv.push([]);
    csv.push([]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SECTION 6 — PORTFOLIO VALUE TIMELINE
    //  (Shows cost-basis portfolio value at every transaction event —
    //   paste this into Excel/Sheets to draw your growth chart)
    // ═══════════════════════════════════════════════════════════════════════
    csv.push(["============================================================"]);
    csv.push(["  SECTION 6 — PORTFOLIO VALUE TIMELINE"]);
    csv.push(["  Tip: Select Date + Total Portfolio Value columns in Excel"]);
    csv.push(["  and Insert > Line Chart to visualise growth over time."]);
    csv.push(["============================================================"]);
    csv.push([
      "Date", "Event", "Stock", "Qty", "Price",
      "Cash Balance (Readable)", "Cash Balance (₹)",
      "Holdings Cost Basis (Readable)", "Holdings Cost Basis (₹)",
      "Total Portfolio Value (Readable)", "Total Portfolio Value (₹)",
    ]);
    const allTxChron = [...transactions].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    let tlCash = 0;
    const tlHoldings: Record<string, { qty: number; avgPrice: number }> = {};
    allTxChron.forEach((t) => {
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
      csv.push([
        t.date,
        t.action,
        t.stock ?? "—",
        t.qty?.toString() ?? "—",
        t.price != null ? `Rs. ${raw(t.price)}` : "—",
        inr(tlCash),
        raw(tlCash),
        inr(holdingsBasis),
        raw(holdingsBasis),
        inr(totalVal),
        raw(totalVal),
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
