import { useState, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioVsNifty } from "@/hooks/usePortfolioVsNifty";
import { formatINR, formatIndianNumber } from "@/utils/formatters";
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

function SummaryCard({
  label,
  value,
  gain,
  gainPct,
  icon,
  color,
  highlight,
}: {
  label: string;
  value: number;
  gain: number;
  gainPct: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  const isGain = gain >= 0;
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border p-4 minimal:rounded-none ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="font-mono text-lg font-bold text-foreground">
        {formatINR(value)}
      </p>
      <p className={`text-xs font-medium ${isGain ? "text-gain" : "text-loss"}`}>
        {isGain ? "+" : ""}{formatINR(gain)}{" "}
        <span className="opacity-80">
          ({isGain ? "+" : ""}{gainPct.toFixed(2)}%)
        </span>
      </p>
    </div>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
  invested,
}: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
  invested: number;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover p-3 shadow-lg text-xs minimal:rounded-none">
      <p className="mb-2 font-semibold text-foreground">
        {label ? format(new Date(label), "dd MMM yyyy") : ""}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-mono font-semibold text-foreground">
            {formatINR(entry.value)}
          </span>
        </div>
      ))}
      {invested > 0 && (
        <div className="mt-2 border-t border-border pt-1.5 text-muted-foreground">
          Invested: {formatINR(invested)}
        </div>
      )}
    </div>
  );
};

export function PortfolioVsNiftyChart({ portfolio }: Props) {
  const [period, setPeriod] = useState("3mo");
  const { series, summary, isLoading } = usePortfolioVsNifty(portfolio, period);
  const hasPortfolio = portfolio.length > 0;

  const yDomain = useMemo(() => {
    if (!series.length) return ["auto", "auto"] as const;
    const vals = series.flatMap((p) => [p.portfolio, p.nifty, p.cash]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.08 || max * 0.05;
    return [Math.floor(min - pad), Math.ceil(max + pad)] as const;
  }, [series]);

  return (
    <Card className="creative:bg-gradient-to-br creative:from-card creative:to-card/60 creative:shadow-soft minimal:rounded-none minimal:border-2 p-5">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            Portfolio vs NIFTY 50 vs Cash
          </h2>
          <p className="text-xs text-muted-foreground">
            If ₹{summary ? formatIndianNumber(summary.totalInvested, 0) : "—"} was invested at the start of this period
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

      {/* Summary cards */}
      {isLoading ? (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : summary ? (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Your Portfolio"
            value={summary.portfolioNow}
            gain={summary.portfolioGain}
            gainPct={summary.portfolioGainPct}
            color="hsl(var(--primary))"
            icon={
              summary.beatNifty ? (
                <TrendingUp className="ml-auto h-3.5 w-3.5 text-gain" />
              ) : (
                <TrendingDown className="ml-auto h-3.5 w-3.5 text-loss" />
              )
            }
            highlight
          />
          <SummaryCard
            label="If in NIFTY 50"
            value={summary.niftyNow}
            gain={summary.niftyGain}
            gainPct={summary.niftyGainPct}
            color="#10b981"
            icon={null}
          />
          <SummaryCard
            label="If held as Cash"
            value={summary.totalInvested}
            gain={0}
            gainPct={0}
            color="#94a3b8"
            icon={<Wallet className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
          />
        </div>
      ) : null}

      {/* Alpha badge */}
      {summary && (
        <div
          className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium minimal:rounded-none ${
            summary.beatNifty
              ? "border-gain/30 bg-gain/10 text-gain"
              : "border-loss/30 bg-loss/10 text-loss"
          }`}
        >
          {summary.beatNifty ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {summary.beatNifty ? "Beating" : "Lagging"} NIFTY 50 by{" "}
          <strong>{Math.abs(summary.alpha).toFixed(2)}%</strong>
          {" "}this period
        </div>
      )}

      {/* Chart */}
      <div className="h-72 w-full">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : !hasPortfolio ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Add stocks to your portfolio to see this chart.
          </div>
        ) : series.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No historical data available for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series}
              margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => format(new Date(d), "dd MMM")}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                minTickGap={40}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v: number) => shortINR(v)}
                width={62}
              />
              <Tooltip
                content={
                  <CustomTooltip invested={summary?.totalInvested ?? 0} />
                }
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {summary && (
                <ReferenceLine
                  y={summary.totalInvested}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                />
              )}
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
                name="My Portfolio"
              />
              <Line
                type="monotone"
                dataKey="nifty"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="NIFTY 50"
              />
              <Line
                type="monotone"
                dataKey="cash"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Cash (no growth)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
