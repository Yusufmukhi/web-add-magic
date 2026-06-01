import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  className?: string;
  valueClassName?: string;
}

export function MetricCard({
  label,
  value,
  sub,
  className,
  valueClassName,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card border border-border p-4 flex flex-col gap-1",
        className
      )}
    >
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className={cn("text-lg font-bold text-foreground", valueClassName)}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

interface MetricStripProps {
  freeCash: number;
  walletBalance: number;
  savings: number;
  netWorth: number;
  currency?: string;
}

function fmt(n: number, currency = "₹") {
  return `${currency}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function FinanceMetricStrip({
  freeCash,
  walletBalance,
  savings,
  netWorth,
  currency = "₹",
}: MetricStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Free Cash"
        value={fmt(freeCash, currency)}
        valueClassName="text-emerald-500"
      />
      <MetricCard
        label="Wallet"
        value={fmt(walletBalance, currency)}
        valueClassName="text-blue-500"
      />
      <MetricCard
        label="Savings"
        value={fmt(savings, currency)}
        valueClassName="text-violet-500"
      />
      <MetricCard
        label="Net Worth"
        value={fmt(netWorth, currency)}
        valueClassName="text-amber-500"
      />
    </div>
  );
}
