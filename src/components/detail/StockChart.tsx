import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { useStockHistory } from "@/hooks/useStockHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

const PERIODS = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_MAP: Record<Period, string> = {
  "1D": "1d", "1W": "5d", "1M": "1mo", "3M": "3mo",
  "6M": "6mo", "1Y": "1y", "5Y": "5y",
};

// FIX: intraday periods (1D, 1W) use time labels; longer periods use date labels
function formatXAxis(dateStr: string, period: Period): string {
  const d = new Date(dateStr);
  if (period === "1D") {
    // Worker returns 1-minute bars for 1d — show HH:MM
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (period === "1W") {
    // 5-minute bars — show day + time
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  if (period === "1M" || period === "3M" || period === "6M") {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  period?: Period;
}

function CustomTooltip({ active, payload, label, period }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const val = payload[0].value;
  // For intraday show datetime, otherwise just date
  const isIntraday = period === "1D" || period === "1W";
  const d = new Date(label);
  const displayLabel = isIntraday
    ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm text-xs">
      <div className="text-muted-foreground mb-0.5">{displayLabel}</div>
      <div className="font-mono font-semibold text-foreground">{formatINR(val)}</div>
    </div>
  );
}

interface Props {
  symbol: string;
  currentPrice?: number;
}

export function StockChart({ symbol, currentPrice }: Props) {
  const [period, setPeriod] = useState<Period>("3M");
  const { data: history, isLoading, error } = useStockHistory(symbol, PERIOD_MAP[period]);

  const isGain = history && history.length >= 2
    ? (history[history.length - 1]?.close ?? 0) >= (history[0]?.close ?? 0)
    : true;

  const gainColor = "#22c55e";
  const lossColor = "#ef4444";
  const lineColor = isGain ? gainColor : lossColor;

  const firstClose = history?.[0]?.close ?? 0;
  const lastClose = history?.[history.length - 1]?.close ?? 0;
  const change = lastClose - firstClose;
  const changePct = firstClose > 0 ? (change / firstClose) * 100 : 0;

  const tickCount = 6;
  const ticks = history && history.length > tickCount
    ? history
        .filter((_, i) => i % Math.floor(history.length / tickCount) === 0)
        .map((d) => d.date)
    : history?.map((d) => d.date) ?? [];

  const minClose = history ? Math.min(...history.map((d) => d.close)) : 0;
  const maxClose = history ? Math.max(...history.map((d) => d.close)) : 0;
  const padding = (maxClose - minClose) * 0.08 || 1;
  const yDomain: [number, number] = [minClose - padding, maxClose + padding];

  return (
    <div className="space-y-3">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {history && history.length > 1 && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${isGain ? "text-gain" : "text-loss"}`}>
            {isGain ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change >= 0 ? "+" : ""}{formatINR(change)} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: 280 }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="space-y-2 w-full px-6">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-2 w-3/4" />
            </div>
          </div>
        ) : error || !history || history.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Chart data unavailable
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={history}
              margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.4}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={(v) => formatXAxis(v, period)}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v) => "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickCount={5}
              />
              <Tooltip content={<CustomTooltip period={period} />} />
              {currentPrice && (
                <ReferenceLine
                  y={currentPrice}
                  stroke={lineColor}
                  strokeDasharray="4 3"
                  strokeOpacity={0.6}
                  strokeWidth={1}
                />
              )}
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#grad-${symbol})`}
                dot={false}
                activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                isAnimationActive={true}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
