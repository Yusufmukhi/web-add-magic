import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioVsNifty } from "@/hooks/usePortfolioVsNifty";
import { formatINR } from "@/utils/formatters";
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

function shortINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return sign + "₹" + (abs / 1e7).toFixed(1) + "Cr";
  if (abs >= 1e5) return sign + "₹" + (abs / 1e5).toFixed(1) + "L";
  if (abs >= 1e3) return sign + "₹" + (abs / 1e3).toFixed(1) + "K";
  return sign + "₹" + abs.toFixed(0);
}

export function PortfolioValueChart({ portfolio }: Props) {
  const [period, setPeriod] = useState("6mo");
  const { series, summary, isLoading } = usePortfolioVsNifty(portfolio, period);

  const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    if (!series.length) return ["auto", "auto"];
    const vals = series.map((p) => p.portfolio);
    const min = Math.min(...vals, summary?.totalInvested ?? Infinity);
    const max = Math.max(...vals, summary?.totalInvested ?? -Infinity);
    const pad = (max - min) * 0.08 || max * 0.05;
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [series, summary]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Portfolio Value Over Time</h2>
          <p className="text-xs text-muted-foreground">
            {summary
              ? `Now ${formatINR(summary.portfolioNow)} · Invested ${formatINR(summary.totalInvested)}`
              : "Buy stocks to see this chart"}
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.v}
              size="sm"
              variant={period === p.v ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setPeriod(p.v)}
            >
              {p.l}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : !portfolio.length || !series.length ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data to plot.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => format(new Date(d), "dd MMM")}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                stroke="var(--border)"
                minTickGap={40}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                stroke="var(--border)"
                tickFormatter={(v: number) => shortINR(v)}
                width={62}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--foreground)",
                }}
                labelFormatter={(d: string) => format(new Date(d), "dd MMM yyyy")}
                formatter={(v: number) => [formatINR(v), "Portfolio"]}
              />
              {summary && (
                <ReferenceLine
                  y={summary.totalInvested}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: "Invested",
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="portfolio"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#pvFill)"
                name="Portfolio"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
