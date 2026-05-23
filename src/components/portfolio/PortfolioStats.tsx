import { StatCard } from "@/components/detail/StatCard";
import { formatINR, formatNumber } from "@/utils/formatters";

interface Props {
  invested: number;
  current: number;
  realized: number;
  cashBalance: number;
  /** CAGR as percentage (e.g. 12.5 means 12.5%). null when not computable. */
  cagr: number | null;
  /** Years over which CAGR was measured. */
  cagrYears: number | null;
  /** Net deposits (DEPOSIT − WITHDRAW). Used for absolute Profit metric. */
  totalDeposits: number;
}

export function PortfolioStats({ invested, current, realized, cashBalance, cagr, cagrYears, totalDeposits }: Props) {
  const unrealized = current - invested;
  const unrealizedPct = invested > 0 ? (unrealized / invested) * 100 : 0;
  const totalPL = unrealized + realized;
  const totalNetWorth = current + cashBalance;
  const totalReturnPct = invested > 0 ? (totalPL / invested) * 100 : 0;
  // Deposit-based profit: how much your invested money has grown vs cash put in.
  const profitValue = current + realized - totalDeposits;
  const profitPct = totalDeposits > 0 ? (profitValue / totalDeposits) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Row 1 — Portfolio value & cash */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total Net Worth" value={formatINR(totalNetWorth)} hint="Stocks + Cash" />
        <StatCard label="Current Value" value={formatINR(current)} hint="Holdings at CMP" />
        <StatCard label="Cash Balance" value={formatINR(cashBalance)} hint="Available to invest" />
      </div>

      {/* Row 2 — P&L breakdown + CAGR */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Invested" value={formatINR(invested)} hint="Total cost basis" />
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
        <StatCard
          label="CAGR"
          value={cagr == null ? "—" : `${formatNumber(cagr, 2)}%`}
          tone={cagr == null ? undefined : cagr >= 0 ? "gain" : "loss"}
          hint={cagrYears ? `Over ${cagrYears.toFixed(2)} yrs` : "Annualized return"}
        />
      </div>

      {/* Row 3 — Deposit-based profit */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Total Deposits"
          value={formatINR(totalDeposits)}
          hint="Net funds added (Deposits − Withdrawals)"
        />
        <StatCard
          label="Profit Value"
          value={formatINR(profitValue)}
          tone={profitValue >= 0 ? "gain" : "loss"}
          hint="Current + Realized − Deposits"
        />
        <StatCard
          label="% Profit"
          value={totalDeposits > 0 ? `${formatNumber(profitPct, 2)}%` : "—"}
          tone={totalDeposits > 0 ? (profitValue >= 0 ? "gain" : "loss") : undefined}
          hint="Return on money deposited"
        />
      </div>
    </div>
  );
}

