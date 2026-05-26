import { Inbox, Pencil, Trash2 } from "lucide-react";
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
  onSelect?: (ticker: string) => void;
  selected?: string | null;
}

export function HoldingsTable({ rows, onSell, onEdit, onDelete, onSelect, selected }: Props) {
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
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
            <th className="px-3 py-2.5 font-medium">Ticker</th>
            <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Sector</th>
            <th className="px-3 py-2.5 text-right font-medium">Qty</th>
            <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">CMP</th>
            <th className="px-3 py-2.5 text-right font-medium">P&amp;L</th>
            <th className="hidden px-3 py-2.5 text-right font-medium lg:table-cell">Weight</th>
            <th className="px-3 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isSelected = selected === r.ticker;
            return (
              <tr
                key={r.ticker}
                onClick={() => onSelect?.(r.ticker)}
                className={`cursor-pointer border-b border-border transition hover:bg-accent/30 ${isSelected ? "bg-accent/40" : ""}`}
              >
                <td className="px-3 py-2 font-mono font-semibold">{r.ticker}</td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <Badge variant="outline" className={`text-[10px] ${sectorBadgeClass(r.sector)}`}>
                    {r.sector}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.qty}</td>
                <td className="hidden px-3 py-2 text-right font-mono md:table-cell">{formatINR(r.cp)}</td>
                <td className={`px-3 py-2 text-right font-mono ${r.pl >= 0 ? "text-gain" : "text-loss"}`}>
                  {r.pl >= 0 ? "+" : ""}{formatNumber(r.pl, 2)}
                  <span className="ml-1 text-[10px]">({r.plPct >= 0 ? "+" : ""}{formatNumber(r.plPct, 1)}%)</span>
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">
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
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
