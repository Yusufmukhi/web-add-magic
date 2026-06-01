/** ─── PocketWise Finance Tracker Types ─── */

export type WalletKey = "free" | "spending" | "savings";

export interface IncomeEntry {
  id: string;
  date: string;       // YYYY-MM
  amount: number;
  source: string;
  note?: string;
}

export interface ExpenseEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  amount: number;
  category: string;
  note?: string;
  wallet: "spending" | "free";
}

export interface SavingsEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  amount: number;
  goalId?: string;
  note?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline?: string;  // YYYY-MM-DD
  color: string;
}

export interface WalletAllocation {
  /** % of monthly income going to spending wallet */
  spendingPct: number;
  /** % of monthly income going to savings wallet */
  savingsPct: number;
  /** Monthly spending wallet limit (₹) */
  monthlySpendLimit: number;
}

export interface FinanceSettings {
  allocation: WalletAllocation;
  goals: SavingsGoal[];
}

export interface FinanceState {
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  savings: SavingsEntry[];
  settings: FinanceSettings;
}
