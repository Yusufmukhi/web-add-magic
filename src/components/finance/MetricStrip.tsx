import { useFinance } from "@/context/FinanceContext";
import { formatINR } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

export function MetricStrip() {
  const { totals, threshold } = useFinance();
  const low = threshold > 0 && totals.freeCash < threshold;

  const items = [
    {
      label: "Free Cash",
      value: totals.freeCash,
      cls: low ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
    },
    { label: "Wallet", value: totals.walletBalance, cls: "text-foreground" },
    { label: "Savings", value: totals.savings, cls: "text-foreground" },
    { label: "Net Worth", value: totals.netWorth, cls: "text-foreground" },
  ];

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:text-sm">
        {items.map((i) => (
          <div key={i.label} className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
            <span className="text-muted-foreground">{i.label}</span>
            <span className={cn("font-semibold tabular-nums", i.cls)}>
              {formatINR(i.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
