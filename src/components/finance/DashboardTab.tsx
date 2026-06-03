import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useFinance } from "@/context/FinanceContext";
import { formatINR } from "@/lib/finance/format";
import { exportFinanceExcel } from "@/lib/finance/excel";
import { cn } from "@/lib/utils";

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#0ea5e9",
];

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={cn("text-xl font-semibold tabular-nums sm:text-2xl", accent)}>
          {formatINR(value)}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardTab() {
  const finance = useFinance();
  const { totals } = finance;
  const [portfolioInput, setPortfolioInput] = useState(String(finance.portfolioValue || ""));

  const barData = [
    { name: "Income", value: totals.income },
    { name: "Savings", value: totals.savings },
    { name: "Expenses", value: totals.spends },
    { name: "Free Cash", value: Math.max(0, totals.freeCash) },
  ];

  const pieData = Object.entries(finance.monthlySpendByCategory)
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0);

  // Alerts
  const limitAlerts: { cat: string; pct: number; level: "over" | "near" | "warn" }[] = [];
  for (const cat of finance.expenseCategories) {
    const limit = finance.limits[cat] ?? 0;
    const spent = finance.monthlySpendByCategory[cat] ?? 0;
    if (limit <= 0) continue;
    const pct = (spent / limit) * 100;
    if (pct > 100) limitAlerts.push({ cat, pct, level: "over" });
    else if (pct >= 90) limitAlerts.push({ cat, pct, level: "near" });
    else if (pct >= 70) limitAlerts.push({ cat, pct, level: "warn" });
  }

  const handleExport = () => {
    try {
      exportFinanceExcel({
        income: finance.income,
        savings: finance.savings,
        wallet: finance.wallet,
        spends: finance.spends,
        limits: finance.limits,
        monthlySpendByCategory: finance.monthlySpendByCategory,
        expenseCategories: finance.expenseCategories,
        portfolioValue: finance.portfolioValue,
        totals: finance.totals,
      });
      toast.success("Excel exported");
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Overview</h2>
        <Button onClick={handleExport} size="sm">
          <Download className="mr-2 size-4" /> Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Total Income"
          value={totals.income}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Total Savings"
          value={totals.savings}
          accent="text-sky-600 dark:text-sky-400"
        />
        <StatCard
          label="Total Expenses"
          value={totals.spends}
          accent="text-rose-600 dark:text-rose-400"
        />
        <StatCard
          label="Free Cash"
          value={totals.freeCash}
          accent={
            finance.threshold > 0 && totals.freeCash < finance.threshold
              ? "text-destructive"
              : "text-emerald-600 dark:text-emerald-400"
          }
        />
        <StatCard label="Wallet Balance" value={totals.walletBalance} />
        <Card>
          <CardContent className="space-y-1 py-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Portfolio Value
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">₹</span>
              <Input
                type="number"
                min="0"
                step="any"
                value={portfolioInput}
                onChange={(e) => {
                  setPortfolioInput(e.target.value);
                  finance.setPortfolioValue(Number(e.target.value) || 0);
                }}
                className="h-8 border-0 p-0 text-xl font-semibold tabular-nums shadow-none focus-visible:ring-0"
              />
            </div>
          </CardContent>
        </Card>
        <StatCard
          label="Net Worth"
          value={totals.netWorth}
          accent="text-primary"
        />
      </div>

      {(limitAlerts.length > 0 ||
        (finance.threshold > 0 && totals.freeCash < finance.threshold)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {finance.threshold > 0 && totals.freeCash < finance.threshold && (
              <Badge variant="destructive">
                Free Cash low: {formatINR(totals.freeCash)}
              </Badge>
            )}
            {limitAlerts.map((a) => (
              <Badge
                key={a.cat}
                variant={a.level === "over" ? "destructive" : "outline"}
                className={cn(
                  a.level === "near" &&
                    "border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-300",
                  a.level === "warn" &&
                    "border-yellow-500/30 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
                )}
              >
                {a.cat}: {a.pct.toFixed(0)}%
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income vs Savings vs Expenses vs Free Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    tickFormatter={(v) => formatINR(v as number, false)}
                  />
                  <Tooltip
                    formatter={(v) => formatINR(v as number)}
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {pieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No spends this month
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatINR(v as number)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Savings Goals Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {finance.savingsCategories.filter((c) => (finance.goals[c] ?? 0) > 0).length ===
          0 ? (
            <p className="text-sm text-muted-foreground">
              Set savings goals in Settings to track progress.
            </p>
          ) : (
            finance.savingsCategories
              .filter((c) => (finance.goals[c] ?? 0) > 0)
              .map((cat) => {
                const target = finance.goals[cat];
                const saved = finance.savedByCategory[cat] ?? 0;
                const pct = Math.min(100, (saved / target) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{cat}</span>
                      <span className="text-muted-foreground">
                        {formatINR(saved)} / {formatINR(target)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
