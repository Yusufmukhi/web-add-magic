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

// ── Reuse same factor-score helpers as FactorView ────────────────────────────
function clamp(n: number, min = 0, max = 100): number {
  return Math.min(Math.max(n, min), max);
}

function computeFactorScores(d: Record<string, unknown> | null | undefined) {
  if (!d) return { quality: 50, growth: 50, momentum: 50 };

  // Quality
  let quality = 50;
  if (d.returnOnEquity != null) {
    const roe = (d.returnOnEquity as number) * 100;
    if (roe > 20) quality += 25;
    else if (roe > 15) quality += 15;
    else if (roe < 0) quality -= 20;
  }
  if (d.debtToEquity != null) {
    const de = d.debtToEquity as number;
    if (de < 50) quality += 15;
    else if (de < 100) quality += 5;
    else if (de > 200) quality -= 20;
  }
  if (d.profitMargins != null) {
    const pm = (d.profitMargins as number) * 100;
    if (pm > 15) quality += 10;
    else if (pm > 5) quality += 5;
    else if (pm < 0) quality -= 15;
  }
  quality = clamp(quality);

  // Growth
  let growth = 50;
  if (d.revenueGrowth != null) {
    const g = (d.revenueGrowth as number) * 100;
    growth = g > 20 ? 90 : g > 10 ? 70 : g > 0 ? 50 : 20;
  }

  // Momentum
  let momentum = 50;
  const high = (d.fiftyTwoWeekHigh as number) ?? 0;
  const low = (d.fiftyTwoWeekLow as number) ?? 0;
  const cmp = (d.cmp as number) ?? 0;
  if (high > low && low > 0) {
    const position = (cmp - low) / (high - low);
    momentum = clamp(position * 100);
  }

  return { quality, growth, momentum };
}

export function RiskView({ portfolio, results }: Props) {
  const { resolve } = useSectorOverrides();

  const analytics = useMemo(() => {
    if (!portfolio.length) return null;

    const safePct = (value: number, total: number) =>
      total === 0 ? 0 : (value / total) * 100;

    const priceMap: Record<string, number> = {};
    for (const result of results) {
      if (result.data?.cmp) {
        priceMap[result.ticker] = result.data.cmp;
      }
    }

    const holdingsWithValue = portfolio.map((h) => {
      const price = priceMap[h.ticker] ?? h.avgPrice;
      const value = h.qty * price;
      const result = results.find((r) => r.ticker === h.ticker);
      return { ...h, value, result };
    });

    const totalValue = holdingsWithValue.reduce((sum, h) => sum + h.value, 0);
    const sorted = [...holdingsWithValue].sort((a, b) => b.value - a.value);

    const topHolding = sorted[0];
    const topPct = safePct(topHolding.value, totalValue);
    const top3Value = sorted.slice(0, 3).reduce((sum, h) => sum + h.value, 0);
    const top3Pct = safePct(top3Value, totalValue);

    const sectorTotals: Record<string, number> = {};
    for (const h of holdingsWithValue) {
      const sector = resolve(h.ticker, h.result?.data?.sector ?? "Unknown");
      sectorTotals[sector] = (sectorTotals[sector] ?? 0) + h.value;
    }

    const sectorWeights: Record<string, number> = {};
    for (const [sector, val] of Object.entries(sectorTotals)) {
      sectorWeights[sector] = safePct(val, totalValue);
    }

    const uniqueSectorCount = Object.keys(sectorWeights).length;

    // ── FIXED: Health score now incorporates quality, growth & momentum ──────
    let score = 100;
    const penalties: string[] = [];

    // Concentration penalties (unchanged)
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

    // Factor-based penalties: weighted average across holdings
    let wQuality = 0, wGrowth = 0, wMomentum = 0;
    for (const h of holdingsWithValue) {
      const w = totalValue > 0 ? h.value / totalValue : 0;
      const d = results.find((r) => r.ticker === h.ticker)?.data ?? null;
      const f = computeFactorScores(d as Record<string, unknown> | null);
      wQuality += w * f.quality;
      wGrowth += w * f.growth;
      wMomentum += w * f.momentum;
    }

    if (wQuality < 40) {
      score -= 15;
      penalties.push(`Low quality score (${Math.round(wQuality)}/100) — weak ROE, high debt, or thin margins`);
    } else if (wQuality < 55) {
      score -= 5;
      penalties.push(`Average quality (${Math.round(wQuality)}/100) — watch debt levels and margins`);
    }

    if (wGrowth < 40) {
      score -= 10;
      penalties.push(`Slow or negative revenue growth (score ${Math.round(wGrowth)}/100)`);
    }

    if (wMomentum < 35) {
      score -= 5;
      penalties.push(`Most holdings near 52-week lows — momentum score ${Math.round(wMomentum)}/100`);
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

  const { topHolding, topPct, top3Pct, sectorWeights, score, penalties } = analytics;

  const concentrationVariant =
    topPct > 25
      ? "border-red-500 text-red-500"
      : topPct > 15
      ? "border-yellow-500 text-yellow-500"
      : "border-green-500 text-green-500";
  const concentrationLabel = topPct > 25 ? "HIGH RISK" : topPct > 15 ? "MEDIUM" : "LOW";

  const scoreColor =
    score >= 70 ? "text-emerald-500" : score >= 50 ? "text-yellow-500" : "text-red-500";

  const sortedSectors = Object.entries(sectorWeights).sort(([, a], [, b]) => b - a);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Risk View</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
                <span className="text-foreground">{topPct.toFixed(1)}%</span>
              </span>
              <Badge variant="outline" className={concentrationVariant}>
                {concentrationLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Top 3 holdings:{" "}
              <span className="font-medium text-foreground">{top3Pct.toFixed(1)}%</span>{" "}
              of portfolio
            </p>
          </CardContent>
        </Card>

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
                  <Badge variant="outline" className={`text-xs ${sectorBadgeClass(sector)}`}>
                    {sector}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1 mb-3">
              <span className={`text-5xl font-bold ${scoreColor}`}>{score}</span>
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
