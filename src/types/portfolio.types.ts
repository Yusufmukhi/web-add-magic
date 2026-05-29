/** A single purchase lot used for FIFO cost-basis tracking. */
export interface FifoLot {
  /** Unique lot ID (same format as transaction id: `${Date.now()}-${random}`). */
  id: string;
  /** Purchase date (YYYY-MM-DD). */
  date: string;
  /** Original purchase price per share. */
  price: number;
  /** Remaining (unsold) shares in this lot. */
  qty: number;
}

export interface Holding {
  ticker: string;
  /** Total remaining quantity across all lots. */
  qty: number;
  /**
   * Weighted-average cost across remaining lots — kept for backward-compat
   * display and as a quick reference. P&L on sells is always computed via FIFO.
   */
  avgPrice: number;
  /** Date of the OLDEST remaining lot (for display). */
  buyDate: string;
  /** FIFO lots, oldest first. Each lot has its own price and remaining qty. */
  lots: FifoLot[];
}

export type TxAction = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";

/** Per-lot detail for a FIFO sell (one entry per lot consumed). */
export interface FifoLotDetail {
  lotId: string;
  lotDate: string;
  lotPrice: number;
  qtySold: number;
  lotProfit: number;
  holdingDays: number;
  taxType: "LTCG" | "STCG";
}

export interface TxMeta {
  type?: string;
  /** Raw trading price per share (before charges). Only on BUY. */
  tradingPrice?: number;
  /** Charges per share. Only on BUY. */
  chargesPerShare?: number;
  avgCost?: number;
  buyDate?: string;
  sellDate?: string;
  holdingDays?: number;
  /** Net profit after charges (= grossProfit - charges). Angel One "Net Realised P&L". */
  profit?: number;
  /** Gross profit before charges. Angel One "Realised P&L". */
  grossProfit?: number;
  profitPct?: number;
  /** Total sell-side charges (brokerage + STT + GST + DP + …). */
  charges?: number;
  /** Gross sell value before deducting charges. */
  grossAmount?: number;
  /** User-entered description on deposits / withdrawals / trades. */
  note?: string;
  /** FIFO per-lot breakdown (populated on SELL transactions). */
  fifoLots?: FifoLotDetail[];
  /** Weighted avg cost of lots consumed (for display). */
  fifoAvgCost?: number;
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
