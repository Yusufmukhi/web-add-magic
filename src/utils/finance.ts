/**
 * Angel One — NSE EQUITY DELIVERY charges (INR).
 *
 * brokerage  → min(₹20, 0.1% × order value) per executed order, BOTH buy & sell
 * stt        → 0.1% on BOTH buy & sell turnover (delivery)
 * exchTxn    → NSE 0.00297% on total turnover
 * sebi       → 0.0001% on total turnover (₹10 per crore)
 * ipft       → NSE 0.0001% on total turnover
 * stampDuty  → 0.015% on BUY side only
 * gst        → 18% on (brokerage + exchTxn + sebi + ipft)
 * dpCharges  → ~₹15.93 flat per sell scrip (CDSL/NSDL + broker), editable
 */
export interface SellChargesBreakdown {
  brokerage: number;
  stt: number;
  exchTxn: number;
  sebi: number;
  gst: number;
  stampDuty: number;
  ipft: number;
  dpCharges: number;
  total: number;
}

export interface SellChargeRates {
  /** Flat brokerage in ₹ (set to 0 for discount brokers). */
  brokerage?: number;
  /** Flat DP charges per sell scrip in ₹. */
  dpCharges?: number;
}

export const DEFAULT_SELL_RATES: Required<SellChargeRates> = {
  brokerage: 0,
  dpCharges: 15.93,
};

/** Angel One per-order brokerage cap (delivery): lower of ₹20 or 0.1% of order value. */
function angelBrokerage(orderValue: number) {
  return Math.min(20, orderValue * 0.001);
}

export function computeSellCharges(
  sellValue: number,
  rates: SellChargeRates = {}
): SellChargesBreakdown {
  // Sell-only estimate (used at sell-time when buy value not handy).
  // Angel One brokerage on the sell leg only.
  const brokerage =
    rates.brokerage !== undefined ? rates.brokerage : angelBrokerage(sellValue);
  const dpCharges = rates.dpCharges ?? DEFAULT_SELL_RATES.dpCharges;
  const stt = sellValue * 0.001; // 0.1% sell leg
  const exchTxn = sellValue * 0.0000297;
  const sebi = sellValue * 0.000001;
  const ipft = sellValue * 0.000001;
  const stampDuty = 0; // buy-side only
  const gst = (brokerage + exchTxn + sebi + ipft) * 0.18;
  const total =
    brokerage + stt + exchTxn + sebi + ipft + stampDuty + gst + dpCharges;
  return {
    brokerage,
    stt: round2(stt),
    exchTxn: round2(exchTxn),
    sebi: round2(sebi),
    gst: round2(gst),
    stampDuty: round2(stampDuty),
    ipft: round2(ipft),
    dpCharges,
    total: round2(total),
  };
}

/**
 * Full Angel One charges across a complete BUY + SELL delivery trade
 * (matches the "Charges Breakup" view shown in the Angel One app).
 */
export interface FullChargesBreakdown {
  brokerage: number;
  stt: number;
  exchTxn: number;
  gst: number;
  sebi: number;
  stampDuty: number;
  ipft: number;
  dpCharges: number;
  total: number;
}

export function computeAngelCharges(
  buyValue: number,
  sellValue: number,
  opts: { dpCharges?: number } = {}
): FullChargesBreakdown {
  const turnover = buyValue + sellValue;
  const brokerage = angelBrokerage(buyValue) + angelBrokerage(sellValue);
  const stt = turnover * 0.001; // both legs, delivery
  const exchTxn = turnover * 0.0000297; // NSE
  const sebi = turnover * 0.000001;
  const ipft = turnover * 0.000001;
  const stampDuty = buyValue * 0.00015; // 0.015% buy side
  const gst = (brokerage + exchTxn + sebi + ipft) * 0.18;
  const dpCharges = opts.dpCharges ?? 0; // shown separately in Angel breakup
  const total =
    brokerage + stt + exchTxn + sebi + ipft + stampDuty + gst + dpCharges;
  return {
    brokerage: round2(brokerage),
    stt: round2(stt),
    exchTxn: round2(exchTxn),
    gst: round2(gst),
    sebi: round2(sebi),
    stampDuty: round2(stampDuty),
    ipft: round2(ipft),
    dpCharges: round2(dpCharges),
    total: round2(total),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/* ─────────────────────────────────────────────────────────────────
   XIRR — money-weighted annualized return using Newton's method.
   Works for any mix of cashflows including fully-realized portfolios.

   cashflows: BUYs are negative (outflow), SELLs / current MV are positive.
   dates:     ISO date strings parallel to cashflows.
   Returns:   decimal rate (0.18 = 18%) or null when not solvable.
   ───────────────────────────────────────────────────────────────── */
export function xirr(
  cashflows: number[],
  dates: string[],
  guess = 0.1
): number | null {
  if (cashflows.length < 2 || cashflows.length !== dates.length) return null;
  // Must have at least one positive AND one negative flow
  let hasPos = false,
    hasNeg = false;
  for (const c of cashflows) {
    if (c > 0) hasPos = true;
    else if (c < 0) hasNeg = true;
  }
  if (!hasPos || !hasNeg) return null;

  const t0 = Date.parse(dates[0]);
  const ts = dates.map((d) => (Date.parse(d) - t0) / (365.25 * 86400000));
  // Ensure last date strictly > first
  if (ts.every((x) => x === 0)) return null;

  const npv = (r: number) =>
    cashflows.reduce((s, c, i) => s + c / Math.pow(1 + r, ts[i]), 0);
  const dnpv = (r: number) =>
    cashflows.reduce(
      (s, c, i) => s - (ts[i] * c) / Math.pow(1 + r, ts[i] + 1),
      0
    );

  let r = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(r);
    const fp = dnpv(r);
    if (!isFinite(f) || !isFinite(fp) || fp === 0) break;
    const next = r - f / fp;
    if (!isFinite(next)) break;
    if (Math.abs(next - r) < 1e-7) {
      r = next;
      break;
    }
    // Keep r > -1 (otherwise compounding blows up)
    r = Math.max(next, -0.9999);
  }
  if (!isFinite(r) || Math.abs(npv(r)) > 1) {
    // Fall back to bisection between -0.99 and 10
    let lo = -0.99,
      hi = 10;
    let flo = npv(lo),
      fhi = npv(hi);
    if (flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const fm = npv(mid);
      if (Math.abs(fm) < 1e-6) return mid;
      if (fm * flo < 0) {
        hi = mid;
        fhi = fm;
      } else {
        lo = mid;
        flo = fm;
      }
    }
    r = (lo + hi) / 2;
  }
  return isFinite(r) ? r : null;
}
