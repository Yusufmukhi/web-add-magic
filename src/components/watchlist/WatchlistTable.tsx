import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Inbox } from "lucide-react";
import type { QuoteResult } from "@/hooks/useStockQuote";
import type { SortDir, SortKey } from "@/types/stock.types";
import { Button } from "@/components/ui/button";
import { StockRow } from "./StockRow";
import {
  formatIndianNumber,
  formatNumber,
} from "@/utils/formatters";

interface Props {
  results: QuoteResult[];
  onRemove: (t: string) => void;
  onSelect: (t: string) => void;
  selected: string | null;
}

const COLS: Array<{ key: SortKey; label: string; align?: "right"; hide?: string }> = [
  { key: "ticker", label: "Ticker" },
  { key: "name", label: "Name" },
  { key: "sector", label: "Sector" },
  { key: "ticker", label: "Alerts", hide: "max-md:hidden" },
  { key: "cmp", label: "CMP", align: "right" },
  { key: "dayChangePct", label: "Day %", align: "right" },
  { key: "ticker", label: "7D Trend", hide: "max-lg:hidden" },
  { key: "pe", label: "P/E", align: "right", hide: "max-md:hidden" },
  { key: "marketCap", label: "Mkt Cap", align: "right", hide: "max-md:hidden" },
];

export function WatchlistTable({ results, onRemove, onSelect, selected }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const arr = [...results];
    arr.sort((a, b) => {
      const da = a.data;
      const db = b.data;
      const get = (r: QuoteResult): string | number => {
        if (sortKey === "ticker") return r.ticker;
        if (!r.data) return sortDir === "asc" ? Infinity : -Infinity;
        const v = r.data[sortKey as keyof typeof r.data];
        return typeof v === "number" ? v : String(v ?? "");
      };
      const va = get(a);
      const vb = get(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
      void da; void db;
    });
    return arr;
  }, [results, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const exportCSV = () => {
    const rows: string[][] = [
      ["Ticker", "Name", "Sector", "CMP", "Day Change %", "P/E", "Market Cap"],
      ...results
        .filter((r) => r.data)
        .map((r) => {
          const d = r.data!;
          return [
            r.ticker,
            d.name,
            d.sector,
            formatIndianNumber(d.cmp, 2),
            formatNumber(d.dayChangePct, 2),
            d.pe == null ? "" : formatNumber(d.pe, 2),
            String(d.marketCap),
          ];
        }),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (results.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border py-20 text-center minimal:rounded-none">
        <Inbox className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 font-display text-lg font-semibold">Your watchlist is empty</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Search above for an NSE-listed stock — e.g. RELIANCE, TCS, INFY — and add it to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-base font-semibold">Watchlist</h2>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 minimal:rounded-none">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              {COLS.map((c, i) => (
                <th
                  key={`${c.label}-${i}`}
                  className={`px-4 py-2.5 font-medium ${c.align === "right" ? "text-right" : ""} ${c.hide ?? ""}`}
                >
                  <button
                    onClick={() => handleSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.label}
                    {sortKey === c.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
              ))}
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <StockRow
                key={r.ticker}
                result={r}
                onRemove={onRemove}
                onSelect={onSelect}
                isSelected={selected === r.ticker}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
