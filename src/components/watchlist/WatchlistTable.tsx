import { useMemo, useState } from "react";
import { Search, Download, Plus, Inbox } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileStockRow } from "./MobileStockRow";
import { StockRow } from "./StockRow";
import { formatIndianNumber, formatNumber } from "@/utils/formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  results: QuoteResult[];
  onRemove: (t: string) => void;
  onSelect: (t: string) => void;
  selected: string | null;
  onAdd?: () => void;
}

export function WatchlistTable({ results, onRemove, onSelect, selected, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!search.trim()) return results;
    const q = search.toLowerCase();
    return results.filter(
      (r) =>
        r.ticker.toLowerCase().includes(q) ||
        (r.data?.name ?? "").toLowerCase().includes(q)
    );
  }, [results, search]);

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
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRowTap = (ticker: string) => {
    if (isMobile) {
      navigate({ to: "/stock/$symbol", params: { symbol: ticker } });
    } else {
      onSelect(ticker);
    }
  };

  if (results.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border py-20 text-center minimal:rounded-none">
        <Inbox className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 font-display text-lg font-semibold">No stocks yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Tap + to add stocks to your watchlist.
        </p>
        {onAdd && (
          <Button className="mt-4 gap-2 rounded-full" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Add Stock
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or symbol…"
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Mobile: compact rows */}
      {isMobile ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden minimal:rounded-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Watchlist</h2>
            <Button variant="ghost" size="sm" onClick={exportCSV} className="h-7 gap-1.5 text-xs">
              <Download className="h-3 w-3" /> CSV
            </Button>
          </div>
          {filtered.map((r) => (
            <MobileStockRow
              key={r.ticker}
              result={r}
              onRemove={onRemove}
              onTap={handleRowTap}
            />
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No results for "{search}"</div>
          )}
        </div>
      ) : (
        /* Desktop: full table */
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
                  <th className="px-4 py-2.5 font-medium">Ticker</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Sector</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Alerts</th>
                  <th className="px-4 py-2.5 text-right font-medium">CMP</th>
                  <th className="px-4 py-2.5 text-right font-medium">Day %</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">7D Trend</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">P/E</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Mkt Cap</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <StockRow
                    key={r.ticker}
                    result={r}
                    onRemove={onRemove}
                    onSelect={handleRowTap}
                    isSelected={selected === r.ticker}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      No results for "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
