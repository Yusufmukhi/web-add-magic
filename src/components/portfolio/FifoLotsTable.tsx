/**
 * FifoLotsTable — displays the open FIFO lots for a single holding.
 * Shows each lot's date, price, remaining qty, current unrealised P&L,
 * days held, and whether it qualifies as LTCG.
 */
import type { FifoLot } from "@/types/portfolio.types";
import { formatINR, formatNumber } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";

interface Props {
  lots: FifoLot[];
  /** Current market price for unrealised P&L calc. */
  cmp: number;
}

export function FifoLotsTable({ lots, cmp }: Props) {
  if (!lots || lots.length === 0) return null;

  const today = Date.now();

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium">Buy Date</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Cost/sh</th>
            <th className="px-3 py-2 text-right font-medium">Invested</th>
            <th className="px-3 py-2 text-right font-medium">P&amp;L</th>
            <th className="px-3 py-2 text-center font-medium">Days</th>
            <th className="px-3 py-2 text-center font-medium">Tax</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot, i) => {
            const daysHeld = Math.floor((today - Date.parse(lot.date)) / 86400000);
            const isLTCG = daysHeld >= 365;
            const invested = lot.price * lot.qty;
            const value = cmp * lot.qty;
            const pl = value - invested;
            const plPct = invested > 0 ? (pl / invested) * 100 : 0;

            return (
              <tr
                key={lot.id}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-mono">{lot.date}</td>
                <td className="px-3 py-2 text-right font-mono">{lot.qty}</td>
                <td className="px-3 py-2 text-right font-mono">{formatINR(lot.price)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatINR(invested)}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${pl >= 0 ? "text-gain" : "text-loss"}`}>
                  {pl >= 0 ? "+" : ""}{formatNumber(pl, 0)}{" "}
                  <span className="text-[10px] font-normal opacity-70">
                    ({pl >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-mono">{daysHeld}</td>
                <td className="px-3 py-2 text-center">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 ${
                      isLTCG
                        ? "border-gain text-gain"
                        : "border-amber-500 text-amber-500"
                    }`}
                  >
                    {isLTCG ? "LTCG" : "STCG"}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
        {lots.length > 1 && (
          <tfoot>
            <tr className="bg-muted/30 text-xs font-semibold border-t border-border">
              <td colSpan={2} className="px-3 py-1.5 text-muted-foreground">Total</td>
              <td className="px-3 py-1.5 text-right font-mono">
                {lots.reduce((s, l) => s + l.qty, 0)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                {/* weighted avg cost */}
                {(() => {
                  const totalQty = lots.reduce((s, l) => s + l.qty, 0);
                  const avg = totalQty > 0
                    ? lots.reduce((s, l) => s + l.price * l.qty, 0) / totalQty
                    : 0;
                  return formatINR(avg);
                })()}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">
                {formatINR(lots.reduce((s, l) => s + l.price * l.qty, 0))}
              </td>
              <td className={`px-3 py-1.5 text-right font-mono ${
                lots.reduce((s, l) => s + (cmp - l.price) * l.qty, 0) >= 0
                  ? "text-gain"
                  : "text-loss"
              }`}>
                {(() => {
                  const pl = lots.reduce((s, l) => s + (cmp - l.price) * l.qty, 0);
                  return `${pl >= 0 ? "+" : ""}${formatNumber(pl, 0)}`;
                })()}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
