/**
 * FIFO (First-In, First-Out) cost-basis utilities.
 *
 * Rules:
 *  - Each BUY creates a new lot with a date, price, and qty.
 *  - Each SELL consumes lots oldest-first.
 *  - Profit per lot = (sellPrice - lotPrice) * qtySold.
 *  - Tax type per lot: LTCG if holdingDays >= 365, else STCG.
 *  - Charges are pro-rated across lots by qty.
 */

import type { FifoLot, FifoLotDetail } from "@/types/portfolio.types";

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Create a fresh lot from a buy order. */
export function makeLot(date: string, price: number, qty: number): FifoLot {
  return { id: newId(), date, price, qty };
}

export interface FifoSellResult {
  /** Updated lots array (oldest fully consumed lots removed, partial lot reduced). */
  remainingLots: FifoLot[];
  /** Per-lot detail for reporting / transaction meta. */
  lotDetails: FifoLotDetail[];
  /** Total gross profit across all consumed lots (before charges). */
  grossProfit: number;
  /** Net profit after deducting charges. */
  netProfit: number;
  /** Weighted-average cost of lots consumed. */
  fifoAvgCost: number;
  /** Dominant tax type: LTCG if majority (by qty) of sold shares were held ≥ 365 days. */
  dominantTaxType: "LTCG" | "STCG";
  /** Holding days of the OLDEST lot consumed (used as primary holdingDays on tx). */
  oldestLotHoldingDays: number;
  /** Date of the oldest lot consumed. */
  oldestLotDate: string;
}

/**
 * Apply a SELL against a FIFO lot queue.
 *
 * @param lots      Current lots for the holding (will NOT be mutated).
 * @param sellQty   Number of shares to sell.
 * @param sellPrice Sell price per share.
 * @param sellDate  Sell date (YYYY-MM-DD).
 * @param charges   Total sell charges (₹). Pro-rated across lots by qty.
 */
export function fifoSell(
  lots: FifoLot[],
  sellQty: number,
  sellPrice: number,
  sellDate: string,
  charges: number
): FifoSellResult | null {
  const totalAvailable = lots.reduce((s, l) => s + l.qty, 0);
  if (sellQty > totalAvailable || sellQty <= 0) return null;

  // Deep-copy lots so we don't mutate state
  const workingLots: FifoLot[] = lots.map((l) => ({ ...l }));
  const lotDetails: FifoLotDetail[] = [];
  let remaining = sellQty;

  for (const lot of workingLots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qty, remaining);
    const holdingDays = Math.max(
      0,
      Math.floor((Date.parse(sellDate) - Date.parse(lot.date)) / 86400000)
    );
    const taxType: "LTCG" | "STCG" = holdingDays >= 365 ? "LTCG" : "STCG";
    // Gross profit for this slice (charges allocated later)
    const lotProfit = (sellPrice - lot.price) * take;
    lotDetails.push({
      lotId: lot.id,
      lotDate: lot.date,
      lotPrice: lot.price,
      qtySold: take,
      lotProfit,
      holdingDays,
      taxType,
    });
    lot.qty -= take;
    remaining -= take;
  }

  // Pro-rate charges across lots by qty
  const chargesPerShare = charges / sellQty;
  const detailsWithCharges: FifoLotDetail[] = lotDetails.map((d) => ({
    ...d,
    lotProfit: d.lotProfit - chargesPerShare * d.qtySold,
  }));

  const grossProfit = lotDetails.reduce((s, d) => s + d.lotProfit, 0);
  const netProfit = grossProfit - charges;

  // Remove fully consumed lots
  const remainingLots = workingLots.filter((l) => l.qty > 0);

  // Weighted-average cost of consumed lots
  const totalSold = lotDetails.reduce((s, d) => s + d.qtySold, 0);
  const fifoAvgCost =
    totalSold > 0
      ? lotDetails.reduce((s, d) => s + d.lotPrice * d.qtySold, 0) / totalSold
      : 0;

  // Dominant tax type
  const ltcgQty = lotDetails
    .filter((d) => d.taxType === "LTCG")
    .reduce((s, d) => s + d.qtySold, 0);
  const dominantTaxType: "LTCG" | "STCG" = ltcgQty >= sellQty / 2 ? "LTCG" : "STCG";

  const oldest = lotDetails[0];

  return {
    remainingLots,
    lotDetails: detailsWithCharges,
    grossProfit,
    netProfit,
    fifoAvgCost,
    dominantTaxType,
    oldestLotHoldingDays: oldest?.holdingDays ?? 0,
    oldestLotDate: oldest?.lotDate ?? sellDate,
  };
}

/**
 * Recompute avgPrice and buyDate from a set of remaining lots.
 * avgPrice = weighted average of (lot.price * lot.qty) / total qty.
 * buyDate  = date of the oldest lot.
 */
export function recomputeHoldingMeta(lots: FifoLot[]): { avgPrice: number; buyDate: string } {
  if (!lots.length) return { avgPrice: 0, buyDate: "" };
  const totalQty = lots.reduce((s, l) => s + l.qty, 0);
  const avgPrice =
    totalQty > 0
      ? lots.reduce((s, l) => s + l.price * l.qty, 0) / totalQty
      : 0;
  // Oldest lot (already sorted oldest-first by insertion order)
  const buyDate = lots[0].date;
  return { avgPrice, buyDate };
}

/**
 * Preview: compute estimated P&L for a proposed sell without mutating anything.
 * Returns gross profit and FIFO avg cost for the sell modal preview.
 */
export function previewFifoSell(
  lots: FifoLot[],
  sellQty: number,
  sellPrice: number,
  sellDate: string,
  charges: number
): { grossProfit: number; netProfit: number; fifoAvgCost: number; dominantTaxType: "LTCG" | "STCG" } | null {
  const res = fifoSell(lots, sellQty, sellPrice, sellDate, charges);
  if (!res) return null;
  return {
    grossProfit: res.grossProfit,
    netProfit: res.netProfit,
    fifoAvgCost: res.fifoAvgCost,
    dominantTaxType: res.dominantTaxType,
  };
}
