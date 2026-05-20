import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import type { Transaction, TxAction } from "@/types/portfolio.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, formatNumber } from "@/utils/formatters";
import { downloadCSV } from "@/utils/csv";

type Filter = "ALL" | TxAction | "FUND";

interface Props {
  transactions: Transaction[];
}

export function TransactionsTable({ transactions }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    let arr = [...transactions];
    if (filter === "FUND") arr = arr.filter((t) => t.action === "DEPOSIT" || t.action === "WITHDRAW");
    else if (filter !== "ALL") arr = arr.filter((t) => t.action === filter);
    if (q) arr = arr.filter((t) => (t.stock ?? "").toUpperCase().includes(q.toUpperCase()));
    if (from) arr = arr.filter((t) => t.date >= from);
    if (to) arr = arr.filter((t) => t.date <= to);
    arr.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    return arr;
  }, [transactions, filter, q, from, to]);

  const exportCSV = () => {
    downloadCSV(
      [
        ["Date", "Action", "Stock", "Qty", "Price", "Amount", "Profit", "P/L %", "Holding Days", "Type"],
        ...rows.map((t) => [
          t.date, t.action, t.stock ?? "", t.qty ?? "", t.price ?? "",
          t.amount, t.meta?.profit ?? "", t.meta?.profitPct ?? "",
          t.meta?.holdingDays ?? "", t.meta?.type ?? "",
        ]),
      ],
      `transactions-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const actionColor = (a: TxAction) =>
    a === "BUY" ? "text-gain" : a === "SELL" ? "text-loss" : "text-primary";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-36 minimal:rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="BUY">Buy</SelectItem>
            <SelectItem value="SELL">Sell</SelectItem>
            <SelectItem value="FUND">Funds</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ticker"
            className="h-9 w-40 pl-8 font-mono minimal:rounded-none"
          />
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36 minimal:rounded-none" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36 minimal:rounded-none" />
        <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto gap-2 minimal:rounded-none">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Action</th>
              <th className="px-3 py-2.5 font-medium">Stock</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty</th>
              <th className="px-3 py-2.5 text-right font-medium">Price</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">P&amp;L</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">Days</th>
              <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">No transactions match your filters.</td></tr>
            ) : rows.map((t) => (
              <tr key={t.id} className="border-b border-border hover:bg-accent/30">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.date}</td>
                <td className={`px-3 py-2 font-semibold ${actionColor(t.action)}`}>{t.action}</td>
                <td className="px-3 py-2 font-mono">{t.stock ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{t.qty ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{t.price ? formatINR(t.price) : "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{formatINR(t.amount)}</td>
                <td className={`hidden px-3 py-2 text-right font-mono md:table-cell ${t.meta?.profit != null ? (t.meta.profit >= 0 ? "text-gain" : "text-loss") : "text-muted-foreground"}`}>
                  {t.meta?.profit != null ? `${t.meta.profit >= 0 ? "+" : ""}${formatNumber(t.meta.profit, 2)}` : "—"}
                </td>
                <td className="hidden px-3 py-2 text-right font-mono text-xs text-muted-foreground md:table-cell">
                  {t.meta?.holdingDays != null ? `${t.meta.holdingDays}d` : "—"}
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">
                  {t.meta?.type && (
                    <Badge variant="outline" className="text-[10px]">{t.meta.type}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
