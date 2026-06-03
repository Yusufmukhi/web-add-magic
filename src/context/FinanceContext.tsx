import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_SAVINGS_CATEGORIES,
  type Goals,
  type IncomeEntry,
  type Limits,
  type SavingsEntry,
  type SpendEntry,
  type WalletAllocation,
} from "@/lib/finance/types";
import { isSameMonth, uid } from "@/lib/finance/format";

const KEYS = {
  income: "finance_income",
  savings: "finance_savings",
  wallet: "finance_expenses_wallet",
  spends: "finance_expenses_spends",
  catIncome: "finance_categories_income",
  catSavings: "finance_categories_savings",
  catExpenses: "finance_categories_expenses",
  limits: "finance_limits",
  goals: "finance_goals",
  portfolio: "finance_portfolio_value",
  threshold: "finance_freecash_threshold",
} as const;

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type Result = { ok: true } | { ok: false; error: string };

type Ctx = {
  income: IncomeEntry[];
  savings: SavingsEntry[];
  wallet: WalletAllocation[];
  spends: SpendEntry[];
  incomeCategories: string[];
  savingsCategories: string[];
  expenseCategories: string[];
  limits: Limits;
  goals: Goals;
  portfolioValue: number;
  threshold: number;

  totals: {
    income: number;
    savings: number;
    spends: number;
    allocated: number;
    walletBalance: number;
    freeCash: number;
    netWorth: number;
  };

  walletRemaining: (walletId: string) => number;
  monthlySpendByCategory: Record<string, number>;
  savedByCategory: Record<string, number>;

  addIncome: (e: Omit<IncomeEntry, "id">) => Result;
  deleteIncome: (id: string) => void;

  addSavings: (e: Omit<SavingsEntry, "id">) => Result;
  deleteSavings: (id: string) => void;

  addWallet: (e: Omit<WalletAllocation, "id">) => Result;
  deleteWallet: (id: string) => void;

  addSpend: (e: Omit<SpendEntry, "id">) => Result;
  deleteSpend: (id: string) => void;

  addCategory: (kind: "income" | "savings" | "expense", name: string) => Result;

  setLimit: (cat: string, n: number) => void;
  setGoal: (cat: string, n: number) => void;
  setPortfolioValue: (n: number) => void;
  setThreshold: (n: number) => void;

  resetAll: () => void;
};

