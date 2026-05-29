import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, ArrowLeft, X } from "lucide-react";
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

interface TradeRow {
  txId: string;
  stock: string;
  sellDate: string;
  sellPrice: number;
  buyDate: string;
  buyPrice: number;
  qty: number;
  grossProfit: number;
  netProfit: number;
  holdingDays: number;
  taxType: "LTCG" | "STCG";
  charges: number;
  /** The full sell transaction this row belongs to */
  sellTxId: string;
}

/** Angel One style detail view for one sell transaction */
function SellDetailView({
  tx,
  tradeRows,
  onClose,
}: {
  tx: Transaction;
  tradeRows: TradeRow[];
  onClose: () => void;
}) {
  const totalCharges = tx.meta?.charges ?? 0;
  const netP = tx.meta?.profit ?? 0;
  const grossP = tx.meta?.grossProfit ?? netP + totalCharges;
  const totalQty = tx.qty ?? 0;
  const sellPrice = tx.price ?? 0;
  const totalBuyValue = tradeRows.reduce((s, r) => s + r.buyPrice * r.qty, 0);
  const totalSellValue = sellPrice * totalQty;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Trade Overview
      </button>

      {/* Angel One style P&L card */}
      <div className="rounded-2xl bg-[#1e2533] text-white p-5 space-y-3 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Realised P&L</div>
            <div className={`text-2xl font-bold font-mono ${grossP >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {grossP >= 0 ? "+" : ""}₹{formatNumber(grossP, 2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Charges</div>
            <div className="text-base font-mono text-white">₹{formatNumber(totalCharges, 2)}</div>
          </div>
        </div>
        <div className="rounded-xl bg-white/10 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Net Realised P&L</div>
            <div className="text-[11px] text-gray-400 mt-0.5">= Realised P&L − Charges</div>
          </div>
          <div className={`text-xl font-bold font-mono ${netP >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {netP >= 0 ? "+" : ""}₹{formatNumber(netP, 2)}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Quantity</div>
          <div className="font-mono font-semibold text-lg">{totalQty}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Product Type: Delivery</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Stock</div>
          <div className="font-mono font-semibold text-lg">{tx.stock}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{tx.date}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Avg Sell Price</div>
          <div className="font-mono font-semibold">{formatINR(sellPrice)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Total Sell Value</div>
          <div className="font-mono font-semibold">{formatINR(totalSellValue)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Avg Buy Price</div>
          <div className="font-mono font-semibold">
            {totalQty > 0 ? formatINR(totalBuyValue / totalQty) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Total Buy Value</div>
          <div className="font-mono font-semibold">{formatINR(totalBuyValue)}</div>
        </div>
      </div>

      {/* Trade overview table — Angel One style */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Trade Overview</h4>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">
                  Avg Sell Price<br />
                  <span className="text-[10px] normal-case font-normal">(Sell Date)</span>
                </th>
                <th className="px-3 py-2.5 font-medium">
                  Avg Buy Price<br />
                  <span className="text-[10px] normal-case font-normal">(Buy Date)</span>
                </th>
                <th className="px-3 py-2.5 text-right font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              {tradeRows.map((r) => (
                <tr key={r.txId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="font-mono font-semibold">{formatINR(r.sellPrice)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{r.sellDate}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono font-semibold">{r.buyPrice ? formatINR(r.buyPrice) : "—"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{r.buyDate || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">{r.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charges breakdown */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Charges Breakup</h4>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">Brokerage</span>
            <span className="font-mono">{formatINR(totalCharges)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono">{formatINR(totalCharges)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SoldStocksPanel({ transactions }: Props) {
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const sells = useMemo(
    () =>
      transactions
        .filter((tx) => tx.action === "SELL")
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [transactions]
  );

  const tradeRows = useMemo<TradeRow[]>(() => {
    const rows: TradeRow[] = [];
    for (const tx of sells) {
      const fifoLots = tx.meta?.fifoLots;
      const totalQty = tx.qty ?? 0;
      const sellPrice = tx.price ?? 0;
      const totalCharges = tx.meta?.charges ?? 0;

      if (fifoLots && fifoLots.length > 0) {
        for (const lot of fifoLots) {
          const proRatedCharges = totalQty > 0 ? (lot.qtySold / totalQty) * totalCharges : 0;
          const lotGross = lot.lotProfit + proRatedCharges;
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
            sellTxId: tx.id,
          });
        }
      } else {
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
          sellTxId: tx.id,
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
          r.sellDate, r.buyDate, r.stock, r.qty, r.buyPrice, r.sellPrice,
          r.grossProfit.toFixed(2), r.charges.toFixed(2), r.netProfit.toFixed(2), r.holdingDays, r.taxType,
        ]),
      ],
      `sold-stocks-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const exportExcel = () => {
    const headers: (CellDef | null)[] = [
      t("Sell Date", S.COL_HEADER), t("Buy Date", S.COL_HEADER), t("Stock", S.COL_HEADER),
      t("Qty", S.COL_HEADER), t("Buy ₹", S.COL_HEADER), t("Sell ₹", S.COL_HEADER),
      t("Gross P&L", S.COL_HEADER), t("Charges", S.COL_HEADER), t("Net P&L", S.COL_HEADER),
      t("Days", S.COL_HEADER), t("Type", S.COL_HEADER),
    ];
    const dataRows = tradeRows.map((r, i): (CellDef | null)[] => {
      const alt = i % 2 === 1;
      const dateS = alt ? S.SELL_DATE_B : S.SELL_DATE;
      const textS = alt ? S.SELL_TEXT_B : S.SELL_TEXT;
      const inrS = alt ? S.SELL_INR_B : S.SELL_INR;
      const profitS = r.netProfit >= 0 ? S.SELL_PROFIT_G : S.SELL_PROFIT_R;
      const typeS = r.taxType === "LTCG" ? S.SELL_LTCG : S.SELL_STCG;
      return [
        n(toSerial(r.sellDate), dateS), n(toSerial(r.buyDate), dateS),
        t(r.stock, textS), n(r.qty, S.SELL_DAYS),
        n(r.buyPrice, inrS), n(r.sellPrice, inrS),
        n(r.grossProfit, profitS), n(r.charges, inrS),
        n(r.netProfit, profitS), n(r.holdingDays, S.SELL_DAYS), t(r.taxType, typeS),
      ];
    });
    const totalRow: (CellDef | null)[] = [
      t("TOTAL", S.TOTAL_LABEL), empty(S.TOTAL_EMPTY), empty(S.TOTAL_EMPTY), empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY), empty(S.TOTAL_EMPTY),
      n(totals.grossProfit, S.TOTAL_INR), n(totals.charges, S.TOTAL_INR),
      n(totals.netProfit, S.TOTAL_INR), empty(S.TOTAL_EMPTY), empty(S.TOTAL_EMPTY),
    ];
    downloadExcel(
      [headers, ...dataRows, totalRow],
      [12, 12, 14, 8, 12, 12, 14, 12, 14, 8, 8],
      `sold-stocks-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Detail view for a selected sell tx
  if (selectedTxId) {
    const tx = sells.find((s) => s.id === selectedTxId);
    const rows = tradeRows.filter((r) => r.sellTxId === selectedTxId);
    if (tx) {
      return <SellDetailView tx={tx} tradeRows={rows} onClose={() => setSelectedTxId(null)} />;
    }
  }

  return (
    <div className="space-y-5">
      {/* Angel One-style P&L Summary Card */}
      <div className="rounded-2xl bg-[#1e2533] text-white p-5 space-y-3 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Realised P&L</div>
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
            <div className="text-sm font-semibold text-white">Net Realised P&L</div>
            <div className="text-[11px] text-gray-400 mt-0.5">= Realised P&L − Charges</div>
          </div>
          <div className={`text-xl font-bold font-mono ${totals.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totals.netProfit >= 0 ? "+" : ""}₹{formatNumber(totals.netProfit, 2)}
          </div>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total Proceeds" value={formatINR(totals.proceeds)} />
        <Stat label="Gross P&L" value={`${totals.grossProfit >= 0 ? "+" : ""}${formatINR(totals.grossProfit)}`} tone={totals.grossProfit >= 0 ? "gain" : "loss"} />
        <Stat label="Total Charges" value={formatINR(totals.charges)} />
      </div>

      {/* Header + export */}
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

      {/* Trade Overview table — grouped by sell transaction, clickable */}
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
              <th className="px-3 py-2.5 text-right font-medium">Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {tradeRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  No sold stocks yet.
                </td>
              </tr>
            ) : (
              tradeRows.map((r) => {
                const netTone = r.netProfit >= 0 ? "text-gain" : "text-loss";
                return (
                  <tr
                    key={r.txId}
                    className="border-b border-border hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => setSelectedTxId(r.sellTxId)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold">{formatINR(r.sellPrice)}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{r.sellDate}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold">{r.buyPrice ? formatINR(r.buyPrice) : "—"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{r.buyDate || "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{r.qty}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{r.stock}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${netTone}`}>
                      {r.netProfit >= 0 ? "+" : ""}₹{formatNumber(r.netProfit, 2)}
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
                <td className={`px-3 py-2 text-right font-mono ${totals.netProfit >= 0 ? "text-gain" : "text-loss"}`}>
                  {totals.netProfit >= 0 ? "+" : ""}₹{formatNumber(totals.netProfit, 2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">Tap any row to see full trade details</p>
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
