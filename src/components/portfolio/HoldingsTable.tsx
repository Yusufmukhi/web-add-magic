import { Pencil, Trash2, ChevronRight, Inbox } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HoldingRow } from "@/types/portfolio.types";
import { formatINR, formatNumber } from "@/utils/formatters";
import { sectorBadgeClass } from "@/utils/colorHelpers";

interface Props {
  rows: HoldingRow[];
  onSell: (ticker: string) => void;
  onEdit?: (ticker: string) => void;
  onDelete?: (ticker: string) => void;
  // kept for backward compat but no longer used for primary navigation
  onSelect?: (ticker: string) => void;
  selected?: string | null;
}

export function HoldingsTable({ rows, onSell, onEdit, onDelete }: Props) {
  const navigate = useNavigate();

  // FIX: Always navigate to full holding detail page on both mobile and desktop
  // (previously desktop used inline panel with wrong props — broken)
  const handleRowClick = (ticker: string) => {
    navigate({ to: "/holding/$symbol", params: { symbol: ticker }, search: { from: "portfolio" } });
  };

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center minimal:rounded-none">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <h3 className="mt-3 font-display text-base font-semibold">No holdings yet</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Add funds, then buy a stock to start tracking your portfolio.
        </p>
      </div>
    );
  }

  const maxW = Math.max(...rows.map((r) => r.weight), 1);
  const formatIN = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  // Mobile: compact row layout — Angel One style
  return (
    <>
      {/* Mobile */}
      <div className="md:hidden rounded-2xl border border-border bg-card overflow-hidden minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        {rows.map((r) => (
          <div
            key={r.ticker}
            onClick={() => handleRowClick(r.ticker)}
            className="flex items-center gap-3 border-b border-border px-4 py-3 cursor-pointer active:bg-accent/40 transition-colors"
            style={{
              borderLeft: `3px solid ${r.pl >= 0 ? "rgb(34 197 94 / 0.5)" : "rgb(239 68 68 / 0.5)"}`,
              minHeight: 60,
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[14px] font-bold">{r.ticker}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                  {r.qty} shares
                </span>
              </div>
              <div className="truncate text-[12px] text-muted-foreground mt-0.5">{r.name}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[14px] font-bold">₹{formatIN(r.value)}</div>
              <div className={`text-[12px] font-semibold ${r.pl >= 0 ? "text-gain" : "text-loss"}`}>
                {r.pl >= 0 ? "+" : ""}₹{formatIN(r.pl)}{" "}
                <span className="text-[10px]">({r.plPct >= 0 ? "+" : ""}{formatNumber(r.plPct, 1)}%)</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        ))}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              <th className="px-3 py-2.5 font-medium">Ticker</th>
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Sector</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty</th>
              <th className="px-3 py-2.5 text-right font-medium">Avg</th>
              <th className="px-3 py-2.5 text-right font-medium">CMP</th>
              <th className="px-3 py-2.5 text-right font-medium">Invested</th>
              <th className="px-3 py-2.5 text-right font-medium">Value</th>
              <th className="px-3 py-2.5 text-right font-medium">P&amp;L</th>
              <th className="hidden px-3 py-2.5 text-right font-medium lg:table-cell">Weight</th>
              <th className="px-3 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.ticker}
                onClick={() => handleRowClick(r.ticker)}
                className="cursor-pointer border-b border-border transition hover:bg-accent/30"
                style={{ borderLeft: `3px solid ${r.pl >= 0 ? "rgb(34 197 94 / 0.3)" : "rgb(239 68 68 / 0.3)"}` }}
              >
                <td className="px-3 py-2.5 font-mono font-bold text-[13px]">{r.ticker}</td>
                <td className="px-3 py-2.5 text-[12px] text-muted-foreground max-w-[140px] truncate">{r.name}</td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <Badge variant="outline" className={`text-[10px] ${sectorBadgeClass(r.sector)}`}>
                    {r.sector}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px]">{r.qty}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px]">{formatINR(r.avgPrice)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold">{formatINR(r.cp)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px]">₹{formatIN(r.invested)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold">₹{formatIN(r.value)}</td>
                <td className={`px-3 py-2.5 text-right font-mono text-[13px] ${r.pl >= 0 ? "text-gain" : "text-loss"}`}>
                  {r.pl >= 0 ? "+" : ""}{formatNumber(r.pl, 2)}
                  <span className="ml-1 text-[10px]">({r.plPct >= 0 ? "+" : ""}{formatNumber(r.plPct, 1)}%)</span>
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary creative:gradient-hero"
                        style={{ width: `${(r.weight / maxW) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">
                      {formatNumber(r.weight, 1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs minimal:rounded-none"
                        onClick={() => onEdit(r.ticker)}
                        title="Edit holding"
                        aria-label={`Edit ${r.ticker}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs minimal:rounded-none"
                      onClick={() => onSell(r.ticker)}
                    >
                      Sell
                    </Button>
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-loss hover:bg-loss/10 minimal:rounded-none"
                        onClick={() => onDelete(r.ticker)}
                        title="Delete holding"
                        aria-label={`Delete ${r.ticker}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
