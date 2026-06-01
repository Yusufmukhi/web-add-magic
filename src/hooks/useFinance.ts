import { useContext, useMemo, useCallback } from "react";
import { FinanceContext } from "@/context/FinanceContext";
import type { FinanceContextValue } from "@/types/finance.types";

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error("useFinance must be used inside <FinanceProvider>");
  }
  return ctx;
}

// ─── Adapter hook for FinancePanel (legacy API) ───────────────────────────────
// FinancePanel was written against an older shape:
//   state.incomes / state.expenses / state.savings / state.settings.goals
//   state.settings.allocation.{ spendingPct, savingsPct, monthlySpendLimit }
// This adapter maps the current FinanceContext onto that shape.

export function useFinanceState() {
  const ctx = useFinance();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyIncome = useMemo(() => {
    return ctx.incomeEntries
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((a, e) => a + e.amount, 0);
  }, [ctx.incomeEntries, currentMonth, currentYear]);

  const monthlyExpenses = useMemo(() => ctx.totalExpenses, [ctx.totalExpenses]);

  const monthlySavings = useMemo(() => {
    return ctx.savingsDeposits
      .filter((d) => {
        const dt = new Date(d.date);
        return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
      })
      .reduce((a, d) => a + d.amount, 0);
  }, [ctx.savingsDeposits, currentMonth, currentYear]);

  // Legacy state shape
  const state = useMemo(() => ({
    incomes: ctx.incomeEntries.map((e) => ({
      id: e.id,
      amount: e.amount,
      source: e.source,
      date: e.date,
      note: e.notes,
    })),
    expenses: ctx.expenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      category: e.category,
      date: e.date,
      wallet: "spending" as const,
      note: e.notes,
    })),
    savings: ctx.savingsDeposits.map((d) => ({
      id: d.id,
      amount: d.amount,
      date: d.date,
      goalId: d.goalId,
      note: d.notes,
    })),
    settings: {
      allocation: {
        spendingPct: ctx.settings.walletAllocations.length > 0
          ? Math.round(
              (ctx.settings.walletAllocations.reduce((a, w) => a + w.amount, 0) /
                Math.max(ctx.totalMonthlyIncome, 1)) * 100
            )
          : 50,
        savingsPct: ctx.totalMonthlyIncome > 0
          ? Math.round((ctx.totalSavings / Math.max(ctx.totalMonthlyIncome, 1)) * 100)
          : 20,
        monthlySpendLimit: ctx.settings.monthlyIncomeBudget,
      },
      goals: ctx.settings.savingsGoals.map((g) => ({
        id: g.id,
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        deadline: g.targetDate,
        color: "#6366f1",
      })),
    },
  }), [ctx]);

  // Legacy action adapters
  const addIncome = useCallback(
    (amount: number, source: string, date: string, note?: string) => {
      ctx.addIncome({ source, amount, frequency: "one-time", date, notes: note });
    },
    [ctx]
  );

  const removeIncome = useCallback(
    (id: string) => ctx.deleteIncome(id),
    [ctx]
  );

  const addExpense = useCallback(
    (amount: number, category: string, date: string, _wallet: string, note?: string) => {
      ctx.addExpense({
        description: category,
        amount,
        category: category as any,
        paymentMode: "upi",
        date,
        notes: note,
      });
    },
    [ctx]
  );

  const removeExpense = useCallback(
    (id: string) => ctx.deleteExpense(id),
    [ctx]
  );

  const addSavings = useCallback(
    (amount: number, date: string, goalId?: string, note?: string) => {
      const gid = goalId || ctx.settings.savingsGoals[0]?.id;
      if (!gid) return;
      ctx.addSavingsDeposit({ goalId: gid, amount, date, notes: note });
    },
    [ctx]
  );

  const removeSavings = useCallback(
    (id: string) => ctx.deleteSavingsDeposit(id),
    [ctx]
  );

  const addGoal = useCallback(
    (name: string, target: number, deadline?: string, _color?: string) => {
      ctx.addSavingsGoal({
        name,
        targetAmount: target,
        currentAmount: 0,
        category: "custom",
        targetDate: deadline,
      });
    },
    [ctx]
  );

  const removeGoal = useCallback(
    (id: string) => ctx.deleteSavingsGoal(id),
    [ctx]
  );

  const updateAllocation = useCallback(
    (patch: { spendingPct?: number; savingsPct?: number; monthlySpendLimit?: number }) => {
      ctx.updateSettings({
        monthlyIncomeBudget: patch.monthlySpendLimit ?? ctx.settings.monthlyIncomeBudget,
      });
    },
    [ctx]
  );

  return {
    state,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    totalIncome: ctx.incomeEntries.reduce((a, e) => a + e.amount, 0),
    totalExpenses: ctx.expenses.reduce((a, e) => a + e.amount, 0),
    totalSaved: ctx.totalSavings,
    freeCash: ctx.freeCash,
    walletBalance: ctx.walletBalance,
    savingsBalance: ctx.totalSavings,
    addIncome,
    removeIncome,
    addExpense,
    removeExpense,
    addSavings,
    removeSavings,
    addGoal,
    removeGoal,
    updateAllocation,
  };
}
