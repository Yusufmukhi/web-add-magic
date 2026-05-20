import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Transaction } from "@/types/portfolio.types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatNumber } from "@/utils/formatters";
import { downloadCSV } from "@/utils/csv";

interface Props {
  transactions: Transaction[];
}

/** Indian FY runs Apr 1 → Mar 31. Returns "YYYY-YY" label. */
function fyOf(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const isAfterApril = d.getMonth() >= 3; // Apr = 3
  const start = isAfterApril ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function TaxReportPanel({ transactions }: Props) {
  const sells = useMemo(() => transactions.filter((t) => t.action === "SELL"), [transactions]);
  const fyOptions = useMemo(() => {
    const set = new Set<string>();
    sells.forEach((s) => set.add(fyOf(s.date)));
    return Array.from(set).sort().reverse();
  }, [sells]);

  const [fy, setFy] = useState<string>(fyOptions[0] ?? "");

  const rows = useMemo(() => sells.filter((s) => fyOf(s.date) === fy), [sells, fy]);

  const summary = useMemo(() => {
    let stcg = 0, ltcg = 0, stcgLoss = 0, ltcgLoss = 0;
    for (const t of rows) {
      const p = t.meta?.profit ?? 0;
      const isLT = (t.meta?.holdingDays ?? 0) >= 365;
      if (isLT) {
        if (p >= 0) ltcg += p;
        else ltcgLoss += p;
      } else {
        if (p >= 0) stcg += p;
        else stcgLoss += p;
      }
    }
    // FY24+ India rates: STCG 20%, LTCG 12.5% above ₹1.25L exemption
    const stcgNet = stcg + stcgLoss;
    const ltcgNet = ltcg + ltcgLoss;
    const stcgTax = Math.max(0, stcgNet) * 0.2;
    const ltcgTaxable = Math.max(0, ltcgNet - 125000);
    const ltcgTax = ltcgTaxable * 0.125;
    return { stcg, ltcg, stcgLoss, ltcgLoss, stcgNet, ltcgNet, stcgTax, ltcgTax, total: stcgTax + ltcgTax };
  }, [rows]);

  const exportCSV = () => {
    downloadCSV(
      [
        ["Sell Date", "Buy Date", "Stock", "Qty", "Buy ₹", "Sell ₹", "Profit", "Days", "Type"],
        ...rows.map((t) => [
          t.date, t.meta?.buyDate ?? "", t.stock ?? "", t.qty ?? "",
          t.meta?.avgCost ?? "", t.price ?? "", t.meta?.profit ?? "",
          t.meta?.holdingDays ?? "", t.meta?.type ?? "",
        ]),
      ],
      `tax-report-${fy}.csv`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">🧾 Tax Report</h3>
          <p className="text-xs text-muted-foreground">India FY · STCG 20% · LTCG 12.5% above ₹1.25L (post-Budget 2024)</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={fy} onValueChange={setFy}>
            <SelectTrigger className="w-36 minimal:rounded-none"><SelectValue placeholder="FY" /></SelectTrigger>
            <SelectContent>
              {fyOptions.length === 0 ? <SelectItem value="-" disabled>No data</SelectItem> :
                fyOptions.map((y) => <SelectItem key={y} value={y}>FY {y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 minimal:rounded-none" disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="STCG Gains" value={formatINR(summary.stcg)} tone="gain" />
        <SummaryCard label="LTCG Gains" value={formatINR(summary.ltcg)} tone="gain" />
        <SummaryCard label="STCG Tax (20%)" value={formatINR(summary.stcgTax)} tone="loss" />
        <SummaryCard label="LTCG Tax (12.5%)" value={formatINR(summary.ltcgTax)} tone="loss" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 creative:shadow-soft minimal:rounded-none">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Estimated Total Tax</span>
          <span className="font-mono text-xl font-bold text-loss">{formatINR(summary.total)}</span>
        </div>
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
              <th className="px-3 py-2.5 text-right font-medium">Days</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No sell transactions in this FY.</td></tr>
            ) : rows.map((t) => {
              const p = t.meta?.profit ?? 0;
              const tone = p >= 0 ? "text-gain" : "text-loss";
              return (
                <tr key={t.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.date}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{t.stock}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.qty}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.meta?.avgCost != null ? formatINR(t.meta.avgCost) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatINR(t.price)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${tone}`}>{p >= 0 ? "+" : ""}{formatNumber(p, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{t.meta?.holdingDays ?? "—"}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{t.meta?.type ?? "—"}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "gain" | "loss" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 creative:shadow-soft minimal:rounded-none">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${tone === "gain" ? "text-gain" : "text-loss"}`}>{value}</div>
    </div>
  );
}
