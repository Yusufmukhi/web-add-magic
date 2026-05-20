export function downloadCSV(rows: (string | number)[][], filename: string): void {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal CSV parser supporting quoted fields and embedded commas/quotes. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export interface ImportedHolding {
  ticker: string;
  qty: number;
  price: number;
  date: string;
}

/** Parse a CSV with header row containing ticker, qty, price, date (case-insensitive). */
export function parseHoldingsCSV(text: string): { holdings: ImportedHolding[]; errors: string[] } {
  const rows = parseCSV(text);
  const errors: string[] = [];
  if (rows.length < 2) {
    return { holdings: [], errors: ["CSV is empty or has no data rows"] };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    ticker: header.findIndex((h) => h === "ticker" || h === "symbol" || h === "stock"),
    qty: header.findIndex((h) => h === "qty" || h === "quantity" || h === "shares"),
    price: header.findIndex((h) => h === "price" || h === "avg price" || h === "avg cost" || h === "buy price"),
    date: header.findIndex((h) => h === "date" || h === "buy date"),
  };
  if (idx.ticker < 0 || idx.qty < 0 || idx.price < 0) {
    return {
      holdings: [],
      errors: ["CSV must have columns: ticker, qty, price, date (date optional)"],
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  const holdings: ImportedHolding[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => !c.trim())) continue;
    const ticker = (r[idx.ticker] ?? "").trim().toUpperCase();
    const qty = parseFloat((r[idx.qty] ?? "").replace(/,/g, ""));
    const price = parseFloat((r[idx.price] ?? "").replace(/[₹,$\s,]/g, ""));
    const date = idx.date >= 0 ? (r[idx.date] ?? "").trim() : "";
    if (!ticker || !isFinite(qty) || qty <= 0 || !isFinite(price) || price <= 0) {
      errors.push(`Row ${i + 1}: invalid (ticker=${ticker}, qty=${qty}, price=${price})`);
      continue;
    }
    holdings.push({ ticker, qty, price, date: date || today });
  }
  return { holdings, errors };
}
