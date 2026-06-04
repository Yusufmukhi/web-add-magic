import { Pencil, Trash2, ChevronRight, Inbox } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { HoldingRow } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { formatINR, formatNumber } from "@/utils/formatters";

interface Props {
  rows: HoldingRow[];
  quotes?: QuoteResult[];
  onSell: (ticker: string) => void;
  onEdit?: (ticker: string) => void;
  onDelete?: (ticker: string) => void;
  onSelect?: (ticker: string) => void;
  selected?: string | null;
}

export function HoldingsTable({ rows, quotes = [], onSell, onEdit, onDelete }: Props) {
  const navigate = useNavigate();

  const handleRowClick = (ticker: string) => {
    navigate({ to: "/holding/$symbol", params: { symbol: ticker }, search: { from: "portfolio" } });
  };

  // Build a dayChange map from quotes
  const dayChangeMap: Record<string, { change: number; changePct: number }> = {};
  quotes.forEach((q) => {
    if (q.data) {
      dayChangeMap[q.ticker] = {
        change: q.data.dayChange,
        changePct: q.data.dayChangePct,
      };
    }
  });

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

  const formatIN = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <>
      {/* ── MOBILE: Angel One card style ── */}
      <div className="md:hidden rounded-2xl border border-border bg-card overflow-hidden minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        {rows.map((r) => {
          const day = dayChangeMap[r.ticker];
          const dayPL = day ? day.change * r.qty : null;
          const dayPct = day ? day.changePct : null;

          return (
            <div
              key={r.ticker}
              onClick={() => handleRowClick(r.ticker)}
              className="flex items-center gap-3 border-b border-border px-4 py-3 cursor-pointer active:bg-accent/40 transition-colors"
              style={{ minHeight: 64 }}
            >
              {/* Colour bar left */}
              <div
                className="w-1 self-stretch rounded-full shrink-0"
                style={{ background: r.pl >= 0 ? "rgb(34 197 94 / 0.6)" : "rgb(239 68 68 / 0.6)" }}
              />

              {/* Left column: ticker + qty×ATP */}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[14px] font-bold leading-tight">{r.ticker}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {r.qty} × ATP ₹{formatIN(r.avgPrice)}
                </div>
              </div>

              {/* Right column: overall P&L + day P&L */}
              <div className="text-right shrink-0">
                <div className={`font-mono text-[13px] font-semibold ${r.pl >= 0 ? "text-gain" : "text-loss"}`}>
                  {r.pl >= 0 ? "+" : ""}₹{formatIN(r.pl)}
                  <span className="ml-1 text-[10px] font-normal">
                    ({r.plPct >= 0 ? "+" : ""}{formatNumber(r.plPct, 2)}%)
                  </span>
                </div>
                {dayPL !== null && (
                  <div className={`text-[11px] mt-0.5 ${dayPL >= 0 ? "text-gain" : "text-loss"}`}>
                    Today: {dayPL >= 0 ? "+" : ""}₹{formatIN(dayPL)}
                    <span className="ml-0.5 text-[10px]">
                      ({dayPct !== null && dayPct >= 0 ? "+" : ""}{dayPct !== null ? formatNumber(dayPct, 2) : "—"}%)
                    </span>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  LTP ₹{formatIN(r.cp)}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP: Zerodha-style table ── */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Avg. Price</th>
              <th className="px-4 py-3 text-right font-medium">LTP</th>
              <th className="px-4 py-3 text-right font-medium">Inv. Amt.</th>
              <th className="px-4 py-3 text-right font-medium">Current Val.</th>
              <th className="px-4 py-3 text-right font-medium">Overall G/L</th>
              <th className="px-4 py-3 text-right font-medium">Day's G/L</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const day = dayChangeMap[r.ticker];
              const dayPL = day ? day.change * r.qty : null;
              const dayPct = day ? day.changePct : null;

              return (
                <tr
                  key={r.ticker}
                  onClick={() => handleRowClick(r.ticker)}
                  className="cursor-pointer border-b border-border transition hover:bg-accent/30"
                >
                  {/* Name cell */}
                  <td className="px-4 py-3">
                    <div className="font-mono text-[13px] font-bold">{r.ticker}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">{r.name}</div>
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-[13px]">{r.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-[13px]">{formatINR(r.avgPrice)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold">{formatINR(r.cp)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[13px]">₹{formatIN(r.invested)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold">₹{formatIN(r.value)}</td>

                  {/* Overall G/L */}
                  <td className={`px-4 py-3 text-right font-mono text-[13px] ${r.pl >= 0 ? "text-gain" : "text-loss"}`}>
                    <div className="font-semibold">
                      {r.pl >= 0 ? "+" : ""}₹{formatIN(r.pl)}
                    </div>
                    <div className="text-[11px]">
                      {r.plPct >= 0 ? "+" : ""}{formatNumber(r.plPct, 2)}%
                    </div>
                  </td>

                  {/* Day's G/L */}
                  <td className={`px-4 py-3 text-right font-mono text-[13px] ${dayPL === null ? "text-muted-foreground" : dayPL >= 0 ? "text-gain" : "text-loss"}`}>
                    {dayPL !== null ? (
                      <>
                        <div className="font-semibold">
                          {dayPL >= 0 ? "+" : ""}₹{formatIN(dayPL)}
                        </div>
                        <div className="text-[11px]">
                          {dayPct !== null && dayPct >= 0 ? "+" : ""}{dayPct !== null ? formatNumber(dayPct, 2) : "—"}%
                        </div>
                      </>
                    ) : (
                      <span className="text-[12px]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
    </>
  );
}
