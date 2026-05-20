import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeriesPoint } from "@/hooks/useBenchmarkSeries";

const PERIODS = [
  { v: "1mo", l: "1M" },
  { v: "3mo", l: "3M" },
  { v: "6mo", l: "6M" },
  { v: "1y", l: "1Y" },
  { v: "5y", l: "5Y" },
] as const;

interface Props {
  series: SeriesPoint[];
  isLoading: boolean;
  period: string;
  onPeriodChange: (p: string) => void;
  hasPortfolio: boolean;
}

export function BenchmarkChart({ series, isLoading, period, onPeriodChange, hasPortfolio }: Props) {
  const last = series[series.length - 1];
  const stats = useMemo(() => {
    if (!last) return null;
    return {
      p: last.portfolio - 100,
      n: last.nifty - 100,
      s: last.sensex - 100,
    };
  }, [last]);

  return (
    <Card className="creative:bg-gradient-to-br creative:from-card creative:to-card/60 creative:shadow-soft minimal:rounded-none minimal:border-2 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Benchmark Comparison</h2>
          <p className="text-xs text-muted-foreground">
            Portfolio vs NIFTY 50 vs SENSEX — rebased to 100
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.v}
              size="sm"
              variant={period === p.v ? "default" : "outline"}
              className="h-7 px-2.5 text-xs minimal:rounded-none"
              onClick={() => onPeriodChange(p.v)}
            >
              {p.l}
            </Button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
          <StatPill label={hasPortfolio ? "Portfolio" : "—"} value={stats.p} color="hsl(var(--primary))" />
          <StatPill label="NIFTY 50" value={stats.n} color="hsl(var(--chart-2, 142 71% 45%))" />
          <StatPill label="SENSEX" value={stats.s} color="hsl(var(--chart-3, 38 92% 50%))" />
        </div>
      )}

      <div className="h-72 w-full">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : series.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => v.toFixed(2)}
                labelFormatter={(d: string) => format(new Date(d), "PP")}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {hasPortfolio && (
                <Line type="monotone" dataKey="portfolio" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="Portfolio" />
              )}
              <Line type="monotone" dataKey="nifty" stroke="#10b981" strokeWidth={2} dot={false} name="NIFTY 50" />
              <Line type="monotone" dataKey="sensex" stroke="#f59e0b" strokeWidth={2} dot={false} name="SENSEX" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const sign = value >= 0 ? "+" : "";
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5 minimal:rounded-none">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className={`mt-0.5 font-display text-base font-semibold ${value >= 0 ? "text-gain" : "text-loss"}`}>
        {sign}{value.toFixed(2)}%
      </div>
    </div>
  );
}

export { PERIODS };
