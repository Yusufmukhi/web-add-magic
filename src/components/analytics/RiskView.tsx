import { useMemo } from "react";
import { Shield } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { useSectorOverrides } from "@/hooks/useSectorOverrides";
import { sectorBadgeClass } from "@/utils/colorHelpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

export function RiskView({ portfolio, results }: Props) {
  const { resolve } = useSectorOverrides();

  const analytics = useMemo(() => {
    if (!portfolio.length) return null;

    const safePct = (value: number, total: number) =>
      total === 0 ? 0 : (value / total) * 100;

    // Build price map from live quotes
    const priceMap: Record<string, number> = {};
    for (const result of results) {
      if (result.data?.cmp) {
        priceMap[result.ticker] = result.data.cmp;
      }
    }

    // Compute value for each holding
    const holdingsWithValue = portfolio.map((h) => {
      const price = priceMap[h.ticker] ?? h.avgPrice;
      const value = h.qty * price;
      const result = results.find((r) => r.ticker === h.ticker);
      return { ...h, value, result };
    });

    // Total portfolio value
    const totalValue = holdingsWithValue.reduce((sum, h) => sum + h.value, 0);

    // Sort descending by value
    const sorted = [...holdingsWithValue].sort((a, b) => b.value - a.value);

    const topHolding = sorted[0];
    const topPct = safePct(topHolding.value, totalValue);
    const top3Value = sorted.slice(0, 3).reduce((sum, h) => sum + h.value, 0);
    const top3Pct = safePct(top3Value, totalValue);

    // Build sector totals
    const sectorTotals: Record<string, number> = {};
    for (const h of holdingsWithValue) {
      const sector = resolve(h.ticker, h.result?.data?.sector ?? "Unknown");
      sectorTotals[sector] = (sectorTotals[sector] ?? 0) + h.value;
    }

    // Sector weights
    const sectorWeights: Record<string, number> = {};
    for (const [sector, val] of Object.entries(sectorTotals)) {
      sectorWeights[sector] = safePct(val, totalValue);
    }

    const uniqueSectorCount = Object.keys(sectorWeights).length;

    // Health score
    let score = 100;
    const penalties: string[] = [];

    if (topPct > 25) {
      score -= 20;
      penalties.push(
        `${topHolding.ticker} is ${topPct.toFixed(1)}% of portfolio (concentration > 25%)`
      );
    }
    if (top3Pct > 60) {
      score -= 10;
      penalties.push(`Top 3 holdings make up ${top3Pct.toFixed(1)}% (> 60%)`);
    }
    if (uniqueSectorCount <= 1) {
      score -= 10;
      penalties.push("Portfolio is concentrated in a single sector");
    }

    score = Math.max(0, Math.min(100, score));

    return {
      topHolding,
      topPct,
      top3Pct,
      sectorWeights,
      uniqueSectorCount,
      score,
      penalties,
    };
  }, [portfolio, results, resolve]);

  if (!portfolio.length || !analytics) return null;

  const {
    topHolding,
    topPct,
    top3Pct,
    sectorWeights,
    score,
    penalties,
  } = analytics;

  const concentrationVariant =
    topPct > 25
      ? "border-red-500 text-red-500"
      : topPct > 15
      ? "border-yellow-500 text-yellow-500"
      : "border-green-500 text-green-500";
  const concentrationLabel =
    topPct > 25 ? "HIGH RISK" : topPct > 15 ? "MEDIUM" : "LOW";

  const scoreColor =
    score >= 70
      ? "text-emerald-500"
      : score >= 50
      ? "text-yellow-500"
      : "text-red-500";

  const sortedSectors = Object.entries(sectorWeights).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Risk View</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Concentration Risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concentration Risk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-base">
                {topHolding.ticker}{" "}
                <span className="text-foreground">
                  {topPct.toFixed(1)}%
                </span>
              </span>
              <Badge
                variant="outline"
                className={concentrationVariant}
              >
                {concentrationLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Top 3 holdings:{" "}
              <span className="font-medium text-foreground">
                {top3Pct.toFixed(1)}%
              </span>{" "}
              of portfolio
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Sector Exposure */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sector Exposure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedSectors.map(([sector, pct]) => (
              <div key={sector} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-xs ${sectorBadgeClass(sector)}`}
                  >
                    {sector}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-muted h-1.5 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card 3: Health Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1 mb-3">
              <span className={`text-5xl font-bold ${scoreColor}`}>
                {score}
              </span>
              <span className="text-base text-muted-foreground">/100</span>
            </div>
            {penalties.length > 0 ? (
              <ul className="space-y-1">
                {penalties.map((p, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    <span className="text-red-500 mr-1">▼</span>
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-500">No issues detected</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
