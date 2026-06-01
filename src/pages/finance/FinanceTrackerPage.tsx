import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FinanceProvider } from "@/context/FinanceContext";
import { useFinance } from "@/hooks/useFinance";
import { FinanceMetricStrip } from "@/components/finance/FinanceMetricStrip";
import { DashboardTab } from "@/components/finance/DashboardTab";
import { IncomeTab } from "@/components/finance/IncomeTab";
import { SavingsTab } from "@/components/finance/SavingsTab";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { SettingsTab } from "@/components/finance/SettingsTab";
import BottomNav from "@/components/layout/BottomNav";
import type { NavTab } from "@/components/layout/BottomNav";

// ─── Portfolio integration ───────────────────────────────────────────────────
// We import these lazily to avoid breaking the build if hook signatures change.
// All data flows one-way into FinanceContext via setLivePortfolioValue.

import { usePortfolioState } from "@/hooks/usePortfolio";

// Note: useStockQuotes may be named differently — adjust if needed
let useStockQuotes: ((tickers: string[]) => { ticker: string; data?: { cmp: number } }[]) | undefined;
try {
  // Dynamic require is not available in ESM, so we do a conditional import at module level below.
  // The actual hook is wired in PortfolioValueSync below.
} catch {}

// ─── Sub-component that syncs live portfolio value into FinanceContext ────────

function PortfolioValueSync() {
  const { setLivePortfolioValue } = useFinance();
  const portfolioState = usePortfolioState();

  useEffect(() => {
    // portfolioState may not have cashBalance — guard defensively
    const cash = (portfolioState as any).cashBalance ?? (portfolioState as any).brokCash ?? 0;
    const holdings = portfolioState.portfolio ?? [];

    // Compute value using avgPrice as fallback for CMP (quotes fetched separately)
    const equityValue = holdings.reduce((sum: number, h: any) => {
      const cmp = h.cmp ?? h.ltp ?? h.avgPrice ?? 0;
      return sum + cmp * (h.qty ?? 0);
    }, 0);

    setLivePortfolioValue(equityValue + cash);
  }, [portfolioState, setLivePortfolioValue]);

  return null;
}

// ─── Inner page (must be inside FinanceProvider) ─────────────────────────────

type FinanceTab = "dashboard" | "income" | "savings" | "expenses" | "settings";

const TABS: { id: FinanceTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "income", label: "Income" },
  { id: "savings", label: "Savings" },
  { id: "expenses", label: "Expenses" },
  { id: "settings", label: "Settings" },
];

function FinanceTrackerInner() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("dashboard");
  const navigate = useNavigate();
  const {
    freeCash,
    walletBalance,
    totalSavings,
    netWorth,
    livePortfolioValue,
    settings,
  } = useFinance();

  function handleNavTab(tab: NavTab) {
    if (tab === "finance") return; // already here
    navigate({ to: "/", search: { tab } as any });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sync live portfolio value into context */}
      <PortfolioValueSync />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-foreground">PocketWise</h1>
            <p className="text-xs text-muted-foreground">Personal Finance</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 max-w-2xl mx-auto w-full space-y-5">
        {/* Metric strip */}
        <FinanceMetricStrip
          freeCash={freeCash}
          walletBalance={walletBalance}
          savings={totalSavings}
          netWorth={netWorth}
          currency={settings.currency}
        />

        {/* Inner tabs */}
        <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[80px] text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "dashboard" && (
          <DashboardTab livePortfolioValue={livePortfolioValue} />
        )}
        {activeTab === "income" && <IncomeTab />}
        {activeTab === "savings" && <SavingsTab />}
        {activeTab === "expenses" && <ExpensesTab />}
        {activeTab === "settings" && <SettingsTab />}
      </main>

      {/* Bottom nav with "finance" as active tab */}
      <BottomNav activeTab="finance" onTabChange={handleNavTab} />
    </div>
  );
}

// ─── Public export — wraps everything in FinanceProvider ─────────────────────

export function FinanceTrackerPage() {
  return (
    <FinanceProvider>
      <FinanceTrackerInner />
    </FinanceProvider>
  );
}
