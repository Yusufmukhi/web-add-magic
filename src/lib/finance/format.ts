// Indian numbering format with ₹
export function formatINR(value: number, withSymbol = true): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(abs);
  const sign = n < 0 ? "-" : "";
  return `${sign}${withSymbol ? "₹" : ""}${formatted}`;
}

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function isSameMonth(iso: string, ref = new Date()): boolean {
  const d = new Date(iso + "T00:00:00");
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}
