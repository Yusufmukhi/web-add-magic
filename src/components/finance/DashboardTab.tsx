import { Button } from "@/components/ui/button";
import { Download, TrendingUp } from "lucide-react";
import { useFinance } from "@/hooks/useFinance";
import { Progress } from "@/components/ui/progress";
import { exportFinanceExcel } from "@/utils/financeExcel";
import { toast } from "sonner";

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface DashboardTabProps {
  livePortfolioValue: number;
}

export function DashboardTab({ livePortfolioValue }: DashboardTabProps) {
  const {
    totalMonthlyIncome,
    totalSavings,
    totalExpenses,
    freeCash,
    walletBalance,
    netWorth,
    incomeEntries,
    savingsDeposits,
    expenses,
    settings,
  } = useFinance();

  const goals = settings.savingsGoals;

  // Pie-style breakdown: income slices
  const totalForChart =
    totalSavings + totalExpenses + walletBalance + freeCash || 1;
  const slices = [
    {
      label: "Income",
      value: totalMonthlyIncome,
      color: "bg-emerald-500",
    },
    { label: "Savings", value: totalSavings, color: "bg-violet-500" },
    { label: "Expenses", value: totalExpenses, color: "bg-red-500" },
    { label: "Free Cash", value: freeCash, color: "bg-blue-500" },
  ];

  // Expense breakdown this month by category
  const now = new Date();
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });

  const categoryTotals: Record<string, number> = {};
  thisMonthExpenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  async function handleExport() {
    try {
      await exportFinanceExcel({
        incomeEntries,
        savingsDeposits,
        savingsGoals: settings.savingsGoals,
        expenses,
      });
      toast.success("Finance report exported!");
    } catch (e) {
      toast.error("Export failed");
      console.error(e);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Overview</h2>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> Export to Excel
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Total Income"
          value={fmt(totalMonthlyIncome)}
          color="text-emerald-500"
        />
        <SummaryCard
          label="Total Savings"
          value={fmt(totalSavings)}
          color="text-violet-500"
        />
        <SummaryCard
          label="Total Expenses"
          value={fmt(totalExpenses)}
          color="text-red-500"
        />
        <SummaryCard
          label="Free Cash"
          value={fmt(freeCash)}
          color="text-blue-500"
        />
        <SummaryCard
          label="Wallet Balance"
          value={fmt(walletBalance)}
          color="text-amber-500"
        />
        {/* Portfolio Value — live from Dalal Street */}
        <div className="rounded-xl bg-card border border-border p-4 flex flex-col gap-1 relative overflow-hidden">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Portfolio Value
            </p>
          </div>
          <p className="text-lg font-bold text-cyan-400">
            {fmt(livePortfolioValue)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Live from Dalal Street portfolio
          </p>
        </div>
      </div>

      {/* Net Worth */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Net Worth
        </p>
        <p className="text-2xl font-bold text-amber-400 mt-1">{fmt(netWorth)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Free Cash + Wallet + Savings + Portfolio
        </p>
      </div>

      {/* Bar-style breakdown */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">
          Income vs Savings vs Expenses vs Free Cash
        </p>
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{s.label}</span>
                <span>{fmt(s.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.color}`}
                  style={{
                    width: `${Math.min(100, (s.value / totalForChart) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
      </div>

      {/* Expense breakdown this month */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">
          Expense Breakdown (This Month)
        </p>
        {topCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No spends this month</p>
        ) : (
          topCategories.map(([cat, total]) => {
            const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground capitalize">
                  <span>{cat}</span>
                  <span>
                    {fmt(total)} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })
        )}
      </div>

      {/* Savings goals progress */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">
          Savings Goals Progress
        </p>
        {goals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Set savings goals in Settings to track progress.
          </p>
        ) : (
          goals.map((g) => {
            const pct = g.targetAmount
              ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
              : 0;
            return (
              <div key={g.id} className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{g.name}</span>
                  <span>
                    {fmt(g.currentAmount)} / {fmt(g.targetAmount)}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-lg font-bold ${color ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
