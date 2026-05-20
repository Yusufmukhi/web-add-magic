export interface StockMeta {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
}

export interface StockQuote {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  cmp: number;
  prevClose: number;
  dayChange: number;
  dayChangePct: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  pe: number | null;
  pb: number | null;
  eps: number | null;
  bookValue: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
  totalRevenue: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  revenueGrowth: number | null;
  heldPercentInsiders: number | null;
  heldPercentInstitutions: number | null;
}

export interface RatingResult {
  className: "strong-buy" | "buy" | "accumulate" | "hold" | "sell";
  label: string;
  emoji: string;
}

export interface HistoryPoint {
  date: string;
  close: number;
}

export type SortKey =
  | "ticker"
  | "name"
  | "sector"
  | "cmp"
  | "dayChangePct"
  | "pe"
  | "marketCap";

export type SortDir = "asc" | "desc";
