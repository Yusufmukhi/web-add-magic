import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/utils/formatters";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

export function VaRView({ portfolio, results }: Props) {
  const data = useMemo(() => {
    if (!portfolio.length) return null;

    const priceMap: Record<string, number> = {};
    for (const r of results) {
      if (r.data?.cmp) priceMap[r.ticker] = r.data.cmp;
    }

    const rows = portfolio.map((h) => {
      const currentValue = h.qty * (priceMap[h.ticker] ?? h.avgPrice);
      const r = results.find((x) => x.ticker === h.ticker);
      const d = r?.data;

      const high = d?.fiftyTwoWeekHigh ?? 0;
      const low = d?.fiftyTwoWeekLow ?? 0;
      const rangeVol =
        high > 0 && low > 0 ? ((high - low) / low) / Math.sqrt(252) : 0;
      const dayVol = Math.abs(d?.dayChangePct ?? 0) / 100;
      const dailyVol = Math.max(rangeVol, dayVol, 0.01);

      return { ticker: h.ticker, currentValue, dailyVol };
    });

    const totalPortfolioValue = rows.reduce((s, r) => s + r.currentValue, 0);
    if (totalPortfolioValue === 0) return null;

    // Portfolio vol (simplified, assumes zero correlation — conservative)
    const portfolioDailyVol = Math.sqrt(
      rows.reduce((s, r) => {
        const w = r.currentValue / totalPortfolioValue;
        return s + w * w * r.dailyVol * r.dailyVol;
      }, 0)
    );

    const var95 = portfolioDailyVol * 1.645 * totalPortfolioValue;
    const var99 = portfolioDailyVol * 2.326 * totalPortfolioValue;
    const var95_10d = var95 * Math.sqrt(10);

    const rowsWithContrib = rows.map((r) => {
      const w = r.currentValue / totalPortfolioValue;
      const varContrib =
        portfolioDailyVol > 0
          ? (w * r.dailyVol) / portfolioDailyVol * 100
          : 0;
      return { ...r, varContrib };
    }).sort((a, b) => b.dailyVol - a.dailyVol);

    const maxContrib = Math.max(...rowsWithContrib.map((r) => r.varContrib), 1);

    return { var95, var99, var95_10d, rowsWithContrib, maxContrib, totalPortfolioValue };
  }, [portfolio, results]);

  if (!portfolio.length || !data) return null;

  const { var95, var99, var95_10d, rowsWithContrib, maxContrib } = data;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Value at Risk (VaR)</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Estimated max loss at confidence level. Assumes zero correlation — actual VaR may be lower.
      </p>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">1-Day VaR 95%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">-{formatINR(var95)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              5% chance of losing more than this in one day.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">1-Day VaR 99%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">-{formatINR(var99)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              1% chance of losing more than this in one day.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">10-Day VaR 95%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">-{formatINR(var95_10d)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              95% confidence over a 2-week horizon.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Per-Holding Volatility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rowsWithContrib.map((r) => (
            <div key={r.ticker} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-mono font-medium">{r.ticker}</span>
                <span className="text-muted-foreground">
                  {(r.dailyVol * 100).toFixed(2)}% daily vol
                  <span className="ml-2 text-foreground font-medium">
                    {r.varContrib.toFixed(1)}% of risk
                  </span>
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded"
                  style={{ width: `${(r.varContrib / maxContrib) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
