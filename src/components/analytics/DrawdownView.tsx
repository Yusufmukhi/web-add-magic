import { useMemo } from "react";
import { TrendingDown } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/utils/formatters";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

export function DrawdownView({ portfolio, results }: Props) {
  const data = useMemo(() => {
    if (!portfolio.length) return null;

    const priceMap: Record<string, number> = {};
    const highMap: Record<string, number> = {};
    for (const r of results) {
      if (r.data?.cmp) priceMap[r.ticker] = r.data.cmp;
      if (r.data?.fiftyTwoWeekHigh) highMap[r.ticker] = r.data.fiftyTwoWeekHigh;
    }

    const rows = portfolio.map((h) => {
      const currentPrice = priceMap[h.ticker] ?? h.avgPrice;
      const invested = h.qty * h.avgPrice;
      const currentValue = h.qty * currentPrice;
      const unrealizedPL = currentValue - invested;
      const unrealizedPLPct = invested > 0 ? (unrealizedPL / invested) * 100 : 0;
      const fiftyTwoWeekHigh = highMap[h.ticker] ?? 0;
      const drawdownFromHigh =
        fiftyTwoWeekHigh > 0
          ? ((fiftyTwoWeekHigh - currentPrice) / fiftyTwoWeekHigh) * 100
          : null;
      const atRisk20 = currentValue * 0.2;
      return { ...h, currentPrice, invested, currentValue, unrealizedPL, unrealizedPLPct, drawdownFromHigh, atRisk20 };
    });

    const sorted = [...rows].sort((a, b) => a.unrealizedPLPct - b.unrealizedPLPct);
    const sortedByRisk = [...rows].sort((a, b) => b.atRisk20 - a.atRisk20);
    const totalAtRisk20 = rows.reduce((s, r) => s + r.atRisk20, 0);
    const totalCurrentValue = rows.reduce((s, r) => s + r.currentValue, 0);

    return { sorted, sortedByRisk, totalAtRisk20, totalCurrentValue };
  }, [portfolio, results]);

  if (!portfolio.length || !data) return null;

  const { sorted, sortedByRisk, totalAtRisk20 } = data;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Drawdown & Risk</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Worst performers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Worst Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sorted.slice(0, 5).map((row) => (
              <div key={row.ticker} className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold">{row.ticker}</p>
                  {row.drawdownFromHigh !== null && (
                    <p className="text-xs text-muted-foreground">
                      {row.drawdownFromHigh.toFixed(1)}% off 52w high
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${row.unrealizedPL >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {row.unrealizedPL >= 0 ? "+" : ""}{formatINR(row.unrealizedPL)}
                  </p>
                  <p className={`text-xs ${row.unrealizedPLPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {row.unrealizedPLPct >= 0 ? "+" : ""}{row.unrealizedPLPct.toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 20% drop scenario */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              20% Drop Scenario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">
                You'd lose this if all holdings drop 20%
              </p>
              <p className="text-3xl font-bold text-red-500">
                {formatINR(totalAtRisk20)}
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              {sortedByRisk.map((row) => (
                <div key={row.ticker} className="flex justify-between text-sm">
                  <span className="font-mono text-muted-foreground">{row.ticker}</span>
                  <span className="font-medium text-red-400">{formatINR(row.atRisk20)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
