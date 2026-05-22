import * as XLSX from "xlsx";

// ─── Download helper ──────────────────────────────────────────────────────────
export function downloadExcel(
  sheets: { name: string; rows: (string | number | null | undefined)[][] }[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Auto-fit column widths based on content
    const colWidths: number[] = [];
    rows.forEach((row) => {
      row.forEach((cell, ci) => {
        const len = String(cell ?? "").length;
        colWidths[ci] = Math.min(60, Math.max(colWidths[ci] ?? 8, len + 2));
      });
    });
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  XLSX.writeFile(wb, filename);
}

// ─── Minimal CSV-compat parser (kept for backward compat if needed) ──────────
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

// ─── Import types ─────────────────────────────────────────────────────────────
export interface ImportedHolding {
  ticker: string;
  qty: number;
  price: number;
  date: string;
}

// ─── Parse holdings from .xlsx file ──────────────────────────────────────────
export async function parseHoldingsExcel(
  file: File
): Promise<{ holdings: ImportedHolding[]; errors: string[] }> {
  const errors: string[] = [];

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  if (!wb.SheetNames.length) {
    return { holdings: [], errors: ["Excel file has no sheets."] };
  }

  // Try the first sheet
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (raw.length < 2) {
    return { holdings: [], errors: ["Sheet is empty or has no data rows."] };
  }

  const header = (raw[0] as string[]).map((h) => String(h ?? "").trim().toLowerCase());
  const idx = {
    ticker: header.findIndex((h) => ["ticker", "symbol", "stock"].includes(h)),
    qty: header.findIndex((h) => ["qty", "quantity", "shares"].includes(h)),
    price: header.findIndex((h) => ["price", "avg price", "avg cost", "buy price"].includes(h)),
    date: header.findIndex((h) => ["date", "buy date"].includes(h)),
  };

  if (idx.ticker < 0 || idx.qty < 0 || idx.price < 0) {
    return {
      holdings: [],
      errors: [
        "Excel sheet must have columns: Ticker, Qty, Price, Date (Date is optional). " +
          "Please check column names and try again.",
      ],
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const holdings: ImportedHolding[] = [];

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as (string | number)[];
    if (r.every((c) => String(c ?? "").trim() === "")) continue;

    const ticker = String(r[idx.ticker] ?? "").trim().toUpperCase();
    const qty = parseFloat(String(r[idx.qty] ?? "").replace(/,/g, ""));
    const price = parseFloat(String(r[idx.price] ?? "").replace(/[₹,$\s,]/g, ""));
    const rawDate = idx.date >= 0 ? r[idx.date] : "";
    let date = String(rawDate ?? "").trim();

    // Handle Excel serial date numbers
    if (typeof rawDate === "number") {
      const parsed = XLSX.SSF.parse_date_code(rawDate);
      if (parsed) {
        date = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }
    }

    if (!ticker || !isFinite(qty) || qty <= 0 || !isFinite(price) || price <= 0) {
      errors.push(
        `Row ${i + 1}: Skipped — invalid data (Ticker: "${ticker}", Qty: ${qty}, Price: ${price}). ` +
          "Ensure all values are filled and positive."
      );
      continue;
    }

    holdings.push({ ticker, qty, price, date: date || today });
  }

  return { holdings, errors };
}
