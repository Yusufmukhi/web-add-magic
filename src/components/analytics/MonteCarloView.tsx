import { useMemo, useState, useCallback } from "react";
import { Dices } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/utils/formatters";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

interface SimResults {
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  probProfit: number;
  probDouble: number;
  paths: number[][];
  totalValue: number;
}

const YEAR_OPTIONS = [1, 3, 5, 10] as const;
const N_SIMS = 500;

export function MonteCarloView({ portfolio, results }: Props) {
  const [years, setYears] = useState(3);
  const [simResults, setSimResults] = useState<SimResults | null>(null);
  const [running, setRunning] = useState(false);

  const portfolioParams = useMemo(() => {
    if (!portfolio.length) return null;

    const priceMap: Record<string, number> = {};
    for (const r of results) {
      if (r.data?.cmp) priceMap[r.ticker] = r.data.cmp;
    }

    const rows = portfolio.map((h) => {
      const currentPrice = priceMap[h.ticker] ?? h.avgPrice;
      const holdingValue = h.qty * currentPrice;
      const d = results.find((x) => x.ticker === h.ticker)?.data;

      const high = d?.fiftyTwoWeekHigh ?? 0;
      const low = d?.fiftyTwoWeekLow ?? 0;
      const rangeVol = high > 0 && low > 0 ? (high - low) / low / Math.sqrt(252) : 0.01;
      const dayVol = Math.abs(d?.dayChangePct ?? 0) / 100;
      const dailyVol = Math.max(rangeVol, dayVol, 0.01);

      let annualReturn = 0.08;
      if (d?.revenueGrowth != null) {
        annualReturn = Math.min(Math.max(d.revenueGrowth, -0.3), 0.5);
      } else if (d?.returnOnEquity != null) {
        annualReturn = Math.min(Math.max(d.returnOnEquity * 0.5, -0.3), 0.5);
      }

      return { holdingValue, dailyVol, annualReturn };
    });

    const totalValue = rows.reduce((s, r) => s + r.holdingValue, 0);
    if (totalValue === 0) return null;

    const portfolioMu = rows.reduce(
      (s, r) => s + (r.holdingValue / totalValue) * r.annualReturn,
      0
    );
    const portfolioSigma =
      rows.reduce((s, r) => s + (r.holdingValue / totalValue) * r.dailyVol, 0) *
      Math.sqrt(252);

    return { totalValue, portfolioMu, portfolioSigma };
  }, [portfolio, results]);

  const runSimulation = useCallback(() => {
    if (!portfolioParams) return;
    setRunning(true);

    // Defer to next tick so UI updates first
    setTimeout(() => {
      const { totalValue, portfolioMu, portfolioSigma } = portfolioParams;
      const days = years * 252;
      const snapshotEvery = 21; // monthly
      const allFinals: number[] = [];
      const allPaths: number[][] = [];

      for (let sim = 0; sim < N_SIMS; sim++) {
        let value = totalValue;
        const path: number[] = [value];
        for (let d = 0; d < days; d++) {
          const u1 = Math.random();
          const u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
          const dailyReturn =
            portfolioMu / 252 + (portfolioSigma / Math.sqrt(252)) * z;
          value *= 1 + dailyReturn;
          if ((d + 1) % snapshotEvery === 0) path.push(value);
        }
        allFinals.push(value);
        if (sim < 50) allPaths.push(path);
      }

      allFinals.sort((a, b) => a - b);
      const at = (pct: number) => allFinals[Math.floor(pct * N_SIMS)] ?? allFinals[0];

      const probProfit = (allFinals.filter((v) => v > totalValue).length / N_SIMS) * 100;
      const probDouble = (allFinals.filter((v) => v > totalValue * 2).length / N_SIMS) * 100;

      setSimResults({
        median: at(0.5),
        p10: at(0.1),
        p25: at(0.25),
        p75: at(0.75),
        p90: at(0.9),
        probProfit,
        probDouble,
        paths: allPaths,
        totalValue,
      });
      setRunning(false);
    }, 10);
  }, [portfolioParams, years]);

  if (!portfolio.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Dices className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Monte Carlo Simulation</h2>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-muted-foreground">Horizon:</span>
        <div className="flex gap-1">
          {YEAR_OPTIONS.map((y) => (
            <Button
              key={y}
              size="sm"
              variant={years === y ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => {
                setYears(y);
                setSimResults(null);
              }}
            >
              {y}Y
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={runSimulation}
          disabled={running}
          className="h-7 gap-1.5"
        >
          <Dices className="h-3.5 w-3.5" />
          {running ? "Running..." : simResults ? "Re-run" : "Run Simulation"}
        </Button>
      </div>

      {!simResults && !running && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Dices className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Runs 500 simulated futures using your portfolio's real volatility
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Select horizon above and click Run Simulation
          </p>
        </div>
      )}

      {running && (
        <div className="rounded-2xl border border-border p-10 text-center animate-pulse">
          <p className="text-sm text-muted-foreground">Running 500 simulations...</p>
        </div>
      )}

      {simResults && !running && (
        <div className="space-y-4">
          {/* Outcome cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">Median Outcome ({years}Y)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${simResults.median >= simResults.totalValue ? "text-emerald-500" : "text-red-500"}`}>
                  {formatINR(simResults.median)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {simResults.median >= simResults.totalValue ? "+" : ""}
                  {(((simResults.median - simResults.totalValue) / simResults.totalValue) * 100).toFixed(1)}% from today
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">Best Case (90th pct)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-500">{formatINR(simResults.p90)}</p>
                <p className="text-xs text-muted-foreground mt-1">Top 10% of simulations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">Worst Case (10th pct)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-500">{formatINR(simResults.p10)}</p>
                <p className="text-xs text-muted-foreground mt-1">Bottom 10% of simulations</p>
              </CardContent>
            </Card>
          </div>

          {/* Probability card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Probability</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className={`text-3xl font-bold ${simResults.probProfit >= 60 ? "text-emerald-500" : "text-yellow-500"}`}>
                  {simResults.probProfit.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Chance of profit in {years}Y</p>
              </div>
              <div>
                <p className={`text-3xl font-bold ${simResults.probDouble >= 30 ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {simResults.probDouble.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Chance of doubling in {years}Y</p>
              </div>
            </CardContent>
          </Card>

          {/* SVG paths */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Simulated Paths (50 of 500)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimPathChart simResults={simResults} />
              <p className="text-[10px] text-muted-foreground mt-2">
                Green = profit scenarios · Red = loss scenarios · Bold line = median · Dashed = 10th/90th percentile
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SimPathChart({ simResults }: { simResults: SimResults }) {
  const { paths, totalValue, median, p10, p90 } = simResults;

  const W = 600;
  const H = 200;

  const allValues = paths.flat();
  const minV = Math.min(...allValues, p10) * 0.95;
  const maxV = Math.max(...allValues, p90) * 1.05;

  const steps = paths[0]?.length ?? 1;

  const toX = (i: number) => (i / (steps - 1)) * W;
  const toY = (v: number) => H - ((v - minV) / (maxV - minV)) * H;

  const pathString = (pts: number[]) =>
    pts.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

  // Median path approximation using simResults.median (final value)
  const medianPath = paths.reduce((best, path) => {
    const finalV = path[path.length - 1];
    const bestFinalV = best[best.length - 1];
    return Math.abs(finalV - median) < Math.abs(bestFinalV - median) ? path : best;
  }, paths[0] ?? []);

  const baselineY = toY(totalValue);
  const p10Y = toY(p10);
  const p90Y = toY(p90);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Baseline */}
      <line
        x1="0" y1={baselineY} x2={W} y2={baselineY}
        stroke="currentColor" strokeDasharray="4 3" strokeOpacity={0.3} strokeWidth={1}
      />
      {/* p10 */}
      <line
        x1="0" y1={p10Y} x2={W} y2={p10Y}
        stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.4} strokeWidth={1}
      />
      {/* p90 */}
      <line
        x1="0" y1={p90Y} x2={W} y2={p90Y}
        stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.4} strokeWidth={1}
      />

      {/* 50 paths */}
      {paths.map((path, i) => {
        const finalV = path[path.length - 1];
        const isProfit = finalV >= totalValue;
        return (
          <polyline
            key={i}
            points={pathString(path)}
            fill="none"
            stroke={isProfit ? "#10b981" : "#ef4444"}
            strokeWidth={0.8}
            strokeOpacity={0.15}
          />
        );
      })}

      {/* Median path */}
      {medianPath.length > 0 && (
        <polyline
          points={pathString(medianPath)}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
          strokeOpacity={0.9}
        />
      )}
    </svg>
  );
}
