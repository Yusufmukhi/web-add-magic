/** Indian number formatting: 1,23,456.78 (lakh/crore comma style). */
export function formatIndianNumber(n: number, decimals = 2): string {
  if (!isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [int, frac = ""] = abs.toFixed(decimals).split(".");
  let lastThree = int.slice(-3);
  const rest = int.slice(0, -3);
  const formatted = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
    : lastThree;
  return sign + formatted + (frac ? "." + frac : "");
}

export function formatINR(n: number | null | undefined, decimals = 2): string {
  if (n == null || !isFinite(n)) return "—";
  return "₹" + formatIndianNumber(n, decimals);
}

/** Market cap in Cr / L (1 Cr = 10,000,000, 1 L = 100,000). */
export function formatMarketCap(n: number | null | undefined): string {
  if (n == null || !n) return "—";
  if (n >= 1e7) return "₹" + formatIndianNumber(n / 1e7, 2) + " Cr";
  if (n >= 1e5) return "₹" + formatIndianNumber(n / 1e5, 2) + " L";
  return "₹" + formatIndianNumber(n, 0);
}

export function formatPct(
  n: number | null | undefined,
  decimals = 2,
  multiplier = 1
): string {
  if (n == null || !isFinite(n)) return "—";
  return (n * multiplier).toFixed(decimals) + "%";
}

export function formatChangePct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const arrow = n >= 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(n).toFixed(2)}%`;
}

export function formatNumber(
  n: number | null | undefined,
  decimals = 2
): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toFixed(decimals);
}
