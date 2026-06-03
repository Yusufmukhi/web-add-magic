import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinanceProvider, useFinance } from "@/context/FinanceContext";
import { MetricStrip } from "@/components/finance/MetricStrip";
import { DashboardTab } from "@/components/finance/DashboardTab";
import { IncomeTab } from "@/components/finance/IncomeTab";
import { SavingsTab } from "@/components/finance/SavingsTab";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { SettingsTab } from "@/components/finance/SettingsTab";
import { Toaster } from "@/components/ui/sonner";
import { formatINR } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Personal Finance Tracker" },
      {
        name: "description",
        content:
          "Track income, savings, wallet allocations and expenses with an Indian-rupee finance dashboard.",
      },
    ],
  }),
  component: FinanceTrackerPage,
});

function TabDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1 inline-block size-1.5 rounded-full bg-destructive" aria-hidden />
  );
}

function FinancePageInner() {
  const finance = useFinance();
  const [tab, setTab] = useState("dashboard");

  const { hasExpenseAlert, hasSettingsAlert } = useMemo(() => {
    let over = false;
    for (const cat of finance.expenseCategories) {
      const limit = finance.limits[cat] ?? 0;
      const spent = finance.monthlySpendByCategory[cat] ?? 0;
      if (limit > 0 && spent / limit > 1) {
        over = true;
        break;
      }
    }
    return { hasExpenseAlert: over, hasSettingsAlert: over };
  }, [finance.expenseCategories, finance.limits, finance.monthlySpendByCategory]);

  const lowFreeCash =
    finance.threshold > 0 && finance.totals.freeCash < finance.threshold;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Personal Finance Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Manage your money across income, savings, and spending wallets.
        </p>
      </header>

      <MetricStrip />

      {lowFreeCash && (
        <div
          className={cn(
            "mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive",
          )}
        >
          ⚠️ Free Cash is low: {formatINR(finance.totals.freeCash)} remaining
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
          <TabsTrigger value="expenses">
            Expenses <TabDot show={hasExpenseAlert} />
          </TabsTrigger>
          <TabsTrigger value="settings">
            Settings <TabDot show={hasSettingsAlert} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="income">
          <IncomeTab />
        </TabsContent>
        <TabsContent value="savings">
          <SavingsTab />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinanceTrackerPage() {
  return (
    <FinanceProvider>
      <FinancePageInner />
      <Toaster richColors position="top-center" />
    </FinanceProvider>
  );
}
