import { StatCard } from "@/components/detail/StatCard";
import { formatINR, formatNumber } from "@/utils/formatters";

interface Props {
  invested: number;
  current: number;
  realized: number;
  cashBalance: number;
}

export function PortfolioStats({ invested, current, realized, cashBalance }: Props) {
  const unrealized = current - invested;
  const unrealizedPct = invested > 0 ? (unrealized / invested) * 100 : 0;
  const totalPL = unrealized + realized;
  const totalNetWorth = current + cashBalance;
  const totalReturnPct = invested > 0 ? (totalPL / invested) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Row 1 — Portfolio value & cash */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Total Net Worth"
          value={formatINR(totalNetWorth)}
          hint="Stocks + Cash"
        />
        <StatCard
          label="Current Value"
          value={formatINR(current)}
          hint="Holdings at CMP"
        />
        <StatCard
          label="Cash Balance"
          value={formatINR(cashBalance)}
          hint="Available to invest"
        />
      </div>

      {/* Row 2 — P&L breakdown */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Invested"
          value={formatINR(invested)}
          hint="Total cost basis"
        />
        <StatCard
          label="Unrealized P&L"
          value={`${formatINR(unrealized)} (${formatNumber(unrealizedPct, 2)}%)`}
          tone={unrealized >= 0 ? "gain" : "loss"}
          hint="Open positions"
        />
        <StatCard
          label="Realized P&L"
          value={formatINR(realized)}
          tone={realized >= 0 ? "gain" : "loss"}
          hint="From closed trades"
        />
        <StatCard
          label="Total P&L"
          value={`${formatINR(totalPL)} (${formatNumber(totalReturnPct, 2)}%)`}
          tone={totalPL >= 0 ? "gain" : "loss"}
          hint="Unrealized + Realized"
        />
      </div>
    </div>
  );
}
