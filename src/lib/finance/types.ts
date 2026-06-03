export type IncomeEntry = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  amount: number;
  category: string;
  description?: string;
};

export type SavingsSource = "allocate" | "new";

export type SavingsEntry = {
  id: string;
  date: string;
  amount: number;
  category: string;
  description?: string;
  source: SavingsSource;
};

export type WalletAllocation = {
  id: string;
  date: string;
  label: string;
  amount: number;
  description?: string;
};

export type SpendEntry = {
  id: string;
  date: string;
  amount: number;
  category: string;
  description?: string;
  walletId: string;
};

export type Limits = Record<string, number>;
export type Goals = Record<string, number>;

export const DEFAULT_INCOME_CATEGORIES = [
  "Salary",
  "Business",
  "Freelance",
  "Gift",
  "Eid Gift",
  "Dividend",
  "Other",
];

export const DEFAULT_SAVINGS_CATEGORIES = [
  "Emergency Fund",
  "Investment",
  "Fixed Deposit",
  "Goal-based Saving",
  "Other",
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Rent",
  "Healthcare",
  "Education",
  "Entertainment",
  "EMI",
  "Other",
];
