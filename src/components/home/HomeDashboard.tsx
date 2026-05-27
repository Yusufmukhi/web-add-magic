import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ShoppingCart,
  Wallet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockQuotes, type QuoteResult } from "@/hooks/useStockQuote";
import { usePortfolioVsNifty } from "@/hooks/usePortfolioVsNifty";
import type { Holding, Transaction } from "@/types/portfolio.types";
import { formatINR, formatIndianNumber } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const INDICES: { symbol: string; label: string }[] = [
  { symbol: "^NSEI", label: "NIFTY 50" },
  { symbol: "^BSESN", label: "SENSEX" },
  { symbol: "^NSEBANK", label: "NIFTY BANK" },
  { symbol: "^CNXMIDCAP", label: "MIDCAP 100" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface Props {
  portfolio: Holding[];
  portfolioQuotes: QuoteResult[];
  watchlistTickers: string[];
  cashBalance: number;
  transactions: Transaction[];
  onGoTo: (tab: "watchlist" | "portfolio" | "transactions") => void;
  onAddStock: () => void;
  onBuy: () => void;
  onAddFunds: () => void;
}

export function HomeDashboard({
  portfolio,
  portfolioQuotes,
  watchlistTickers,
  cashBalance,
  transactions,
  onGoTo,
  onAddStock,
  onBuy,
  onAddFunds,
}: Props) {
  // ---- Portfolio value + day P&L ----
  const { invested, current, dayPL } = useMemo(() => {
    let inv = 0;
    let cur = 0;
    let day = 0;
    for (const h of portfolio) {
      const q = portfolioQuotes.find((x) => x.ticker === h.ticker)?.data;
      const cp = q?.cmp ?? h.avgPrice;
      inv += h.avgPrice * h.qty;
      cur += cp * h.qty;
      if (q) day += (q.dayChange ?? 0) * h.qty;
    }
    return { invested: inv, current: cur, dayPL: day };
  }, [portfolio, portfolioQuotes]);

  const totalPL = current - invested;
  const totalPLPct = invested > 0 ? (totalPL / invested) * 100 : 0;
  const dayPLPct = current > 0 ? (dayPL / (current - dayPL || current)) * 100 : 0;
  const totalValue = current + cashBalance;

  // ---- Sparkline series (portfolio vs nifty hook reused) ----
  const { series } = usePortfolioVsNifty(portfolio, "1mo");
  const sparkData = series.length
    ? series.slice(-30).map((p) => ({ v: p.portfolio }))
    : [];

  // ---- Market indices ----
  const indexSyms = useMemo(() => INDICES.map((i) => i.symbol), []);
  const indexQuotes = useStockQuotes(indexSyms);

  // ---- Top movers from watchlist ----
  const watchQuotes = useStockQuotes(watchlistTickers);
  const sortedMovers = useMemo(() => {
    return watchQuotes
      .map((r) => r.data)
      .filter((d): d is NonNullable<typeof d> => !!d)
      .sort((a, b) => b.dayChangePct - a.dayChangePct);
  }, [watchQuotes]);
  const gainers = sortedMovers.slice(0, 3);
  const losers = [...sortedMovers].reverse().slice(0, 3);

  const recentTx = useMemo(
    () =>
      transactions
        .filter((t) => t.action === "BUY" || t.action === "SELL")
        .slice(0, 4),
    [transactions]
  );

  const dayUp = dayPL >= 0;
  const totalUp = totalPL >= 0;

  return (
    <div className="space-y-5 pb-6">
      {/* Greeting + Hero value card */}
      <section className="rounded-3xl border border-border bg-gradient-to-br from-card to-card/40 p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">{greeting()} 👋</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Portfolio Value
            </p>
            <p className="mt-1 truncate font-display text-3xl font-bold tracking-tight">
              {formatINR(totalValue, 2)}
            </p>
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-sm font-medium",
                dayUp ? "text-gain" : "text-loss"
              )}
            >
              {dayUp ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {dayUp ? "+" : ""}
              {formatINR(dayPL, 2)}
              <span className="opacity-80">
                ({dayUp ? "+" : ""}
                {isFinite(dayPLPct) ? dayPLPct.toFixed(2) : "0.00"}%) today
              </span>
            </p>
          </div>
          {sparkData.length > 1 && (
            <div className="h-16 w-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={totalUp ? "var(--gain)" : "var(--loss)"}
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor={totalUp ? "var(--gain)" : "var(--loss)"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={totalUp ? "var(--gain)" : "var(--loss)"}
                    strokeWidth={1.75}
                    fill="url(#hg)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Quick stat chips */}
      <section className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-4 sm:gap-3">
          <StatChip
            label="Today's P&L"
            value={`${dayUp ? "+" : ""}${formatINR(dayPL, 2)}`}
            tone={dayUp ? "gain" : "loss"}
            onClick={() => onGoTo("portfolio")}
          />
          <StatChip
            label="Total P&L"
            value={`${totalUp ? "+" : ""}${formatINR(totalPL, 2)}`}
            sub={`${totalUp ? "+" : ""}${totalPLPct.toFixed(2)}%`}
            tone={totalUp ? "gain" : "loss"}
            onClick={() => onGoTo("portfolio")}
          />
          <StatChip
            label="Cash"
            value={formatINR(cashBalance, 2)}
            onClick={onAddFunds}
          />
          <StatChip
            label="Invested"
            value={formatINR(invested, 2)}
            onClick={() => onGoTo("portfolio")}
          />
        </div>
      </section>

      {/* Market Pulse */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold tracking-tight">Market Pulse</h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => indexQuotes.forEach(() => {})}
            aria-label="Refresh indices"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {INDICES.map((idx, i) => {
            const q = indexQuotes[i];
            return (
              <IndexCard
                key={idx.symbol}
                label={idx.label}
                value={q?.data?.cmp ?? null}
                changePct={q?.data?.dayChangePct ?? null}
                loading={q?.isLoading}
              />
            );
          })}
        </div>
      </section>

      {/* Top Movers */}
      {watchlistTickers.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold tracking-tight">
              Top Movers · Watchlist
            </h2>
            <button
              onClick={() => onGoTo("watchlist")}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MoversCard title="Gainers" icon={<TrendingUp className="h-3.5 w-3.5" />} positive items={gainers} onPick={() => onGoTo("watchlist")} />
            <MoversCard title="Losers" icon={<TrendingDown className="h-3.5 w-3.5" />} positive={false} items={losers} onPick={() => onGoTo("watchlist")} />
          </div>
        </section>
      )}

      {/* Recent Transactions */}
      {recentTx.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold tracking-tight">Recent Activity</h2>
            <button
              onClick={() => onGoTo("transactions")}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {recentTx.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                      t.action === "BUY"
                        ? "bg-gain/15 text-gain"
                        : "bg-loss/15 text-loss"
                    )}
                  >
                    {t.action}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.stock}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.date} · {t.qty} @ ₹{formatIndianNumber(t.price ?? 0, 2)}
                    </p>
                  </div>
                </div>
                <p className="text-right font-mono text-sm">
                  {formatINR(t.amount, 2)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Quick Actions */}
      <section className="grid grid-cols-3 gap-2">
        <QuickAction icon={<Plus className="h-4 w-4" />} label="Watchlist" onClick={onAddStock} />
        <QuickAction icon={<ShoppingCart className="h-4 w-4" />} label="Buy / Sell" onClick={onBuy} />
        <QuickAction icon={<Wallet className="h-4 w-4" />} label="Add Funds" onClick={onAddFunds} />
      </section>
    </div>
  );
}

function StatChip({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[140px] rounded-2xl border border-border bg-card px-3 py-2.5 text-left transition hover:border-primary/50 active:scale-[0.98] sm:min-w-0"
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate font-mono text-sm font-semibold",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss"
        )}
      >
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            "text-[10px] font-mono",
            tone === "gain" && "text-gain",
            tone === "loss" && "text-loss"
          )}
        >
          {sub}
        </p>
      )}
    </button>
  );
}

