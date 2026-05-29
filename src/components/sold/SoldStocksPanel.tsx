import { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import type { Transaction } from "@/types/portfolio.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatNumber } from "@/utils/formatters";
import { downloadCSV } from "@/utils/csv";
import { downloadExcel, toSerial, S, n, t, empty } from "@/utils/excel";
import type { CellDef } from "@/utils/excel";

interface Props {
  transactions: Transaction[];
}

/**
 * Expand each SELL transaction into per-FIFO-lot rows — exactly like Angel One's
 * "Trade Overview" which shows one row per consumed buy lot.
 */
interface TradeRow {
  txId: string;
  stock: string;
  sellDate: string;
  sellPrice: number;
  buyDate: string;
  buyPrice: number;
  qty: number;
  /** Gross P&L for this lot slice (before charges). */
  grossProfit: number;
  /** Net P&L for this lot slice (after pro-rated charges). */
  netProfit: number;
  holdingDays: number;
  taxType: "LTCG" | "STCG";
  charges: number; // pro-rated charges for this slice
}

export function SoldStocksPanel({ transactions }: Props) {
  const sells = useMemo(
    () =>
      transactions
        .filter((tx) => tx.action === "SELL")
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [transactions]
  );

  /**
   * Expand sells into per-lot trade rows.
   * If fifoLots breakdown is stored on the tx, use it.
   * Otherwise fall back to one row per sell (legacy data).
   */
  const tradeRows = useMemo<TradeRow[]>(() => {
    const rows: TradeRow[] = [];
    for (const tx of sells) {
      const fifoLots = tx.meta?.fifoLots;
      const totalQty = tx.qty ?? 0;
      const sellPrice = tx.price ?? 0;
      const totalCharges = tx.meta?.charges ?? 0;

      if (fifoLots && fifoLots.length > 0) {
        // One row per FIFO lot consumed (Angel One style)
        for (const lot of fifoLots) {
          // lot.lotProfit is already net (charges pro-rated in fifo.ts)
          const proRatedCharges = totalQty > 0 ? (lot.qtySold / totalQty) * totalCharges : 0;
          const lotGross = lot.lotProfit + proRatedCharges; // reverse to get gross
          rows.push({
            txId: tx.id + "-" + lot.lotId,
            stock: tx.stock ?? "",
            sellDate: tx.date,
            sellPrice,
            buyDate: lot.lotDate,
            buyPrice: lot.lotPrice,
            qty: lot.qtySold,
            grossProfit: lotGross,
            netProfit: lot.lotProfit,
            holdingDays: lot.holdingDays,
            taxType: lot.taxType,
            charges: proRatedCharges,
          });
        }
      } else {
        // Legacy: single row per sell, use stored gross/net
        const netP = tx.meta?.profit ?? 0;
        const grossP = tx.meta?.grossProfit ?? netP + totalCharges;
        rows.push({
          txId: tx.id,
          stock: tx.stock ?? "",
          sellDate: tx.date,
          sellPrice,
          buyDate: tx.meta?.buyDate ?? "",
          buyPrice: tx.meta?.avgCost ?? 0,
          qty: totalQty,
          grossProfit: grossP,
          netProfit: netP,
          holdingDays: tx.meta?.holdingDays ?? 0,
          taxType: (tx.meta?.type as "LTCG" | "STCG") ?? "STCG",
          charges: totalCharges,
        });
      }
    }
    return rows;
  }, [sells]);

  const totals = useMemo(() => {
    let grossProfit = 0;
    let charges = 0;
    let proceeds = 0;
    for (const tx of sells) {
      const net = tx.meta?.profit ?? 0;
      const ch = tx.meta?.charges ?? 0;
      const gross = tx.meta?.grossProfit ?? net + ch;
      grossProfit += gross;
      charges += ch;
      proceeds += tx.amount;
    }
    return { grossProfit, charges, netProfit: grossProfit - charges, proceeds };
  }, [sells]);

  const exportCSV = () => {
    downloadCSV(
      [
        ["Sell Date", "Buy Date", "Stock", "Qty", "Buy ₹", "Sell ₹", "Gross P&L", "Charges", "Net P&L", "Days", "Type"],
        ...tradeRows.map((r) => [
          r.sellDate,
          r.buyDate,
          r.stock,
          r.qty,
          r.buyPrice,
          r.sellPrice,
          r.grossProfit.toFixed(2),
          r.charges.toFixed(2),
          r.netProfit.toFixed(2),
          r.holdingDays,
          r.taxType,
        ]),
      ],
      `sold-stocks-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const exportExcel = () => {
    const headers: (CellDef | null)[] = [
      t("Sell Date", S.COL_HEADER),
      t("Buy Date", S.COL_HEADER),
      t("Stock", S.COL_HEADER),
      t("Qty", S.COL_HEADER),
      t("Buy ₹", S.COL_HEADER),
      t("Sell ₹", S.COL_HEADER),
      t("Gross P&L", S.COL_HEADER),
      t("Charges", S.COL_HEADER),
      t("Net P&L", S.COL_HEADER),
      t("Days", S.COL_HEADER),
      t("Type", S.COL_HEADER),
    ];
    const dataRows = tradeRows.map((r, i): (CellDef | null)[] => {
      const alt = i % 2 === 1;
      const dateS = alt ? S.SELL_DATE_B : S.SELL_DATE;
      const textS = alt ? S.SELL_TEXT_B : S.SELL_TEXT;
      const inrS = alt ? S.SELL_INR_B : S.SELL_INR;
      const daysS = S.SELL_DAYS;
      const profitS = r.netProfit >= 0 ? S.SELL_PROFIT_G : S.SELL_PROFIT_R;
      const typeS = r.taxType === "LTCG" ? S.SELL_LTCG : S.SELL_STCG;
      return [
        n(toSerial(r.sellDate), dateS),
        n(toSerial(r.buyDate), dateS),
        t(r.stock, textS),
        n(r.qty, daysS),
        n(r.buyPrice, inrS),
        n(r.sellPrice, inrS),
        n(r.grossProfit, profitS),
        n(r.charges, inrS),
        n(r.netProfit, profitS),
        n(r.holdingDays, daysS),
        t(r.taxType, typeS),
      ];
    });
    const totalRow: (CellDef | null)[] = [
      t("TOTAL", S.TOTAL_LABEL),
      empty(S.TOTAL_EMPTY), empty(S.TOTAL_EMPTY), empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY), empty(S.TOTAL_EMPTY),
      n(totals.grossProfit, S.TOTAL_INR),
      n(totals.charges, S.TOTAL_INR),
      n(totals.netProfit, S.TOTAL_INR),
      empty(S.TOTAL_EMPTY), empty(S.TOTAL_EMPTY),
    ];
    const widths = [12, 12, 14, 8, 12, 12, 14, 12, 14, 8, 8];
    downloadExcel(
      [headers, ...dataRows, totalRow],
      widths,
      `sold-stocks-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Angel One-style P&L Summary Card ── */}
      <div className="rounded-2xl bg-[#1e2533] text-white p-5 space-y-3 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Realised P&amp;L</div>
            <div className={`text-2xl font-bold font-mono ${totals.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totals.grossProfit >= 0 ? "+" : ""}₹{formatNumber(totals.grossProfit, 2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Charges</div>
            <div className="text-base font-mono text-white">₹{formatNumber(totals.charges, 2)}</div>
          </div>
        </div>
        <div className="rounded-xl bg-white/10 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Net Realised P&amp;L</div>
            <div className="text-[11px] text-gray-400 mt-0.5">= Realised P&amp;L − Charges</div>
          </div>
          <div className={`text-xl font-bold font-mono ${totals.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totals.netProfit >= 0 ? "+" : ""}₹{formatNumber(totals.netProfit, 2)}
          </div>
        </div>
      </div>

      {/* ── Stat chips ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total Proceeds" value={formatINR(totals.proceeds)} />
        <Stat label="Gross P&L" value={`${totals.grossProfit >= 0 ? "+" : ""}${formatINR(totals.grossProfit)}`} tone={totals.grossProfit >= 0 ? "gain" : "loss"} />
        <Stat label="Total Charges" value={formatINR(totals.charges)} />
      </div>

      {/* ── Header + export ── */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Trade Overview</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 minimal:rounded-none">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={tradeRows.length === 0} className="gap-2 minimal:rounded-none">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* ── Trade Overview — one row per FIFO lot (Angel One style) ── */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              <th className="px-3 py-2.5 font-medium">
                Avg Sell Price<br />
                <span className="text-[10px] normal-case font-normal">(Sell Date)</span>
              </th>
              <th className="px-3 py-2.5 font-medium">
                Avg Buy Price<br />
                <span className="text-[10px] normal-case font-normal">(Buy Date)</span>
              </th>
              <th className="px-3 py-2.5 text-right font-medium">Qty</th>
              <th className="px-3 py-2.5 text-right font-medium">Stock</th>
              <th className="px-3 py-2.5 text-right font-medium">Gross P&amp;L</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Charges</th>
              <th className="px-3 py-2.5 text-right font-medium">Net P&amp;L</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Days</th>
              <th className="hidden px-3 py-2.5 font-medium md:table-cell">Tax</th>
            </tr>
          </thead>
          <tbody>
            {tradeRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  No sold stocks yet.
                </td>
              </tr>
            ) : (
              tradeRows.map((r) => {
                const grossTone = r.grossProfit >= 0 ? "text-gain" : "text-loss";
                const netTone = r.netProfit >= 0 ? "text-gain" : "text-loss";
                return (
                  <tr key={r.txId} className="border-b border-border hover:bg-accent/30">
                    {/* Sell price + date (stacked) */}
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold">{formatINR(r.sellPrice)}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{r.sellDate}</div>
                    </td>
                    {/* Buy price + date (stacked) */}
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold">{r.buyPrice ? formatINR(r.buyPrice) : "—"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{r.buyDate || "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{r.qty}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{r.stock}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${grossTone}`}>
                      {r.grossProfit >= 0 ? "+" : ""}₹{formatNumber(r.grossProfit, 2)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right font-mono text-muted-foreground md:table-cell">
                      ₹{formatNumber(r.charges, 2)}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${netTone}`}>
                      {r.netProfit >= 0 ? "+" : ""}₹{formatNumber(r.netProfit, 2)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right font-mono text-xs text-muted-foreground md:table-cell">
                      {r.holdingDays}d
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 ${
                          r.taxType === "LTCG"
                            ? "border-gain text-gain"
                            : "border-amber-500 text-amber-500"
                        }`}
                      >
                        {r.taxType}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {tradeRows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/30 text-xs font-semibold">
                <td colSpan={4} className="px-3 py-2 text-muted-foreground">Total</td>
                <td className={`px-3 py-2 text-right font-mono ${totals.grossProfit >= 0 ? "text-gain" : "text-loss"}`}>
                  {totals.grossProfit >= 0 ? "+" : ""}₹{formatNumber(totals.grossProfit, 2)}
                </td>
                <td className="hidden px-3 py-2 text-right font-mono text-muted-foreground md:table-cell">
                  ₹{formatNumber(totals.charges, 2)}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${totals.netProfit >= 0 ? "text-gain" : "text-loss"}`}>
                  {totals.netProfit >= 0 ? "+" : ""}₹{formatNumber(totals.netProfit, 2)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 creative:shadow-soft minimal:rounded-none">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
