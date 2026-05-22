import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBenchmarkSeries } from "@/hooks/useBenchmarkSeries";
import type { Holding } from "@/types/portfolio.types";

const PERIODS = [
  { v: "1mo", l: "1M" },
  { v: "3mo", l: "3M" },
  { v: "6mo", l: "6M" },
  { v: "1y", l: "1Y" },
  { v: "5y", l: "5Y" },
] as const;

interface Props {
  portfolio: Holding[];
}

function ReturnCard({
  label,
  value,
  color,
  show = true,
  isBeat,
}: {
  label: string;
  value: number | null;
  color: string;
  show?: boolean;
  isBeat?: boolean | null;
}) {
  if (!show || value === null) {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 minimal:rounded-none minimal:border-0 minimal:border-b minimal:bg-transparent">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="font-mono text-xl font-bold text-muted-foreground">—</span>
        <span className="text-[10px] text-muted-foreground">No data</span>
      </div>
    );
  }

  const sign = value >= 0 ? "+" : "";
  const isGain = value >= 0;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 creative:shadow-soft minimal:rounded-none minimal:border-0 minimal:border-b minimal:bg-transparent">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span
        className={`font-mono text-xl font-bold ${isGain ? "text-gain" : "text-loss"}`}
      >
        {sign}{value.toFixed(2)}%
      </span>
      {isBeat !== null && isBeat !== undefined && (
        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isBeat ? "text-gain" : "text-loss"}`}>
          {isBeat ? (
            <><TrendingUp className="h-3 w-3" /> Beating NIFTY</>
          ) : (
            <><TrendingDown className="h-3 w-3" /> Lagging NIFTY</>
          )}
        </span>
      )}
      {isBeat === undefined && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Minus className="h-3 w-3" /> Benchmark
        </span>
      )}
    </div>
  );
}

export function ReturnsComparison({ portfolio }: Props) {
  const [period, setPeriod] = useState("3mo");
  const { series, isLoading } = useBenchmarkSeries(portfolio, period);

  const last = series[series.length - 1];
  const returns = last
    ? {
        portfolio: last.portfolio - 100,
        nifty: last.nifty - 100,
        sensex: last.sensex - 100,
      }
    : null;

  const hasPortfolio = portfolio.length > 0;
  const beat =
    returns && hasPortfolio ? returns.portfolio > returns.nifty : null;

  const periodLabel = PERIODS.find((p) => p.v === period)?.l ?? period;

  return (
    <Card className="creative:bg-gradient-to-br creative:from-card creative:to-card/60 creative:shadow-soft minimal:rounded-none minimal:border-2 p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Returns vs Benchmarks</h2>
          <p className="text-xs text-muted-foreground">
            {periodLabel} returns — portfolio vs NIFTY 50 vs SENSEX
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.v}
              size="sm"
              variant={period === p.v ? "default" : "outline"}
              className="h-7 px-2.5 text-xs minimal:rounded-none"
              onClick={() => setPeriod(p.v)}
            >
              {p.l}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ReturnCard
              label="My Portfolio"
              value={hasPortfolio ? (returns?.portfolio ?? null) : null}
              color="var(--primary)"
              show={hasPortfolio}
              isBeat={beat}
            />

            <ReturnCard
              label="NIFTY 50"
              value={returns?.nifty ?? null}
              color="#10b981"
            />
            <ReturnCard
              label="SENSEX"
              value={returns?.sensex ?? null}
              color="#f59e0b"
            />
          </div>

          {hasPortfolio && returns && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 minimal:rounded-none">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">vs NIFTY 50: </span>
                <span className={returns.portfolio - returns.nifty >= 0 ? "text-gain font-semibold" : "text-loss font-semibold"}>
                  {returns.portfolio - returns.nifty >= 0 ? "+" : ""}
                  {(returns.portfolio - returns.nifty).toFixed(2)}%
                </span>
                {"  ·  "}
                <span className="font-medium text-foreground">vs SENSEX: </span>
                <span className={returns.portfolio - returns.sensex >= 0 ? "text-gain font-semibold" : "text-loss font-semibold"}>
                  {returns.portfolio - returns.sensex >= 0 ? "+" : ""}
                  {(returns.portfolio - returns.sensex).toFixed(2)}%
                </span>
              </p>
            </div>
          )}

          {!hasPortfolio && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Buy stocks to see your portfolio return here.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