const FinanceCtx = createContext<Ctx | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [income, setIncome] = useState<IncomeEntry[]>(() => load(KEYS.income, []));
  const [savings, setSavings] = useState<SavingsEntry[]>(() => load(KEYS.savings, []));
  const [wallet, setWallet] = useState<WalletAllocation[]>(() => load(KEYS.wallet, []));
  const [spends, setSpends] = useState<SpendEntry[]>(() => load(KEYS.spends, []));
  const [incomeCategories, setIncomeCategories] = useState<string[]>(() =>
    load(KEYS.catIncome, DEFAULT_INCOME_CATEGORIES),
  );
  const [savingsCategories, setSavingsCategories] = useState<string[]>(() =>
    load(KEYS.catSavings, DEFAULT_SAVINGS_CATEGORIES),
  );
  const [expenseCategories, setExpenseCategories] = useState<string[]>(() =>
    load(KEYS.catExpenses, DEFAULT_EXPENSE_CATEGORIES),
  );
  const [limits, setLimits] = useState<Limits>(() => load(KEYS.limits, {}));
  const [goals, setGoals] = useState<Goals>(() => load(KEYS.goals, {}));
  const [portfolioValue, setPortfolioValueState] = useState<number>(() =>
    load(KEYS.portfolio, 0),
  );
  const [threshold, setThresholdState] = useState<number>(() => load(KEYS.threshold, 0));

  useEffect(() => save(KEYS.income, income), [income]);
  useEffect(() => save(KEYS.savings, savings), [savings]);
  useEffect(() => save(KEYS.wallet, wallet), [wallet]);
  useEffect(() => save(KEYS.spends, spends), [spends]);
  useEffect(() => save(KEYS.catIncome, incomeCategories), [incomeCategories]);
  useEffect(() => save(KEYS.catSavings, savingsCategories), [savingsCategories]);
  useEffect(() => save(KEYS.catExpenses, expenseCategories), [expenseCategories]);
  useEffect(() => save(KEYS.limits, limits), [limits]);
  useEffect(() => save(KEYS.goals, goals), [goals]);
  useEffect(() => save(KEYS.portfolio, portfolioValue), [portfolioValue]);
  useEffect(() => save(KEYS.threshold, threshold), [threshold]);

  const totals = useMemo(() => {
    const totalIncome = income.reduce((s, e) => s + e.amount, 0);
    const totalSavings = savings.reduce((s, e) => s + e.amount, 0);
    const newCashSavings = savings
      .filter((s) => s.source === "new")
      .reduce((s, e) => s + e.amount, 0);
    const allocFromFreeCashSavings = savings
      .filter((s) => s.source === "allocate")
      .reduce((s, e) => s + e.amount, 0);
    const totalAllocated = wallet.reduce((s, e) => s + e.amount, 0);
    const totalSpends = spends.reduce((s, e) => s + e.amount, 0);
    const walletBalance = totalAllocated - totalSpends;
    const freeCash =
      totalIncome + newCashSavings - allocFromFreeCashSavings - totalAllocated;
    const netWorth = freeCash + walletBalance + totalSavings + portfolioValue;
    return {
      income: totalIncome,
      savings: totalSavings,
      spends: totalSpends,
      allocated: totalAllocated,
      walletBalance,
      freeCash,
      netWorth,
    };
  }, [income, savings, wallet, spends, portfolioValue]);

  const walletRemaining = useCallback(
    (walletId: string) => {
      const alloc = wallet.find((w) => w.id === walletId);
      if (!alloc) return 0;
      const spent = spends
        .filter((s) => s.walletId === walletId)
        .reduce((s, e) => s + e.amount, 0);
      return alloc.amount - spent;
    },
    [wallet, spends],
  );

  const monthlySpendByCategory = useMemo(() => {
    const r: Record<string, number> = {};
    for (const s of spends) {
      if (!isSameMonth(s.date)) continue;
      r[s.category] = (r[s.category] ?? 0) + s.amount;
    }
    return r;
  }, [spends]);

  const savedByCategory = useMemo(() => {
    const r: Record<string, number> = {};
    for (const s of savings) {
      r[s.category] = (r[s.category] ?? 0) + s.amount;
    }
    return r;
  }, [savings]);

  const addIncome: Ctx["addIncome"] = (e) => {
    if (e.amount <= 0) return { ok: false, error: "Amount must be positive" };
    setIncome((prev) => [{ ...e, id: uid() }, ...prev]);
    return { ok: true };
  };
  const deleteIncome = (id: string) => setIncome((p) => p.filter((x) => x.id !== id));

  const addSavings: Ctx["addSavings"] = (e) => {
    if (e.amount <= 0) return { ok: false, error: "Amount must be positive" };
    if (e.source === "allocate" && e.amount > totals.freeCash) {
      return { ok: false, error: "Amount exceeds available Free Cash" };
    }
    setSavings((prev) => [{ ...e, id: uid() }, ...prev]);
    return { ok: true };
  };
  const deleteSavings = (id: string) => {
    const entry = savings.find((s) => s.id === id);
    if (!entry) return;
    if (entry.source === "new") {
      // Removing a "new cash" savings entry would reduce Free Cash; block if it goes negative
      if (totals.freeCash - entry.amount < 0) return;
    }
    setSavings((p) => p.filter((x) => x.id !== id));
  };

  const addWallet: Ctx["addWallet"] = (e) => {
    if (e.amount <= 0) return { ok: false, error: "Amount must be positive" };
    if (e.amount > totals.freeCash) {
      return { ok: false, error: "Amount exceeds available Free Cash" };
    }
    setWallet((prev) => [{ ...e, id: uid() }, ...prev]);
    return { ok: true };
  };
  const deleteWallet = (id: string) => {
    // Don't delete if it has spends linked
    if (spends.some((s) => s.walletId === id)) return;
    setWallet((p) => p.filter((x) => x.id !== id));
  };

  const addSpend: Ctx["addSpend"] = (e) => {
    if (e.amount <= 0) return { ok: false, error: "Amount must be positive" };
    const remaining = walletRemaining(e.walletId);
    if (e.amount > remaining) {
      return { ok: false, error: "Amount exceeds wallet remaining balance" };
    }
    setSpends((prev) => [{ ...e, id: uid() }, ...prev]);
    return { ok: true };
  };
  const deleteSpend = (id: string) => setSpends((p) => p.filter((x) => x.id !== id));

  const addCategory: Ctx["addCategory"] = (kind, rawName) => {
    const name = rawName.trim();
    if (!name) return { ok: false, error: "Category name required" };
    const setter =
      kind === "income"
        ? setIncomeCategories
        : kind === "savings"
          ? setSavingsCategories
          : setExpenseCategories;
    const current =
      kind === "income"
        ? incomeCategories
        : kind === "savings"
          ? savingsCategories
          : expenseCategories;
    if (current.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: "Category already exists" };
    }
    setter([...current, name]);
    return { ok: true };
  };

  const setLimit = (cat: string, n: number) =>
    setLimits((p) => ({ ...p, [cat]: Math.max(0, n) }));
  const setGoal = (cat: string, n: number) =>
    setGoals((p) => ({ ...p, [cat]: Math.max(0, n) }));
  const setPortfolioValue = (n: number) => setPortfolioValueState(Math.max(0, n));
  const setThreshold = (n: number) => setThresholdState(Math.max(0, n));

  const resetAll = () => {
    setIncome([]);
    setSavings([]);
    setWallet([]);
    setSpends([]);
    setIncomeCategories(DEFAULT_INCOME_CATEGORIES);
    setSavingsCategories(DEFAULT_SAVINGS_CATEGORIES);
    setExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
    setLimits({});
    setGoals({});
    setPortfolioValueState(0);
    setThresholdState(0);
  };

  const value: Ctx = {
    income,
    savings,
    wallet,
    spends,
    incomeCategories,
    savingsCategories,
    expenseCategories,
    limits,
    goals,
    portfolioValue,
    threshold,
    totals,
    walletRemaining,
    monthlySpendByCategory,
    savedByCategory,
    addIncome,
    deleteIncome,
    addSavings,
    deleteSavings,
    addWallet,
    deleteWallet,
    addSpend,
    deleteSpend,
    addCategory,
    setLimit,
    setGoal,
    setPortfolioValue,
    setThreshold,
    resetAll,
  };

  return <FinanceCtx.Provider value={value}>{children}</FinanceCtx.Provider>;
}

export function useFinance(): Ctx {
  const v = useContext(FinanceCtx);
  if (!v) throw new Error("useFinance must be used within FinanceProvider");
  return v;
}
