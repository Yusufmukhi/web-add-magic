export interface Holding {
  ticker: string;
  qty: number;
  avgPrice: number;
  buyDate: string;
}

export type TxAction = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";

export interface TxMeta {
  type?: string;
  avgCost?: number;
  buyDate?: string;
  sellDate?: string;
  holdingDays?: number;
  profit?: number;
  profitPct?: number;
}

export interface Transaction {
  id: string;
  date: string;
  action: TxAction;
  stock?: string;
  qty?: number;
  price?: number;
  amount: number;
  cashAfter: number;
  meta?: TxMeta;
}

export interface HoldingRow extends Holding {
  cp: number;
  invested: number;
  value: number;
  pl: number;
  plPct: number;
  realized: number;
  weight: number;
  sector: string;
  name: string;
  daysHeld: number | null;
}