function IndexCard({
  label,
  value,
  changePct,
  loading,
}: {
  label: string;
  value: number | null;
  changePct: number | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-5 w-20" />
        <Skeleton className="mt-1 h-3 w-12" />
      </div>
    );
  }
  const up = (changePct ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-semibold tabular-nums">
        {value != null ? formatIndianNumber(value, 2) : "—"}
      </p>
      <p
        className={cn(
          "text-[11px] font-mono",
          up ? "text-gain" : "text-loss"
        )}
      >
        {changePct != null
          ? `${up ? "▲" : "▼"} ${Math.abs(changePct).toFixed(2)}%`
          : "—"}
      </p>
    </div>
  );
}

function MoversCard({
  title,
  icon,
  positive,
  items,
  onPick,
}: {
  title: string;
  icon: React.ReactNode;
  positive: boolean;
  items: { ticker: string; cmp: number; dayChangePct: number; name: string }[];
  onPick: (t: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div
        className={cn(
          "mb-2 flex items-center gap-1.5 text-xs font-semibold",
          positive ? "text-gain" : "text-loss"
        )}
      >
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          No data yet
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s) => {
            const up = s.dayChangePct >= 0;
            return (
              <li key={s.ticker}>
                <button
                  onClick={() => onPick(s.ticker)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold">
                      {s.ticker.replace(/\.NS$|\.BO$/, "")}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {s.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs">
                      {formatINR(s.cmp, 2)}
                    </p>
                    <p
                      className={cn(
                        "font-mono text-[11px]",
                        up ? "text-gain" : "text-loss"
                      )}
                    >
                      {up ? "+" : ""}
                      {s.dayChangePct.toFixed(2)}%
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-3 text-xs font-medium transition hover:border-primary/50 hover:bg-accent/30 active:scale-[0.98]"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      {label}
    </button>
  );
}
