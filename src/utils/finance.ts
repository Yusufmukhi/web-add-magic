/**
 * NSE EQUITY DELIVERY — standard sell-side charges (approx, INR).
 * Rates updated for FY24+. Buy-side is similar except STT applies to BOTH sides
 * for delivery, but we only auto-compute on SELL since user asked for sell charges.
 *
 * brokerage      → most discount brokers charge ₹0 on delivery; default 0, editable
 * stt            → 0.1% of sell turnover (delivery)
 * exchTxn        → NSE 0.00297%  (BSE 0.00375%)
 * sebi           → 0.0001%
 * stampDuty      → buy-side only (0.015%); zero on sell
 * gst            → 18% on (brokerage + exchTxn + sebi)
 * dpCharges      → ~₹15.93 flat per sell scrip (CDSL/NSDL + broker), editable
 */
export interface SellChargesBreakdown {
  brokerage: number;
  stt: number;
  exchTxn: number;
  sebi: number;
  gst: number;
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

export function computeSellCharges(
  sellValue: number,
  rates: SellChargeRates = {}
): SellChargesBreakdown {
  const brokerage = rates.brokerage ?? DEFAULT_SELL_RATES.brokerage;
  const dpCharges = rates.dpCharges ?? DEFAULT_SELL_RATES.dpCharges;
  const stt = sellValue * 0.001; // 0.1%
  const exchTxn = sellValue * 0.0000297; // 0.00297%
  const sebi = sellValue * 0.000001; // 0.0001%
  const gst = (brokerage + exchTxn + sebi) * 0.18;
  const total = brokerage + stt + exchTxn + sebi + gst + dpCharges;
  return {
    brokerage,
    stt: round2(stt),
    exchTxn: round2(exchTxn),
    sebi: round2(sebi),
    gst: round2(gst),
    dpCharges,
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
