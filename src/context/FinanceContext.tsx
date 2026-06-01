import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type {
  ExpenseEntry,
  FinanceContextValue,
  FinanceSettings,
  FinanceState,
  IncomeEntry,
  SavingsDeposit,
  SavingsGoal,
  WalletAllocation,
} from "@/types/finance.types";

// ─── localStorage keys (prefixed to avoid collision with Dalal Street) ───────
const LS_INCOME = "finance_income";
const LS_SAVINGS_DEPOSITS = "finance_savings_deposits";
const LS_EXPENSES = "finance_expenses";
const LS_SETTINGS = "finance_settings";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage quota exceeded – swallow silently
  }
}

// ─── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: FinanceSettings = {
  currency: "₹",
  monthlyIncomeBudget: 0,
  walletAllocations: [
    { id: "w1", label: "Needs", amount: 0, color: "#6366f1" },
    { id: "w2", label: "Wants", amount: 0, color: "#f59e0b" },
    { id: "w3", label: "Misc", amount: 0, color: "#10b981" },
  ],
  savingsGoals: [],
};

// ─── Context creation ────────────────────────────────────────────────────────

export const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  // Persisted state
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>(() =>
    load<IncomeEntry[]>(LS_INCOME, [])
  );
  const [savingsDeposits, setSavingsDeposits] = useState<SavingsDeposit[]>(
    () => load<SavingsDeposit[]>(LS_SAVINGS_DEPOSITS, [])
  );
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(() =>
    load<ExpenseEntry[]>(LS_EXPENSES, [])
  );
  const [settings, setSettings] = useState<FinanceSettings>(() =>
    load<FinanceSettings>(LS_SETTINGS, DEFAULT_SETTINGS)
  );

  // Live value injected from Dalal Street – not persisted
  const [livePortfolioValue, setLivePortfolioValue] = useState(0);

  // Persist on change
  useEffect(() => save(LS_INCOME, incomeEntries), [incomeEntries]);
  useEffect(
    () => save(LS_SAVINGS_DEPOSITS, savingsDeposits),
    [savingsDeposits]
  );
  useEffect(() => save(LS_EXPENSES, expenses), [expenses]);
  useEffect(() => save(LS_SETTINGS, settings), [settings]);

  // ─── Income actions ──────────────────────────────────────────────────────

  const addIncome = useCallback((entry: Omit<IncomeEntry, "id">) => {
    setIncomeEntries((prev) => [...prev, { ...entry, id: uid() }]);
  }, []);

  const updateIncome = useCallback(
    (id: string, entry: Partial<IncomeEntry>) => {
      setIncomeEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...entry } : e))
      );
    },
    []
  );

  const deleteIncome = useCallback((id: string) => {
    setIncomeEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ─── Savings actions ─────────────────────────────────────────────────────

  const addSavingsDeposit = useCallback(
    (deposit: Omit<SavingsDeposit, "id">) => {
      const newDeposit = { ...deposit, id: uid() };
      setSavingsDeposits((prev) => [...prev, newDeposit]);
      // Update goal currentAmount
      setSettings((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map((g) =>
          g.id === deposit.goalId
            ? { ...g, currentAmount: g.currentAmount + deposit.amount }
            : g
        ),
      }));
    },
    []
  );

  const deleteSavingsDeposit = useCallback((id: string) => {
    setSavingsDeposits((prev) => {
      const deposit = prev.find((d) => d.id === id);
      if (deposit) {
        setSettings((s) => ({
          ...s,
          savingsGoals: s.savingsGoals.map((g) =>
            g.id === deposit.goalId
              ? {
                  ...g,
                  currentAmount: Math.max(0, g.currentAmount - deposit.amount),
                }
              : g
          ),
        }));
      }
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  // ─── Expense actions ──────────────────────────────────────────────────────

  const addExpense = useCallback((entry: Omit<ExpenseEntry, "id">) => {
    setExpenses((prev) => [...prev, { ...entry, id: uid() }]);
  }, []);

  const updateExpense = useCallback(
    (id: string, entry: Partial<ExpenseEntry>) => {
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...entry } : e))
      );
    },
    []
  );

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ─── Settings actions ─────────────────────────────────────────────────────

  const updateSettings = useCallback((patch: Partial<FinanceSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const addSavingsGoal = useCallback((goal: Omit<SavingsGoal, "id">) => {
    setSettings((prev) => ({
      ...prev,
      savingsGoals: [...prev.savingsGoals, { ...goal, id: uid() }],
    }));
  }, []);

  const updateSavingsGoal = useCallback(
    (id: string, goal: Partial<SavingsGoal>) => {
      setSettings((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map((g) =>
          g.id === id ? { ...g, ...goal } : g
        ),
      }));
    },
    []
  );

  const deleteSavingsGoal = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.filter((g) => g.id !== id),
    }));
  }, []);

  const addWalletAllocation = useCallback(
    (allocation: Omit<WalletAllocation, "id">) => {
      setSettings((prev) => ({
        ...prev,
        walletAllocations: [
          ...prev.walletAllocations,
          { ...allocation, id: uid() },
        ],
      }));
    },
    []
  );

  const updateWalletAllocation = useCallback(
    (id: string, allocation: Partial<WalletAllocation>) => {
      setSettings((prev) => ({
        ...prev,
        walletAllocations: prev.walletAllocations.map((a) =>
          a.id === id ? { ...a, ...allocation } : a
        ),
      }));
    },
    []
  );

  const deleteWalletAllocation = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      walletAllocations: prev.walletAllocations.filter((a) => a.id !== id),
    }));
  }, []);

  // ─── Derived values ───────────────────────────────────────────────────────

  const totalMonthlyIncome = useMemo(() => {
    return incomeEntries.reduce((sum, e) => {
      if (e.frequency === "monthly") return sum + e.amount;
      if (e.frequency === "quarterly") return sum + e.amount / 3;
      if (e.frequency === "yearly") return sum + e.amount / 12;
      return sum; // one-time not included in monthly
    }, 0);
  }, [incomeEntries]);

  const totalSavings = useMemo(() => {
    return settings.savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  }, [settings.savingsGoals]);

  const totalExpenses = useMemo(() => {
    // Sum expenses for the current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return expenses
      .filter((e) => {
        const d = new Date(e.date);
        return (
          d.getMonth() === currentMonth && d.getFullYear() === currentYear
        );
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const walletBalance = useMemo(() => {
    return settings.walletAllocations.reduce((sum, a) => sum + a.amount, 0);
  }, [settings.walletAllocations]);

  const freeCash = useMemo(() => {
    return Math.max(
      0,
      totalMonthlyIncome - totalSavings - walletBalance - totalExpenses
    );
  }, [totalMonthlyIncome, totalSavings, walletBalance, totalExpenses]);

  const netWorth = useMemo(() => {
    return freeCash + walletBalance + totalSavings + livePortfolioValue;
  }, [freeCash, walletBalance, totalSavings, livePortfolioValue]);

  // ─── Context value ────────────────────────────────────────────────────────

  const value: FinanceContextValue = {
    incomeEntries,
    savingsDeposits,
    expenses,
    settings,
    livePortfolioValue,
    addIncome,
    updateIncome,
    deleteIncome,
    addSavingsDeposit,
    deleteSavingsDeposit,
    addExpense,
    updateExpense,
    deleteExpense,
    updateSettings,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    addWalletAllocation,
    updateWalletAllocation,
    deleteWalletAllocation,
    totalMonthlyIncome,
    totalSavings,
    totalExpenses,
    freeCash,
    walletBalance,
    netWorth,
    setLivePortfolioValue,
  };

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}
