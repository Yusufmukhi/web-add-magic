import { useMemo } from "react";
import { Activity } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

export function BetaView({ portfolio, results }: Props) {
  const data = useMemo(() => {
    if (!portfolio.length) return null;

    const priceMap: Record<string, number> = {};
    for (const r of results) {
      if (r.data?.cmp) priceMap[r.ticker] = r.data.cmp;
    }

    const rows = portfolio.map((h) => {
      const currentPrice = priceMap[h.ticker] ?? h.avgPrice;
      const holdingValue = h.qty * currentPrice;
      const r = results.find((x) => x.ticker === h.ticker);
      const d = r?.data;

      let beta = 1.0;
      if (d?.debtToEquity != null) {
        beta = Math.min(Math.max(1 + 0.64 * (d.debtToEquity / 100), 0.3), 3.0);
      } else if (d?.returnOnEquity != null && d.returnOnEquity > 0) {
        beta = Math.min(Math.max(1 + d.returnOnEquity * 2, 0.5), 2.5);
      }

      return { ticker: h.ticker, holdingValue, beta };
    });

    const totalValue = rows.reduce((s, r) => s + r.holdingValue, 0);
    const weightedBeta =
      totalValue > 0
        ? rows.reduce((s, r) => s + (r.holdingValue / totalValue) * r.beta, 0)
        : 1.0;

    const sorted = [...rows].sort((a, b) => b.beta - a.beta);

    return { weightedBeta, sorted, totalValue };
  }, [portfolio, results]);

  if (!portfolio.length || !data) return null;

  const { weightedBeta, sorted } = data;

  const label =
    weightedBeta > 1.2 ? "AGGRESSIVE" : weightedBeta > 0.9 ? "MODERATE" : "DEFENSIVE";
  const labelColor =
    weightedBeta > 1.2
      ? "border-red-500 text-red-500"
      : weightedBeta > 0.9
      ? "border-yellow-500 text-yellow-500"
      : "border-emerald-500 text-emerald-500";
  const explanation =
    weightedBeta > 1.2
      ? "Your portfolio moves more than the market. Higher reward potential but bigger drawdowns in crashes."
      : weightedBeta > 0.9
      ? "Your portfolio roughly tracks the market. Balanced risk-reward profile."
      : "Your portfolio is less volatile than Nifty. Lower drawdowns but may underperform in bull runs.";

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Portfolio Beta</h2>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-end gap-3">
            <span className="text-5xl font-bold">{weightedBeta.toFixed(2)}</span>
            <Badge variant="outline" className={labelColor}>{label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{explanation}</p>

          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Per-Stock Beta</p>
            {sorted.map((row) => (
              <div key={row.ticker} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{row.ticker}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded"
                      style={{ width: `${Math.min((row.beta / 3) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="font-medium w-8 text-right">{row.beta.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
