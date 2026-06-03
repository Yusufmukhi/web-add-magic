import * as XLSX from "xlsx";
import type {
  IncomeEntry,
  Limits,
  SavingsEntry,
  SpendEntry,
  WalletAllocation,
} from "@/lib/finance/types";

type Totals = {
  income: number;
  savings: number;
  spends: number;
  freeCash: number;
  walletBalance: number;
  netWorth: number;
};

type ExportInput = {
  income: IncomeEntry[];
  savings: SavingsEntry[];
  wallet: WalletAllocation[];
  spends: SpendEntry[];
  limits: Limits;
  monthlySpendByCategory: Record<string, number>;
  expenseCategories: string[];
  portfolioValue: number;
  totals: Totals;
};

function statusOf(pct: number): string {
  if (pct > 100) return "Over Budget";
  if (pct >= 90) return "Near Limit";
  if (pct >= 70) return "Warning";
  return "On Track";
}

export function exportFinanceExcel(d: ExportInput): void {
  const wb = XLSX.utils.book_new();

  // ---------------- Sheet 1: Budget Summary ----------------
  const s1: (string | number | null)[][] = [];
  s1.push(["Personal Finance — Budget Summary"]);
  s1.push([`Generated: ${new Date().toLocaleString()}`]);
  s1.push([]);
  s1.push(["OVERALL TOTALS"]);
  s1.push(["Total Income", d.totals.income]);
  s1.push(["Total Savings", d.totals.savings]);
  s1.push(["Total Expenses (Logged)", d.totals.spends]);
  s1.push(["Free Cash", d.totals.freeCash]);
  s1.push(["Spending Wallet Balance", d.totals.walletBalance]);
  s1.push(["Portfolio Value", d.portfolioValue]);
  s1.push(["Net Worth", d.totals.netWorth]);
  s1.push([]);

  s1.push(["INCOME BY CATEGORY"]);
  s1.push(["Category", "Total (₹)"]);
  const incByCat: Record<string, number> = {};
  d.income.forEach((i) => (incByCat[i.category] = (incByCat[i.category] ?? 0) + i.amount));
  Object.entries(incByCat).forEach(([c, v]) => s1.push([c, v]));
  s1.push([]);

  s1.push(["SAVINGS BY CATEGORY"]);
  s1.push(["Category", "Total (₹)"]);
  const savByCat: Record<string, number> = {};
  d.savings.forEach((s) => (savByCat[s.category] = (savByCat[s.category] ?? 0) + s.amount));
  Object.entries(savByCat).forEach(([c, v]) => s1.push([c, v]));
  s1.push([]);

  s1.push(["EXPENSES BY CATEGORY"]);
  s1.push(["Category", "Total (₹)"]);
  const expByCat: Record<string, number> = {};
  d.spends.forEach((s) => (expByCat[s.category] = (expByCat[s.category] ?? 0) + s.amount));
  Object.entries(expByCat).forEach(([c, v]) => s1.push([c, v]));
  s1.push([]);

  s1.push(["SPENDING LIMITS COMPLIANCE (THIS MONTH)"]);
  s1.push(["Category", "Limit (₹)", "Spent (₹)", "% Used", "Status"]);
  d.expenseCategories.forEach((cat) => {
    const limit = d.limits[cat] ?? 0;
    const spent = d.monthlySpendByCategory[cat] ?? 0;
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    s1.push([cat, limit, spent, Number(pct.toFixed(1)), limit > 0 ? statusOf(pct) : "—"]);
  });
  s1.push([]);

  s1.push(["CHART DATA — INCOME vs SAVINGS vs EXPENSES vs FREE CASH"]);
  s1.push(["Metric", "Amount (₹)"]);
  s1.push(["Income", d.totals.income]);
  s1.push(["Savings", d.totals.savings]);
  s1.push(["Expenses", d.totals.spends]);
  s1.push(["Free Cash", d.totals.freeCash]);
  s1.push([]);

  s1.push(["CHART DATA — EXPENSE BREAKDOWN (CURRENT MONTH)"]);
  s1.push(["Category", "Amount (₹)"]);
  Object.entries(d.monthlySpendByCategory).forEach(([c, v]) => s1.push([c, v]));

  const ws1 = XLSX.utils.aoa_to_sheet(s1);
  ws1["!cols"] = [{ wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Budget Summary");

  // ---------------- Sheet 2: Full Transaction History ----------------
  type Row = {
    Date: string;
    Type: string;
    "Category/Label": string;
    "Amount (₹)": number;
    Description: string;
    "Source/Notes": string;
  };
  const rows: Row[] = [];
  d.income.forEach((i) =>
    rows.push({
      Date: i.date,
      Type: "Income",
      "Category/Label": i.category,
      "Amount (₹)": i.amount,
      Description: i.description ?? "",
      "Source/Notes": "",
    }),
  );
  d.savings.forEach((s) =>
    rows.push({
      Date: s.date,
      Type: "Savings",
      "Category/Label": s.category,
      "Amount (₹)": s.amount,
      Description: s.description ?? "",
      "Source/Notes": s.source === "allocate" ? "From Free Cash" : "New Cash",
    }),
  );
  d.wallet.forEach((w) =>
    rows.push({
      Date: w.date,
      Type: "Wallet Allocation",
      "Category/Label": w.label,
      "Amount (₹)": w.amount,
      Description: w.description ?? "",
      "Source/Notes": "",
    }),
  );
  d.spends.forEach((s) => {
    const w = d.wallet.find((x) => x.id === s.walletId);
    rows.push({
      Date: s.date,
      Type: "Expense",
      "Category/Label": s.category,
      "Amount (₹)": s.amount,
      Description: s.description ?? "",
      "Source/Notes": w ? `From wallet: ${w.label}` : "",
    });
  });
  rows.sort((a, b) => (a.Date < b.Date ? 1 : -1));

  const ws2 = XLSX.utils.json_to_sheet(rows, {
    header: ["Date", "Type", "Category/Label", "Amount (₹)", "Description", "Source/Notes"],
  });
  ws2["!cols"] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 26 },
    { wch: 14 },
    { wch: 30 },
    { wch: 28 },
  ];

  // Color-code rows by type using cell fills (header row index 0)
  const fillBy: Record<string, string> = {
    Income: "DCFCE7", // green
    Savings: "DBEAFE", // blue
    "Wallet Allocation": "FEF9C3", // yellow
    Expense: "FEE2E2", // red
  };
  rows.forEach((r, idx) => {
    const excelRow = idx + 2;
    const fill = fillBy[r.Type];
    if (!fill) return;
    for (let col = 0; col < 6; col++) {
      const addr = XLSX.utils.encode_cell({ r: excelRow - 1, c: col });
      const cell = ws2[addr];
      if (!cell) continue;
      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: fill } },
      };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws2, "Full Transaction History");

  const filename = `finance-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
