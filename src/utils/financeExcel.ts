/**
 * financeExcel.ts
 * Finance Tracker Excel export — Sheet 1: Summary, Sheet 2: Transactions
 * Sheet 3: Portfolio (when portfolio data is supplied)
 *
 * Uses the same dark-navy styling approach as src/utils/excel.ts
 * but is self-contained so it doesn't break the existing Dalal Street export.
 */

import type {
  IncomeEntry,
  SavingsDeposit,
  SavingsGoal,
  ExpenseEntry,
} from "@/types/finance.types";

// ─── Inline style constants (mirrors excel.ts S.* palette) ───────────────────

const DARK_NAVY = "1A2236";
const CARD_BG = "1E2D42";
const HEADER_BG = "243552";
const GREEN = "22C55E";
const RED = "EF4444";
const BLUE = "3B82F6";
const VIOLET = "8B5CF6";
const AMBER = "F59E0B";
const TEAL = "14B8A6";
const ORANGE = "F97316";
const WHITE = "FFFFFF";
const MUTED = "94A3B8";

function toSerial(dateStr: string): number {
  const d = new Date(dateStr);
  const epoch = new Date(1899, 11, 30);
  return Math.floor((d.getTime() - epoch.getTime()) / 86_400_000);
}

function num(v: number) {
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// ─── XML helpers ──────────────────────────────────────────────────────────────

function xml(tag: string, attrs: Record<string, string | number>, ...children: string[]) {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  if (children.length === 0) return `<${tag}${attrStr}/>`;
  return `<${tag}${attrStr}>${children.join("")}</${tag}>`;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── XLSX builder (no external deps, pure XML) ───────────────────────────────

type Row = (string | number | null)[];

interface SheetDef {
  name: string;
  rows: Row[];
  colWidths?: number[];
}

async function buildXlsx(sheets: SheetDef[]): Promise<Blob> {
  const encoder = new TextEncoder();

  // Collect all unique strings for shared strings
  const strings: string[] = [];
  const strIndex: Record<string, number> = {};

  function si(s: string): number {
    if (strIndex[s] === undefined) {
      strIndex[s] = strings.length;
      strings.push(s);
    }
    return strIndex[s];
  }

  // Build sheet XMLs
  const sheetXmls: string[] = sheets.map((sheet) => {
    const rows = sheet.rows
      .map((row, ri) => {
        const cells = row
          .map((cell, ci) => {
            const col = String.fromCharCode(65 + (ci % 26));
            const ref = `${col}${ri + 1}`;
            if (cell === null || cell === undefined) return "";
            if (typeof cell === "number") {
              return `<c r="${ref}"><v>${cell}</v></c>`;
            }
            const idx = si(String(cell));
            return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
          })
          .join("");
        return `<row r="${ri + 1}">${cells}</row>`;
      })
      .join("");

    const colDefs = (sheet.colWidths ?? [])
      .map(
        (w, i) =>
          `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colDefs}</cols>
  <sheetData>${rows}</sheetData>
</worksheet>`;
  });

  // Shared strings
  const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map((s) => `<si><t>${escapeXml(s)}</t></si>`).join("")}
</sst>`;

  // Workbook
  const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("\n    ")}
  </sheets>
</workbook>`;

  // Workbook rels
  const wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n  ")}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  // Content types
  const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n  ")}
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  // Package rels
  const pkgRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // Build ZIP via JSZip-like raw construction
  // Use a minimal ZIP writer since we don't have JSZip imported here
  // We'll use the dynamic import approach to get XLSX from the xlsx library already in the project
  // Actually, build a simple blob using the xlsx package (SheetJS) if available,
  // otherwise fall back to CSV download.

  try {
    // Try to use SheetJS (xlsx) which is already a dep in the project
    const XLSX = await import("xlsx");

    const wb = XLSX.utils.book_new();

    sheets.forEach((sheet) => {
      const ws = XLSX.utils.aoa_to_sheet(sheet.rows);

      // Column widths
      if (sheet.colWidths) {
        ws["!cols"] = sheet.colWidths.map((w) => ({ wch: w }));
      }

      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  } catch {
    // Fallback: plain CSV of first sheet
    const csv = sheets[0].rows.map((r) => r.map(String).join(",")).join("\n");
    return new Blob([csv], { type: "text/csv" });
  }
}

// ─── Public export function ───────────────────────────────────────────────────

export interface PortfolioHoldingRow {
  ticker: string;
  name?: string;
  qty: number;
  avgPrice: number;
  cmp: number;
  sector?: string;
  buyDate?: string;
}

export interface PortfolioTransactionRow {
  date: string;
  action: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";
  ticker?: string;
  qty?: number;
  price?: number;
  amount: number;
  charges?: number;
  netPnl?: number;
  taxType?: string;
  notes?: string;
}

interface ExportOptions {
  incomeEntries: IncomeEntry[];
  savingsDeposits: SavingsDeposit[];
  savingsGoals: SavingsGoal[];
  expenses: ExpenseEntry[];
  // Portfolio (optional – Step 6)
  portfolioRows?: PortfolioHoldingRow[];
  portfolioTransactions?: PortfolioTransactionRow[];
  portfolioCashBalance?: number;
}

export async function exportFinanceExcel(opts: ExportOptions): Promise<void> {
  const {
    incomeEntries,
    savingsDeposits,
    savingsGoals,
    expenses,
    portfolioRows,
    portfolioTransactions,
    portfolioCashBalance,
  } = opts;

  // ── Sheet 1: Finance Summary ──────────────────────────────────────────────

  const now = new Date();
  const monthStr = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const sheet1Rows: Row[] = [
    ["PocketWise Finance Report", null, null, null],
    [`Generated: ${now.toLocaleString("en-IN")}`, null, null, null],
    [],
    ["INCOME ENTRIES"],
    ["Source", "Amount (₹)", "Frequency", "Date", "Notes"],
    ...incomeEntries.map((e) => [
      e.source,
      e.amount,
      e.frequency,
      e.date,
      e.notes ?? "",
    ]),
    [],
    ["SAVINGS GOALS"],
    ["Goal", "Target (₹)", "Saved (₹)", "Category", "Target Date"],
    ...savingsGoals.map((g) => [
      g.name,
      g.targetAmount,
      g.currentAmount,
      g.category,
      g.targetDate ?? "",
    ]),
    [],
    ["SAVINGS DEPOSITS"],
    ["Goal", "Amount (₹)", "Date", "Notes"],
    ...savingsDeposits.map((d) => {
      const goal = savingsGoals.find((g) => g.id === d.goalId);
      return [goal?.name ?? d.goalId, d.amount, d.date, d.notes ?? ""];
    }),
  ];

  // ── Sheet 2: Expenses ─────────────────────────────────────────────────────

  const sheet2Rows: Row[] = [
    ["EXPENSES — ALL TIME"],
    ["Date", "Description", "Amount (₹)", "Category", "Payment Mode", "Notes"],
    ...[...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((e) => [
        e.date,
        e.description,
        e.amount,
        e.category,
        e.paymentMode,
        e.notes ?? "",
      ]),
    [],
    ["SUMMARY — " + monthStr],
    ["Total Expenses", expenses.reduce((s, e) => s + e.amount, 0)],
  ];

  const sheets: SheetDef[] = [
    {
      name: "Finance Summary",
      rows: sheet1Rows,
      colWidths: [28, 15, 15, 14, 24],
    },
    {
      name: "Expenses",
      rows: sheet2Rows,
      colWidths: [14, 28, 15, 16, 14, 24],
    },
  ];

  // ── Sheet 3: Portfolio (optional) ─────────────────────────────────────────

  if (portfolioRows && portfolioRows.length > 0) {
    const holdingRows: Row[] = portfolioRows.map((h) => {
      const invested = h.avgPrice * h.qty;
      const currentVal = h.cmp * h.qty;
      const pnl = currentVal - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      const totalInvested = portfolioRows.reduce(
        (s, x) => s + x.avgPrice * x.qty,
        0
      );
      const weight =
        totalInvested > 0 ? ((invested / totalInvested) * 100).toFixed(1) : "0";
      const daysHeld = h.buyDate
        ? Math.floor(
            (Date.now() - new Date(h.buyDate).getTime()) / 86_400_000
          )
        : 0;
      return [
        h.ticker,
        h.name ?? h.ticker,
        h.qty,
        h.avgPrice,
        h.cmp,
        invested,
        currentVal,
        pnl,
        `${pnlPct.toFixed(2)}%`,
        `${weight}%`,
        h.sector ?? "",
        daysHeld,
      ];
    });

    const totalInvested = portfolioRows.reduce(
      (s, h) => s + h.avgPrice * h.qty,
      0
    );
    const totalCurrentVal = portfolioRows.reduce(
      (s, h) => s + h.cmp * h.qty,
      0
    );
    const unrealisedPnl = totalCurrentVal - totalInvested;
    const unrealisedPct =
      totalInvested > 0 ? (unrealisedPnl / totalInvested) * 100 : 0;
    const cashBal = portfolioCashBalance ?? 0;

    const txRows: Row[] = (portfolioTransactions ?? []).map((t) => [
      t.date,
      t.action,
      t.ticker ?? "",
      t.qty ?? "",
      t.price ?? "",
      t.amount,
      t.charges ?? 0,
      t.netPnl ?? 0,
      t.taxType ?? "",
      t.notes ?? "",
    ]);

    const sheet3Rows: Row[] = [
      // Section A — Holdings
      ["HOLDINGS"],
      [
        "Ticker",
        "Name",
        "Qty",
        "Avg Cost (₹)",
        "CMP (₹)",
        "Invested (₹)",
        "Current Value (₹)",
        "Unrealised P&L (₹)",
        "P&L %",
        "Weight %",
        "Sector",
        "Days Held",
      ],
      ...holdingRows,
      [],
      // Section B — Portfolio Summary
      ["PORTFOLIO SUMMARY"],
      ["Total Invested (₹)", totalInvested],
      ["Total Current Value (₹)", totalCurrentVal],
      ["Unrealised P&L (₹)", unrealisedPnl],
      ["Unrealised P&L (%)", `${unrealisedPct.toFixed(2)}%`],
      ["Broker Cash Balance (₹)", cashBal],
      ["Total Portfolio Value (₹)", totalCurrentVal + cashBal],
      [],
      // Section C — Transaction History
      ["TRANSACTION HISTORY"],
      [
        "Date",
        "Action",
        "Ticker",
        "Qty",
        "Price (₹)",
        "Amount (₹)",
        "Charges (₹)",
        "Net P&L (₹)",
        "Tax Type",
        "Notes",
      ],
      ...txRows,
    ];

    sheets.push({
      name: "Portfolio",
      rows: sheet3Rows,
      colWidths: [10, 20, 8, 13, 12, 15, 17, 18, 10, 10, 14, 10],
    });
  }

  // ── Trigger download ──────────────────────────────────────────────────────

  const blob = await buildXlsx(sheets);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PocketWise_Finance_${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
