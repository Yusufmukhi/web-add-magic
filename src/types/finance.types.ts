// ─── Finance Tracker Types ───────────────────────────────────────────────────

export type IncomeFrequency = "monthly" | "quarterly" | "yearly" | "one-time";
export type SavingsCategory =
  | "emergency"
  | "retirement"
  | "education"
  | "vacation"
  | "home"
  | "car"
  | "wedding"
  | "custom";
export type ExpenseCategory =
  | "housing"
  | "food"
  | "transport"
  | "utilities"
  | "healthcare"
  | "entertainment"
  | "education"
  | "clothing"
  | "personal"
  | "subscriptions"
  | "custom";
export type ExpensePaymentMode =
  | "cash"
  | "upi"
  | "card"
  | "netbanking"
  | "emi";

// ─── Income ──────────────────────────────────────────────────────────────────

export interface IncomeEntry {
  id: string;
  source: string;
  amount: number;
  frequency: IncomeFrequency;
  date: string; // ISO date string
  notes?: string;
}

// ─── Savings ─────────────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  category: SavingsCategory;
  targetDate?: string;
  notes?: string;
}

export interface SavingsDeposit {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  notes?: string;
}

// ─── Wallet / Spending ───────────────────────────────────────────────────────

export interface WalletAllocation {
  id: string;
  label: string;
  amount: number;
  color: string;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  paymentMode: ExpensePaymentMode;
  date: string;
  tags?: string[];
  notes?: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface FinanceSettings {
  currency: string;
  monthlyIncomeBudget: number;
  walletAllocations: WalletAllocation[];
  savingsGoals: SavingsGoal[];
}

// ─── Context State ───────────────────────────────────────────────────────────

export interface FinanceState {
  incomeEntries: IncomeEntry[];
  savingsDeposits: SavingsDeposit[];
  expenses: ExpenseEntry[];
  settings: FinanceSettings;
  livePortfolioValue: number; // injected from Dalal Street
}

export interface FinanceContextValue extends FinanceState {
  // Income
  addIncome: (entry: Omit<IncomeEntry, "id">) => void;
  updateIncome: (id: string, entry: Partial<IncomeEntry>) => void;
  deleteIncome: (id: string) => void;

  // Savings
  addSavingsDeposit: (deposit: Omit<SavingsDeposit, "id">) => void;
  deleteSavingsDeposit: (id: string) => void;

  // Expenses
  addExpense: (entry: Omit<ExpenseEntry, "id">) => void;
  updateExpense: (id: string, entry: Partial<ExpenseEntry>) => void;
  deleteExpense: (id: string) => void;

  // Settings
  updateSettings: (settings: Partial<FinanceSettings>) => void;
  addSavingsGoal: (goal: Omit<SavingsGoal, "id">) => void;
  updateSavingsGoal: (id: string, goal: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;
  addWalletAllocation: (allocation: Omit<WalletAllocation, "id">) => void;
  updateWalletAllocation: (
    id: string,
    allocation: Partial<WalletAllocation>
  ) => void;
  deleteWalletAllocation: (id: string) => void;

  // Derived
  totalMonthlyIncome: number;
  totalSavings: number;
  totalExpenses: number;
  freeCash: number;
  walletBalance: number;
  netWorth: number;
  setLivePortfolioValue: (val: number) => void;
}
