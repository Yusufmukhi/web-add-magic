import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type {
  FinanceState,
  IncomeEntry,
  ExpenseEntry,
  SavingsEntry,
  SavingsGoal,
  WalletAllocation,
} from "@/types/finance.types";

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_STATE: FinanceState = {
  incomes: [],
  expenses: [],
  savings: [],
  settings: {
    allocation: {
      spendingPct: 50,
      savingsPct: 20,
      monthlySpendLimit: 0,
    },
    goals: [],
  },
};

export function useFinanceState() {
  const [state, setState] = useLocalStorage<FinanceState>("pocketwise_finance", DEFAULT_STATE);

  // ─── Income ──────────────────────────────────────────────────────────────
  const addIncome = useCallback(
    (amount: number, source: string, date: string, note?: string) => {
      const entry: IncomeEntry = { id: newId(), date, amount, source, note };
      setState((s) => ({ ...s, incomes: [entry, ...s.incomes] }));
    },
    [setState]
  );

  const removeIncome = useCallback(
    (id: string) => setState((s) => ({ ...s, incomes: s.incomes.filter((e) => e.id !== id) })),
    [setState]
  );

  // ─── Expenses ────────────────────────────────────────────────────────────
  const addExpense = useCallback(
    (amount: number, category: string, date: string, wallet: "spending" | "free", note?: string) => {
      const entry: ExpenseEntry = { id: newId(), date, amount, category, note, wallet };
      setState((s) => ({ ...s, expenses: [entry, ...s.expenses] }));
    },
    [setState]
  );

  const removeExpense = useCallback(
    (id: string) => setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) })),
    [setState]
  );

  // ─── Savings ─────────────────────────────────────────────────────────────
  const addSavings = useCallback(
    (amount: number, date: string, goalId?: string, note?: string) => {
      const entry: SavingsEntry = { id: newId(), date, amount, goalId, note };
      setState((s) => {
        const newSavings = [entry, ...s.savings];
        // Update goal saved amount if goalId provided
        const newGoals = s.settings.goals.map((g) =>
          g.id === goalId ? { ...g, saved: g.saved + amount } : g
        );
        return {
          ...s,
          savings: newSavings,
          settings: { ...s.settings, goals: newGoals },
        };
      });
    },
    [setState]
  );

  const removeSavings = useCallback(
    (id: string) => {
      setState((s) => {
        const entry = s.savings.find((e) => e.id === id);
        const newSavings = s.savings.filter((e) => e.id !== id);
        const newGoals = s.settings.goals.map((g) =>
          g.id === entry?.goalId ? { ...g, saved: Math.max(0, g.saved - (entry?.amount ?? 0)) } : g
        );
        return { ...s, savings: newSavings, settings: { ...s.settings, goals: newGoals } };
      });
    },
    [setState]
  );

  // ─── Goals ───────────────────────────────────────────────────────────────
  const addGoal = useCallback(
    (name: string, target: number, deadline?: string, color?: string) => {
      const goal: SavingsGoal = {
        id: newId(),
        name,
        target,
        saved: 0,
        deadline,
        color: color ?? "#6366f1",
      };
      setState((s) => ({
        ...s,
        settings: { ...s.settings, goals: [...s.settings.goals, goal] },
      }));
    },
    [setState]
  );

  const removeGoal = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          goals: s.settings.goals.filter((g) => g.id !== id),
        },
      })),
    [setState]
  );

  // ─── Allocation settings ─────────────────────────────────────────────────
  const updateAllocation = useCallback(
    (patch: Partial<WalletAllocation>) =>
      setState((s) => ({
        ...s,
        settings: {
          ...s.settings,
          allocation: { ...s.settings.allocation, ...patch },
        },
      })),
    [setState]
  );

  // ─── Derived helpers ─────────────────────────────────────────────────────
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const monthlyIncome = state.incomes
    .filter((i) => i.date.startsWith(currentMonth))
    .reduce((a, i) => a + i.amount, 0);

  const monthlyExpenses = state.expenses
    .filter((e) => e.date.startsWith(currentMonth))
    .reduce((a, e) => a + e.amount, 0);

  const monthlySavings = state.savings
    .filter((s) => s.date.startsWith(currentMonth))
    .reduce((a, s) => a + s.amount, 0);

  const totalIncome = state.incomes.reduce((a, i) => a + i.amount, 0);
  const totalExpenses = state.expenses.reduce((a, e) => a + e.amount, 0);
  const totalSaved = state.savings.reduce((a, s) => a + s.amount, 0);

  const freeCash = totalIncome - totalExpenses - totalSaved;
  const walletBalance =
    monthlyIncome * (state.settings.allocation.spendingPct / 100) - monthlyExpenses;
  const savingsBalance =
    monthlyIncome * (state.settings.allocation.savingsPct / 100) - monthlySavings;

  return {
    state,
    // actions
    addIncome,
    removeIncome,
    addExpense,
    removeExpense,
    addSavings,
    removeSavings,
    addGoal,
    removeGoal,
    updateAllocation,
    // derived
    currentMonth,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    totalIncome,
    totalExpenses,
    totalSaved,
    freeCash,
    walletBalance,
    savingsBalance,
  };
}
