import { useMemo } from "react";
import { Droplets } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/utils/formatters";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

export function LiquidityView({ portfolio, results }: Props) {
  const data = useMemo(() => {
    if (!portfolio.length) return null;

    const priceMap: Record<string, number> = {};
    const mcapMap: Record<string, number> = {};
    for (const r of results) {
      if (r.data?.cmp) priceMap[r.ticker] = r.data.cmp;
      if (r.data?.marketCap) mcapMap[r.ticker] = r.data.marketCap;
    }

    const rows = portfolio.map((h) => {
      const price = priceMap[h.ticker] ?? h.avgPrice;
      const value = h.qty * price;
      const marketCap = mcapMap[h.ticker] ?? 0;

      let tier: string;
      let tierScore: number;
      let tierColor: string;

      if (marketCap > 200_000_000_000) {
        tier = "Large Cap";
        tierScore = 100;
        tierColor = "border-blue-500 text-blue-500";
      } else if (marketCap > 20_000_000_000) {
        tier = "Mid Cap";
        tierScore = 60;
        tierColor = "border-yellow-500 text-yellow-500";
      } else {
        tier = "Small Cap";
        tierScore = 20;
        tierColor = "border-red-500 text-red-500";
      }

      return { ticker: h.ticker, value, tier, tierScore, tierColor };
    });

    const totalValue = rows.reduce((s, r) => s + r.value, 0);
    const score =
      totalValue > 0
        ? rows.reduce((s, r) => s + (r.value / totalValue) * r.tierScore, 0)
        : 0;

    const sorted = [...rows].sort((a, b) => b.value - a.value);

    return { score, sorted, totalValue };
  }, [portfolio, results]);

  if (!portfolio.length || !data) return null;

  const { score, sorted } = data;

  const scoreColor =
    score >= 70 ? "text-emerald-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const scoreLabel = score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";
  const scoreLabelColor =
    score >= 70
      ? "border-emerald-500 text-emerald-500"
      : score >= 50
      ? "border-yellow-500 text-yellow-500"
      : "border-red-500 text-red-500";

  const scoreExplanation =
    score >= 70
      ? "Portfolio is mostly large/mid caps. You can exit most positions quickly even in a crash."
      : score >= 50
      ? "Mixed liquidity. Some holdings may be hard to exit at fair prices during a panic."
      : "Heavy small-cap exposure. In a market crash, you may not find buyers quickly. Consider sizing down high-illiquidity positions.";

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Droplets className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Liquidity Score</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Portfolio Liquidity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-3">
              <span className={`text-5xl font-bold ${scoreColor}`}>
                {Math.round(score)}
              </span>
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className={scoreLabelColor}>{scoreLabel}</Badge>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{scoreExplanation}</p>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all ${
                  score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Holdings by Tier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sorted.map((row) => (
              <div key={row.ticker} className="flex items-center justify-between text-sm">
                <span className="font-mono font-medium">{row.ticker}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] px-1.5 ${row.tierColor}`}>
                    {row.tier}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{formatINR(row.value)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
