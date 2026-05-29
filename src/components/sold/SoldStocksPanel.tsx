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

/** Sold-stocks history (every SELL transaction with realized P&L). */
export function SoldStocksPanel({ transactions }: Props) {
  const sells = useMemo(
    () =>
      transactions
        .filter((t) => t.action === "SELL")
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [transactions]
  );

  const totals = useMemo(() => {
    let realized = 0;
    let proceeds = 0;
    let cost = 0;
    let charges = 0;
    for (const tx of sells) {
      const p = tx.meta?.profit ?? 0;
      const c = tx.meta?.charges ?? 0;
      realized += p + c; // gross profit
      charges += c;
      proceeds += tx.amount;
      cost += tx.amount - p;
    }
    const grossProfit = realized;
    const netProfit = grossProfit - charges;
    return { grossProfit, netProfit, proceeds, cost, charges };
  }, [sells]);

  const exportCSV = () => {
    downloadCSV(
      [
        ["Sell Date", "Buy Date", "Stock", "Qty", "Buy ₹", "Sell ₹", "Proceeds", "Profit", "P/L %", "Days", "Type"],
        ...sells.map((t) => [
          t.date,
          t.meta?.buyDate ?? "",
          t.stock ?? "",
          t.qty ?? "",
          t.meta?.avgCost ?? "",
          t.price ?? "",
          t.amount,
          t.meta?.profit ?? "",
          t.meta?.profitPct ?? "",
          t.meta?.holdingDays ?? "",
          t.meta?.type ?? "",
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
      t("Gross", S.COL_HEADER),
      t("Charges", S.COL_HEADER),
      t("Net Proceeds", S.COL_HEADER),
      t("Profit", S.COL_HEADER),
      t("P/L %", S.COL_HEADER),
      t("Days", S.COL_HEADER),
      t("Type", S.COL_HEADER),
    ];
    const dataRows = sells.map((tx, i): (CellDef | null)[] => {
      const alt = i % 2 === 1;
      const dateS = alt ? S.SELL_DATE_B : S.SELL_DATE;
      const textS = alt ? S.SELL_TEXT_B : S.SELL_TEXT;
      const inrS = alt ? S.SELL_INR_B : S.SELL_INR;
      const daysS = S.SELL_DAYS;
      const profit = tx.meta?.profit ?? 0;
      const profitS = profit >= 0 ? S.SELL_PROFIT_G : S.SELL_PROFIT_R;
      const typeS = (tx.meta?.type === "LTCG") ? S.SELL_LTCG : S.SELL_STCG;
      return [
        n(toSerial(tx.date), dateS),
        n(toSerial(tx.meta?.buyDate ?? null), dateS),
        t(tx.stock ?? "", textS),
        n(tx.qty ?? 0, daysS),
        n(tx.meta?.avgCost ?? null, inrS),
        n(tx.price ?? null, inrS),
        n(tx.meta?.grossAmount ?? tx.amount, inrS),
        n(tx.meta?.charges ?? 0, inrS),
        n(tx.amount, inrS),
        n(profit, profitS),
        n(tx.meta?.profitPct != null ? tx.meta.profitPct / 100 : null, inrS),
        n(tx.meta?.holdingDays ?? null, daysS),
        t(tx.meta?.type ?? "", typeS),
      ];
    });
    const totalRow: (CellDef | null)[] = [
      t("TOTAL", S.TOTAL_LABEL),
      empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY),
      n(totals.proceeds, S.TOTAL_INR),
      n(totals.netProfit, S.TOTAL_INR),
      empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY),
      empty(S.TOTAL_EMPTY),
    ];
    const widths = [12, 12, 14, 8, 12, 12, 14, 12, 14, 14, 10, 8, 8];
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

      {/* ── Stat chips row ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total Proceeds" value={formatINR(totals.proceeds)} />
        <Stat label="Total Cost" value={formatINR(totals.cost)} />
        <Stat label="Total Charges" value={formatINR(totals.charges)} />
      </div>

      {/* ── Header + export buttons ── */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Trade Overview</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 minimal:rounded-none">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={sells.length === 0} className="gap-2 minimal:rounded-none">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* ── Trade Overview table (Angel One style) ── */}
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
              <th className="px-3 py-2.5 text-right font-medium">P&amp;L</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">P/L %</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Days</th>
              <th className="hidden px-3 py-2.5 font-medium md:table-cell">Type</th>
            </tr>
          </thead>
          <tbody>
            {sells.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No sold stocks yet.</td></tr>
            ) : sells.map((tx) => {
              const profit = tx.meta?.profit ?? 0;
              const tone = profit >= 0 ? "text-gain" : "text-loss";
              return (
                <tr key={tx.id} className="border-b border-border hover:bg-accent/30">
                  {/* Sell price + date (stacked like Angel One) */}
                  <td className="px-3 py-2.5">
                    <div className="font-mono font-semibold">{tx.price != null ? formatINR(tx.price) : "—"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{tx.date}</div>
                  </td>
                  {/* Buy price + date stacked */}
                  <td className="px-3 py-2.5">
                    <div className="font-mono font-semibold">
                      {tx.meta?.avgCost != null ? formatINR(tx.meta.avgCost) : "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {tx.meta?.buyDate ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{tx.qty}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">{tx.stock}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${tone}`}>
                    {profit >= 0 ? "+" : ""}₹{formatNumber(profit, 2)}
                  </td>
                  <td className={`hidden px-3 py-2.5 text-right font-mono md:table-cell ${tone}`}>
                    {tx.meta?.profitPct != null ? `${tx.meta.profitPct >= 0 ? "+" : ""}${formatNumber(tx.meta.profitPct, 2)}%` : "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-mono text-xs text-muted-foreground md:table-cell">
                    {tx.meta?.holdingDays != null ? `${tx.meta.holdingDays}d` : "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {tx.meta?.type && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 ${
                          tx.meta.type === "LTCG"
                            ? "border-gain text-gain"
                            : "border-amber-500 text-amber-500"
                        }`}
                      >
                        {tx.meta.type}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {sells.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/30 text-xs font-semibold">
                <td colSpan={4} className="px-3 py-2 text-muted-foreground">Total</td>
                <td className={`px-3 py-2 text-right font-mono ${totals.netProfit >= 0 ? "text-gain" : "text-loss"}`}>
                  {totals.netProfit >= 0 ? "+" : ""}₹{formatNumber(totals.netProfit, 2)}
                </td>
                <td colSpan={3} />
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
