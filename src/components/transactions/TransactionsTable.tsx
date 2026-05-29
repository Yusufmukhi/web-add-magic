import { useMemo, useState } from "react";
import { Download, Search, ChevronDown, ChevronRight } from "lucide-react";
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
  const [expandedSells, setExpandedSells] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedSells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        ["Date", "Action", "Stock", "Qty", "Price", "Amount", "Charges", "Profit", "P/L %", "Holding Days", "Type", "Note"],
        ...rows.map((t) => [
          t.date, t.action, t.stock ?? "", t.qty ?? "", t.price ?? "",
          t.amount, t.meta?.charges ?? "", t.meta?.profit ?? "", t.meta?.profitPct ?? "",
          t.meta?.holdingDays ?? "", t.meta?.type ?? "", t.meta?.note ?? "",
        ]),
      ],
      `transactions-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const actionColor = (a: TxAction) =>
    a === "BUY" ? "text-gain" : a === "SELL" ? "text-loss" : "text-primary";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-full sm:w-36 minimal:rounded-none"><SelectValue /></SelectTrigger>
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
            className="h-9 w-full pl-8 font-mono sm:w-40 minimal:rounded-none"
          />
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-full sm:w-36 minimal:rounded-none" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-full sm:w-36 minimal:rounded-none" />
        <Button variant="outline" size="sm" onClick={exportCSV} className="col-span-2 gap-2 sm:ml-auto minimal:rounded-none">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              <th className="px-3 py-2.5 font-medium w-6"></th>
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
              <tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">No transactions match your filters.</td></tr>
            ) : rows.map((t) => {
              const hasFifoLots = t.action === "SELL" && t.meta?.fifoLots && t.meta.fifoLots.length > 0;
              const isExpanded = expandedSells.has(t.id);

              return (
                <>
                  <tr
                    key={t.id}
                    className={`border-b border-border hover:bg-accent/30 ${hasFifoLots ? "cursor-pointer" : ""}`}
                    onClick={() => hasFifoLots && toggleExpand(t.id)}
                  >
                    {/* Expand toggle */}
                    <td className="px-2 py-2 text-muted-foreground">
                      {hasFifoLots ? (
                        isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.date}</td>
                    <td className={`px-3 py-2 font-semibold ${actionColor(t.action)}`}>{t.action}</td>
                    <td className="px-3 py-2 font-mono">
                      <div>{t.stock ?? "—"}</div>
                      {t.meta?.note && (
                        <div className="mt-0.5 max-w-[200px] truncate font-sans text-[11px] font-normal italic text-muted-foreground" title={t.meta.note}>
                          {t.meta.note}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{t.qty ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{t.price ? formatINR(t.price) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <div>{formatINR(t.amount)}</div>
                      {t.meta?.charges != null && t.meta.charges > 0 && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          chg −{formatINR(t.meta.charges)}
                        </div>
                      )}
                    </td>
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

                  {/* FIFO lot breakdown rows — expanded for SELL transactions */}
                  {hasFifoLots && isExpanded && (
                    <tr key={`${t.id}-fifo`} className="border-b border-border bg-muted/10">
                      <td colSpan={10} className="px-4 pb-3 pt-1">
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                            FIFO Lot Details — {t.meta!.fifoLots!.map((d) => `${d.qtySold}@${formatINR(d.lotPrice)}`).join(" + ")}
                          </p>
                          <div className="grid grid-cols-1 gap-1">
                            {/* Sub-header */}
                            <div className="grid grid-cols-6 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border pb-1">
                              <span>Lot #</span>
                              <span>Buy Date</span>
                              <span className="text-right">Buy Price</span>
                              <span className="text-right">Qty Sold</span>
                              <span className="text-right">Holding</span>
                              <span className="text-right">Lot P&L</span>
                            </div>
                            {t.meta!.fifoLots!.map((d, i) => (
                              <div
                                key={d.lotId}
                                className="grid grid-cols-6 items-center text-xs py-1 border-b border-border/50 last:border-0"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                                    {i + 1}
                                  </span>
                                </span>
                                <span className="font-mono text-muted-foreground">{d.lotDate}</span>
                                <span className="text-right font-mono font-semibold">{formatINR(d.lotPrice)}</span>
                                <span className="text-right font-mono">{d.qtySold}</span>
                                <span className="text-right">
                                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                                    {d.taxType} · {d.holdingDays}d
                                  </Badge>
                                </span>
                                <span className={`text-right font-mono font-semibold ${d.lotProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                                  {d.lotProfit >= 0 ? "+" : ""}{formatINR(d.lotProfit)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Footer summary */}
                          <div className="flex items-center justify-between pt-1 text-xs">
                            <span className="text-muted-foreground">
                              FIFO Avg Buy: <span className="font-mono font-semibold text-foreground">{formatINR(t.meta!.fifoAvgCost ?? 0)}/sh</span>
                            </span>
                            <span className="text-muted-foreground">
                              Gross P&L: <span className={`font-mono font-semibold ${(t.meta?.grossProfit ?? 0) >= 0 ? "text-green-600" : "text-destructive"}`}>
                                {(t.meta?.grossProfit ?? 0) >= 0 ? "+" : ""}{formatINR(t.meta?.grossProfit ?? 0)}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              Charges: <span className="font-mono font-semibold text-foreground">−{formatINR(t.meta?.charges ?? 0)}</span>
                            </span>
                            <span className="text-muted-foreground font-semibold">
                              Net P&L: <span className={`font-mono font-bold ${(t.meta?.profit ?? 0) >= 0 ? "text-green-600" : "text-destructive"}`}>
                                {(t.meta?.profit ?? 0) >= 0 ? "+" : ""}{formatINR(t.meta?.profit ?? 0)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
