import { useMemo, useState } from "react";
import { Search, Download, Plus, Inbox, ArrowUpDown, SlidersHorizontal, ChevronUp, ChevronDown, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MobileStockRow } from "./MobileStockRow";
import { StockRow } from "./StockRow";
import { formatIndianNumber, formatNumber } from "@/utils/formatters";

type SortKey = "none" | "cmp" | "dayPct" | "pe" | "marketCap" | "name";
type SortDir = "asc" | "desc";
type ChangeFilter = "all" | "gainers" | "losers";

interface Props {
  results: QuoteResult[];
  onRemove: (t: string) => void;
  onSelect: (t: string) => void;
  selected: string | null;
  onAdd?: () => void;
}

export function WatchlistTable({ results, onRemove, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("none");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  // FIX: Always navigate on both mobile and desktop
  const handleRowTap = (ticker: string) => {
    navigate({ to: "/stock/$symbol", params: { symbol: ticker } });
  };

  // Collect unique sectors from loaded data
  const sectors = useMemo(() => {
    const s = new Set<string>();
    results.forEach((r) => { if (r.data?.sector && r.data.sector !== "Unknown") s.add(r.data.sector); });
    return ["all", ...Array.from(s).sort()];
  }, [results]);

  // Apply search, filter, sort
  const filtered = useMemo(() => {
    let out = [...results];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (r) =>
          r.ticker.toLowerCase().includes(q) ||
          (r.data?.name ?? "").toLowerCase().includes(q)
      );
    }

    // Change filter
    if (changeFilter === "gainers") out = out.filter((r) => (r.data?.dayChangePct ?? 0) >= 0);
    if (changeFilter === "losers") out = out.filter((r) => (r.data?.dayChangePct ?? 0) < 0);

    // Sector filter
    if (sectorFilter !== "all") out = out.filter((r) => r.data?.sector === sectorFilter);

    // Sort
    if (sortKey !== "none") {
      out.sort((a, b) => {
        let va = 0, vb = 0;
        switch (sortKey) {
          case "cmp":       va = a.data?.cmp ?? 0;          vb = b.data?.cmp ?? 0; break;
          case "dayPct":    va = a.data?.dayChangePct ?? 0;  vb = b.data?.dayChangePct ?? 0; break;
          case "pe":        va = a.data?.pe ?? Infinity;     vb = b.data?.pe ?? Infinity; break;
          case "marketCap": va = a.data?.marketCap ?? 0;     vb = b.data?.marketCap ?? 0; break;
          case "name":
            return sortDir === "asc"
              ? (a.data?.name ?? a.ticker).localeCompare(b.data?.name ?? b.ticker)
              : (b.data?.name ?? b.ticker).localeCompare(a.data?.name ?? a.ticker);
        }
        return sortDir === "asc" ? va - vb : vb - va;
      });
    }

    return out;
  }, [results, search, sortKey, sortDir, sectorFilter, changeFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 ml-0.5 opacity-30" />;
    return sortDir === "desc"
      ? <ChevronDown className="h-3 w-3 ml-0.5 text-primary" />
      : <ChevronUp className="h-3 w-3 ml-0.5 text-primary" />;
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

  const activeFilters = (sectorFilter !== "all" ? 1 : 0) + (changeFilter !== "all" ? 1 : 0) + (sortKey !== "none" ? 1 : 0);

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
      {/* Search + filter toggle row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or symbol…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5 shrink-0 relative"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filter & Sort</span>
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeFilters}
            </span>
          )}
        </Button>
      </div>

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sort & Filter</span>
            {activeFilters > 0 && (
              <button
                onClick={() => { setSortKey("none"); setSectorFilter("all"); setChangeFilter("all"); }}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>

          {/* Sort buttons */}
          <div>
            <div className="text-[11px] text-muted-foreground mb-1.5 font-medium">Sort by</div>
            <div className="flex flex-wrap gap-1.5">
              {(["cmp", "dayPct", "pe", "marketCap", "name"] as SortKey[]).map((k) => {
                const labels: Record<string, string> = {
                  cmp: "CMP", dayPct: "Day %", pe: "P/E", marketCap: "Mkt Cap", name: "Name",
                };
                return (
                  <button
                    key={k}
                    onClick={() => handleSort(k)}
                    className={`flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                      sortKey === k
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {labels[k]}
                    <SortIcon k={k} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gainer / Loser filter */}
          <div>
            <div className="text-[11px] text-muted-foreground mb-1.5 font-medium">Movement</div>
            <div className="flex gap-1.5">
              {(["all", "gainers", "losers"] as ChangeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setChangeFilter(f)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium border transition-colors capitalize ${
                    changeFilter === f
                      ? f === "gainers"
                        ? "border-gain/40 bg-gain/10 text-gain"
                        : f === "losers"
                        ? "border-loss/40 bg-loss/10 text-loss"
                        : "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All" : f === "gainers" ? "▲ Gainers" : "▼ Losers"}
                </button>
              ))}
            </div>
          </div>

          {/* Sector filter */}
          {sectors.length > 2 && (
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5 font-medium">Sector</div>
              <div className="flex flex-wrap gap-1.5">
                {sectors.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSectorFilter(s)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                      sectorFilter === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "all" ? "All Sectors" : s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      {(search.trim() || activeFilters > 0) && (
        <div className="text-[11px] text-muted-foreground px-1">
          Showing {filtered.length} of {results.length} stocks
        </div>
      )}

      {/* Mobile: compact rows */}
      <div className="md:hidden rounded-2xl border border-border bg-card overflow-hidden minimal:rounded-none">
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
          <div className="py-8 text-center text-sm text-muted-foreground">No results</div>
        )}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
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
                <th
                  className="px-4 py-2.5 text-right font-medium cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort("cmp")}
                >
                  <span className="flex items-center justify-end gap-0.5">CMP <SortIcon k="cmp" /></span>
                </th>
                <th
                  className="px-4 py-2.5 text-right font-medium cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort("dayPct")}
                >
                  <span className="flex items-center justify-end gap-0.5">Day % <SortIcon k="dayPct" /></span>
                </th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">7D Trend</th>
                <th
                  className="hidden px-4 py-2.5 text-right font-medium cursor-pointer hover:text-foreground select-none md:table-cell"
                  onClick={() => handleSort("pe")}
                >
                  <span className="flex items-center justify-end gap-0.5">P/E <SortIcon k="pe" /></span>
                </th>
                <th
                  className="hidden px-4 py-2.5 text-right font-medium cursor-pointer hover:text-foreground select-none md:table-cell"
                  onClick={() => handleSort("marketCap")}
                >
                  <span className="flex items-center justify-end gap-0.5">Mkt Cap <SortIcon k="marketCap" /></span>
                </th>
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
                  isSelected={false}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    No results{search.trim() ? ` for "${search}"` : ""}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
