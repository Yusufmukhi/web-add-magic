import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Home as HomeIcon, Briefcase, LineChart, ListChecks, Receipt, CalendarRange, Settings as SettingsIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNav, type NavTab } from "@/components/layout/BottomNav";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { Navbar } from "@/components/layout/Navbar";
import { OverviewStrip } from "@/components/layout/OverviewStrip";
import { AddStockBar } from "@/components/watchlist/AddStockBar";
import { WatchlistTable } from "@/components/watchlist/WatchlistTable";
import { StockDetailPage as StockDetail } from "@/components/detail/StockDetail";
import { PortfolioPanel } from "@/components/portfolio/PortfolioPanel";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { AddFundsModal } from "@/components/modals/AddFundsModal";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { BuyStockModal } from "@/components/modals/BuyStockModal";
import { SellStockModal } from "@/components/modals/SellStockModal";
import { EditHoldingModal } from "@/components/modals/EditHoldingModal";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { AnalyticsPanel } from "@/components/analytics/AnalyticsPanel";
import { PlanningPanel } from "@/components/planning/PlanningPanel";
import { PriceAlertsButton } from "@/components/alerts/PriceAlertsButton";
import { SettingsPanel, type BackupShape } from "@/components/settings/SettingsPanel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useStockQuote, useStockQuotes } from "@/hooks/useStockQuote";
import { usePortfolioState } from "@/hooks/usePortfolio";
import { xirr } from "@/utils/finance";
import type { Holding } from "@/types/portfolio.types";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) ?? "watchlist",
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { tab } = Route.useSearch();
  const { tickers, add, remove, clearAll: clearWatchlist, replaceAll: replaceWatchlist, hydrated } = useWatchlist();
  const results = useStockQuotes(tickers);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedQuery = useStockQuote(selected);

  const {
    portfolio, transactions, cashBalance,
    addFunds, withdrawFunds, buy, sell,
    editHolding, deleteHolding, resetPortfolio, replaceState,
  } = usePortfolioState();

  const [modal, setModal] = useState<"add" | "withdraw" | "buy" | "sell" | null>(null);
  const [sellPrefill, setSellPrefill] = useState<string | null>(null);
  const [portfolioPrices, setPortfolioPrices] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<NavTab>(tab as NavTab ?? "watchlist");

  // Edit / delete state
  const [editing, setEditing] = useState<Holding | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Quotes used by alerts checker (portfolio + watchlist)
  const portfolioTickers = useMemo(() => portfolio.map((h) => h.ticker), [portfolio]);
  const portfolioQuotes = useStockQuotes(portfolioTickers);
  const alertsQuotes = useMemo(() => [...results, ...portfolioQuotes], [results, portfolioQuotes]);

  const handleAdd = (t: string) => {
    const ok = add(t);
    if (ok) toast.success(`${t} added to watchlist`);
    else toast.error(`${t} is already in your watchlist`);
  };

  const handleRemove = (t: string) => {
    remove(t);
    if (selected === t) setSelected(null);
    toast(`${t} removed`);
  };

  const handleBuy = useCallback(
    (ticker: string, price: number, qty: number, date: string) => {
      const ok = buy(ticker, price, qty, date);
      if (!ok) { toast.error("Insufficient cash balance"); return false; }
      if (!tickers.includes(ticker)) add(ticker);
      toast.success(`Bought ${qty} × ${ticker} @ ₹${price.toFixed(2)}`);
      return true;
    },
    [buy, tickers, add]
  );

  const handleSell = useCallback(
    (ticker: string, price: number, qty: number, date: string, charges: number) => {
      const ok = sell(ticker, price, qty, date, charges);
      if (!ok) { toast.error("Sell failed"); return false; }
      const pl = portfolio.find((h) => h.ticker === ticker);
      const profit = pl ? (price - pl.avgPrice) * qty - charges : 0;
      toast.success(`Sold ${qty} × ${ticker} | Net P&L: ${profit >= 0 ? "+" : ""}₹${profit.toFixed(2)}`);
      return true;
    },
    [sell, portfolio]
  );

  const handlePricesChange = useCallback((newPrices: Record<string, number>) => {
    setPortfolioPrices(prev => {
      const keys = Object.keys(newPrices);
      if (keys.length !== Object.keys(prev).length) return newPrices;
      for (const k of keys) {
        if (prev[k] !== newPrices[k]) return newPrices;
      }
      return prev;
    });
  }, []);

  const handleImportHoldings = useCallback(
    (rows: { ticker: string; qty: number; price: number; date: string }[]) => {
      const need = rows.reduce((a, r) => a + r.qty * r.price, 0);
      if (need > cashBalance) addFunds(need - cashBalance);
      rows.forEach((r) => {
        buy(r.ticker, r.price, r.qty, r.date);
        if (!tickers.includes(r.ticker)) add(r.ticker);
      });
    },
    [cashBalance, addFunds, buy, tickers, add]
  );

  const handleEditRequest = useCallback(
    (ticker: string) => {
      const h = portfolio.find((p) => p.ticker === ticker);
      if (h) setEditing(h);
    },
    [portfolio]
  );

  const handleEditConfirm = useCallback(
    (ticker: string, patch: { qty: number; avgPrice: number; buyDate: string }) => {
      const ok = editHolding(ticker, patch);
      if (ok) toast.success(`${ticker} updated`);
      else toast.error("Edit failed");
    },
    [editHolding]
  );

  const handleDeleteConfirmed = useCallback(() => {
    if (!pendingDelete) return;
    deleteHolding(pendingDelete);
    toast.success(`${pendingDelete} deleted`);
    setPendingDelete(null);
  }, [pendingDelete, deleteHolding]);

  const handleImportBackup = useCallback(
    (data: BackupShape) => {
      replaceState({
        portfolio: data.portfolio,
        transactions: data.transactions,
        cashBalance: data.cashBalance,
      });
      replaceWatchlist(data.watchlist);
    },
    [replaceState, replaceWatchlist]
  );

  const { current, realized, cagr } = useMemo(() => {
    let inv = 0, cur = 0;
    portfolio.forEach((h) => {
      const cp = portfolioPrices[h.ticker] ?? h.avgPrice;
      inv += h.avgPrice * h.qty;
      cur += cp * h.qty;
    });
    const real = transactions.reduce(
      (a, t) => (t.action === "SELL" && t.meta?.profit != null ? a + t.meta.profit : a),
      0
    );
    // Money-weighted CAGR (XIRR) — works even when all stocks are sold.
    // BUYs = outflow (negative), SELLs (net of charges) = inflow (positive),
    // current MV of open holdings = terminal inflow today.
    const flows: number[] = [];
    const dates: string[] = [];
    const sortedTx = [...transactions]
      .filter((t) => (t.action === "BUY" || t.action === "SELL") && t.date)
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    sortedTx.forEach((t) => {
      if (t.action === "BUY") { flows.push(-t.amount); dates.push(t.date); }
      else if (t.action === "SELL") { flows.push(t.amount); dates.push(t.date); }
    });
    if (cur > 0) {
      flows.push(cur);
      dates.push(new Date().toISOString().slice(0, 10));
    }
    let c: number | null = null;
    if (flows.length >= 2) {
      const r = xirr(flows, dates);
      if (r != null && isFinite(r)) c = r * 100;
    }
    return { current: cur, realized: real, cagr: c };
  }, [portfolio, portfolioPrices, transactions]);

  const portfolioValue = current + cashBalance;

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Navbar rightSlot={<PriceAlertsButton quotes={alertsQuotes} />} />
      <main className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-6 sm:py-6">
        <section className="space-y-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight creative:bg-gradient-to-r creative:from-foreground creative:to-primary creative:bg-clip-text creative:text-transparent sm:text-3xl">
              Dalal Street
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Your portfolio, watchlist, and analytics — all in one tape.
            </p>
          </div>
          <OverviewStrip
            portfolio={portfolio}
            portfolioQuotes={portfolioQuotes}
            cashBalance={cashBalance}
            realized={realized}
            cagr={cagr}
          />
        </section>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NavTab)} className="space-y-5">
          <div className="sticky top-0 z-10 -mx-3 hidden overflow-x-auto bg-background/95 px-3 py-1 backdrop-blur md:block sm:-mx-6 sm:px-6">
            <TabsList className="inline-flex h-auto w-max bg-card creative:shadow-soft minimal:rounded-none minimal:border-b minimal:border-border minimal:bg-transparent minimal:p-0">
              <TabsTrigger value="home" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
                <HomeIcon className="h-3.5 w-3.5" /> Home
              </TabsTrigger>
              <TabsTrigger value="portfolio" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
                <Briefcase className="h-3.5 w-3.5" /> Portfolio
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
                <ListChecks className="h-3.5 w-3.5" /> Watchlist
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
                <LineChart className="h-3.5 w-3.5" /> Analytics
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
                <Receipt className="h-3.5 w-3.5" /> Transactions
              </TabsTrigger>
              <TabsTrigger value="planning" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
                <CalendarRange className="h-3.5 w-3.5" /> Planning
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
                <SettingsIcon className="h-3.5 w-3.5" /> Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="home">
            <HomeDashboard
              portfolio={portfolio}
              portfolioQuotes={portfolioQuotes}
              watchlistTickers={tickers}
              cashBalance={cashBalance}
              transactions={transactions}
              onGoTo={(t) => setActiveTab(t)}
              onAddStock={() => setActiveTab("watchlist")}
              onBuy={() => setModal("buy")}
              onAddFunds={() => setModal("add")}
            />
          </TabsContent>


          <TabsContent value="portfolio">
            <PortfolioPanel
              portfolio={portfolio}
              transactions={transactions}
              cashBalance={cashBalance}
              onAddFunds={() => setModal("add")}
              onWithdraw={() => setModal("withdraw")}
              onBuy={() => setModal("buy")}
              onSell={(t) => { setSellPrefill(t ?? null); setModal("sell"); }}
              onPricesChange={handlePricesChange}
              onImportHoldings={handleImportHoldings}
              onEditHolding={handleEditRequest}
              onDeleteHolding={(t) => setPendingDelete(t)}
            />
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-4">
            <AddStockBar onAdd={handleAdd} />
            {hydrated && (
              <WatchlistTable
                results={results}
                onRemove={handleRemove}
                onSelect={(t) => setSelected((c) => (c === t ? null : t))}
                selected={selected}
              />
            )}
            <StockDetail
              ticker={selected}
              data={selectedQuery.data}
              isLoading={selectedQuery.isLoading}
              onClose={() => setSelected(null)}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsPanel portfolio={portfolio} results={results} />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionsTable transactions={transactions} />
          </TabsContent>

          <TabsContent value="planning">
            <PlanningPanel
              prices={portfolioPrices}
              portfolioValue={portfolioValue}
              transactions={transactions}
            />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel
              portfolio={portfolio}
              transactions={transactions}
              cashBalance={cashBalance}
              watchlist={tickers}
              onResetPortfolio={resetPortfolio}
              onClearWatchlist={clearWatchlist}
              onImportBackup={handleImportBackup}
              onAddFunds={(amt) => { addFunds(amt); }}
              onWithdraw={(amt) => { withdrawFunds(amt); }}
            />
          </TabsContent>
        </Tabs>
      </main>

      <AddFundsModal
        open={modal === "add"}
        onClose={() => setModal(null)}
        cashBalance={cashBalance}
        onConfirm={(amt, note) => { addFunds(amt, note); toast.success(`Added ₹${amt.toFixed(2)}`); }}
      />
      <WithdrawModal
        open={modal === "withdraw"}
        onClose={() => setModal(null)}
        cashBalance={cashBalance}
        onConfirm={(amt, note) => { const ok = withdrawFunds(amt, note); if (ok) toast.success(`Withdrew ₹${amt.toFixed(2)}`); return ok; }}
      />
      <BuyStockModal
        open={modal === "buy"}
        onClose={() => setModal(null)}
        cashBalance={cashBalance}
        onConfirm={handleBuy}
      />
      <SellStockModal
        open={modal === "sell"}
        onClose={() => { setModal(null); setSellPrefill(null); }}
        portfolio={portfolio}
        prices={portfolioPrices}
        prefillTicker={sellPrefill}
        onConfirm={handleSell}
      />

      <EditHoldingModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        holding={editing}
        onConfirm={handleEditConfirm}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirmed}
        title={`Delete ${pendingDelete ?? ""}?`}
        description="This removes the holding row from your portfolio. Past transactions are kept, and your cash balance is NOT refunded."
        confirmWord={pendingDelete ?? ""}
        confirmLabel="Delete holding"
      />

      <BottomNav value={activeTab} onChange={setActiveTab} />
    </div>
  );
}
