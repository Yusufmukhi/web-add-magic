import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, GitCompare } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchHistory } from "@/services/api";
import { toast } from "sonner";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "2y"] as const;
type Period = typeof PERIODS[number];

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

interface HistPoint { date: string; close: number }

function useHistory(ticker: string | null, period: string) {
  return useQuery({
    queryKey: ["history", ticker, period],
    enabled: !!ticker,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetchHistory(ticker!, period);
      if (res.error) throw new Error(res.error);
      return (res.history ?? []) as HistPoint[];
    },
  });
}

function normalize(pts: HistPoint[]): Record<string, number> {
  if (!pts.length) return {};
  const base = pts[0].close;
  const out: Record<string, number> = {};
  for (const p of pts) out[p.date] = base > 0 ? Math.round((p.close / base) * 10000) / 100 : 100;
  return out;
}

export function CompareChart() {
  const [tickers, setTickers] = useState<string[]>(["NIFTY50"]);
  const [input, setInput] = useState("");
  const [period, setPeriod] = useState<Period>("6mo");

  const addTicker = () => {
    const t = input.trim().toUpperCase();
    if (!t) return;
    if (tickers.includes(t)) { toast.error(`${t} already added`); return; }
    if (tickers.length >= 5) { toast.error("Max 5 stocks to compare"); return; }
    // Map NIFTY50 to ^NSEI for Yahoo
    setTickers((prev) => [...prev, t]);
    setInput("");
  };

  const removeTicker = (t: string) => setTickers((prev) => prev.filter((x) => x !== t));

  // Map display ticker → Yahoo ticker for API calls
  const toYahoo = (t: string) => t === "NIFTY50" ? "^NSEI" : t;

  const queries = tickers.map((t) => useHistory(toYahoo(t), period)); // eslint-disable-line react-hooks/rules-of-hooks

  const chartData = useMemo(() => {
    const normed = tickers.map((t, i) => {
      const pts = queries[i].data ?? [];
      return normalize(pts);
    });

    // Union of all dates
    const allDates = Array.from(
      new Set(normed.flatMap((n) => Object.keys(n)))
    ).sort();

    return allDates.map((date) => {
      const row: Record<string, unknown> = { date };
      tickers.forEach((t, i) => {
        if (normed[i][date] != null) row[t] = normed[i][date];
      });
      return row;
    });
  }, [tickers, queries]);

  const isLoading = queries.some((q) => q.isLoading);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 creative:gradient-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
      <div className="mb-4 flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Compare Stocks — Normalised (Base 100)
        </h3>
      </div>

      {/* Ticker input */}
      <div className="mb-3 flex flex-wrap gap-2">
        {tickers.map((t, i) => (
          <Badge
            key={t}
            variant="outline"
            className="gap-1 pr-1"
            style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}
          >
            {t}
            {tickers.length > 1 && (
              <button onClick={() => removeTicker(t)} className="ml-0.5 rounded-full hover:bg-muted/50">
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && addTicker()}
          placeholder="Add ticker (e.g. RELIANCE)"
          className="h-8 max-w-[220px] text-sm minimal:rounded-none"
        />
        <Button onClick={addTicker} size="sm" variant="outline" className="gap-1 minimal:rounded-none">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
        <div className="ml-auto flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          Loading chart data…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: string) => v.slice(5)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => `${v}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v: number, name: string) => [`${v.toFixed(2)}`, name]}
              labelFormatter={(l: string) => l}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {tickers.map((t, i) => (
              <Line
                key={t}
                type="monotone"
                dataKey={t}
                stroke={COLORS[i % COLORS.length]}
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground">
        All series rebased to 100 at start of period. "NIFTY50" plots ^NSEI index.
      </p>
    </div>
  );
}
