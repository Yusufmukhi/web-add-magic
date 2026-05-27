import { formatINR, formatNumber } from "@/utils/formatters";

interface Props {
  invested: number;
  current: number;
  cashBalance: number;
  cagr: number | null;
}

export function PortfolioMetricStrip({ invested, current, cashBalance, cagr }: Props) {
  const unrealized = current - invested;
  const unrealizedPct = invested > 0 ? (unrealized / invested) * 100 : 0;
  const gainClass = unrealized >= 0 ? "text-gain" : "text-loss";

  const metrics = [
    { label: "Invested", value: formatINR(invested), tone: "" },
    { label: "Current", value: formatINR(current), tone: "" },
    {
      label: "P&L",
      value: `${formatINR(unrealized)} (${formatNumber(unrealizedPct, 2)}%)`,
      tone: gainClass,
    },
    { label: "Cash", value: formatINR(cashBalance), tone: "" },
    {
      label: "CAGR",
      value: cagr == null ? "—" : `${formatNumber(cagr, 2)}%`,
      tone: cagr == null ? "" : cagr >= 0 ? "text-gain" : "text-loss",
    },
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
      {metrics.map(({ label, value, tone }) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className={`font-mono text-sm font-semibold ${tone || "text-foreground"}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}
