import { useState } from "react";
import { TrendingUp, Wallet, PiggyBank, BarChart3 } from "lucide-react";
import { formatINR, formatNumber } from "@/utils/formatters";
import { cn } from "@/lib/utils";

interface Props {
  invested: number;
  current: number;
  cashBalance: number;
  cagr: number | null;
}

type Metric = "value" | "pnl" | "cagr" | "invested";

export function PortfolioMetricStrip({ invested, current, cashBalance, cagr }: Props) {
  const [active, setActive] = useState<Metric>("value");

  const unrealized = current - invested;
  const unrealizedPct = invested > 0 ? (unrealized / invested) * 100 : 0;
  const portfolioValue = current + cashBalance;

  const metrics: { id: Metric; icon: typeof TrendingUp; label: string; value: string; sub: string; tone?: "gain" | "loss" }[] = [
    {
      id: "value",
      icon: Wallet,
      label: "Portfolio Value",
      value: formatINR(portfolioValue),
      sub: "Stocks + Cash",
    },
    {
      id: "pnl",
      icon: TrendingUp,
      label: "Total P&L",
      value: `${unrealized >= 0 ? "+" : ""}${formatINR(unrealized)}`,
      sub: `${unrealizedPct >= 0 ? "+" : ""}${formatNumber(unrealizedPct, 2)}%`,
      tone: unrealized >= 0 ? "gain" : "loss",
    },
    {
      id: "cagr",
      icon: BarChart3,
      label: "CAGR",
      value: cagr == null ? "—" : `${cagr >= 0 ? "+" : ""}${formatNumber(cagr, 2)}%`,
      sub: "Annualized",
      tone: cagr == null ? undefined : cagr >= 0 ? "gain" : "loss",
    },
    {
      id: "invested",
      icon: PiggyBank,
      label: "Invested",
      value: formatINR(invested),
      sub: "Cost basis",
    },
  ];

  const activeMetric = metrics.find((m) => m.id === active)!;

  return (
    <div className="space-y-3">
      {/* Hero value */}
      <div className="px-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{activeMetric.label}</p>
        <p
          className={cn(
            "font-display text-3xl font-bold tracking-tight mt-0.5",
            activeMetric.tone === "gain" && "text-gain",
            activeMetric.tone === "loss" && "text-loss"
          )}
        >
          {activeMetric.value}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">{activeMetric.sub}</p>
      </div>

      {/* Scrollable chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {metrics.map((m) => {
          const Icon = m.icon;
          const isActive = active === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              <Icon className="h-3 w-3" />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
