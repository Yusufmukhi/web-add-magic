import { useMemo } from "react";
import { Download } from "lucide-react";
import type { Transaction } from "@/types/portfolio.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatNumber } from "@/utils/formatters";
import { downloadCSV } from "@/utils/csv";

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
    for (const t of sells) {
      const p = t.meta?.profit ?? 0;
      realized += p;
      proceeds += t.amount;
      cost += t.amount - p;
    }
    return { realized, proceeds, cost };
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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total Realized P&L" value={formatINR(totals.realized)} tone={totals.realized >= 0 ? "gain" : "loss"} />
        <Stat label="Total Proceeds" value={formatINR(totals.proceeds)} />
        <Stat label="Total Cost" value={formatINR(totals.cost)} />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Sold Stocks History</h3>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 minimal:rounded-none">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              <th className="px-3 py-2.5 font-medium">Sell Date</th>
              <th className="px-3 py-2.5 font-medium">Stock</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty</th>
              <th className="px-3 py-2.5 text-right font-medium">Buy ₹</th>
              <th className="px-3 py-2.5 text-right font-medium">Sell ₹</th>
              <th className="px-3 py-2.5 text-right font-medium">P&amp;L</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">P/L %</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Days</th>
              <th className="hidden px-3 py-2.5 font-medium md:table-cell">Type</th>
            </tr>
          </thead>
          <tbody>
            {sells.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">No sold stocks yet.</td></tr>
            ) : sells.map((t) => {
              const profit = t.meta?.profit ?? 0;
              const tone = profit >= 0 ? "text-gain" : "text-loss";
              return (
                <tr key={t.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.date}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{t.stock}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.qty}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.meta?.avgCost != null ? formatINR(t.meta.avgCost) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatINR(t.price)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${tone}`}>
                    {profit >= 0 ? "+" : ""}{formatNumber(profit, 2)}
                  </td>
                  <td className={`hidden px-3 py-2 text-right font-mono md:table-cell ${tone}`}>
                    {t.meta?.profitPct != null ? `${t.meta.profitPct >= 0 ? "+" : ""}${formatNumber(t.meta.profitPct, 2)}%` : "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-right font-mono text-xs text-muted-foreground md:table-cell">
                    {t.meta?.holdingDays != null ? `${t.meta.holdingDays}d` : "—"}
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    {t.meta?.type && <Badge variant="outline" className="text-[10px]">{t.meta.type}</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
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
