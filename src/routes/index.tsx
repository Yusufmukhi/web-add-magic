import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Briefcase, LineChart, ListChecks, Receipt, Archive, Repeat, Target, Coins, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/layout/Navbar";
import { PortfolioSummary } from "@/components/layout/PortfolioSummary";
import { AddStockBar } from "@/components/watchlist/AddStockBar";
import { WatchlistTable } from "@/components/watchlist/WatchlistTable";
import { StockDetail } from "@/components/detail/StockDetail";
import { PortfolioPanel } from "@/components/portfolio/PortfolioPanel";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { AddFundsModal } from "@/components/modals/AddFundsModal";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { BuyStockModal } from "@/components/modals/BuyStockModal";
import { SellStockModal } from "@/components/modals/SellStockModal";
import { AnalyticsPanel } from "@/components/analytics/AnalyticsPanel";
import { SoldStocksPanel } from "@/components/sold/SoldStocksPanel";
import { SIPPanel } from "@/components/sip/SIPPanel";
import { GoalsPanel } from "@/components/goals/GoalsPanel";
import { DividendsPanel } from "@/components/dividends/DividendsPanel";
import { TaxReportPanel } from "@/components/tax/TaxReportPanel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useStockQuote, useStockQuotes } from "@/hooks/useStockQuote";
import { usePortfolioState } from "@/hooks/usePortfolio";

export const Route = createFileRoute("/")({ component: WatchlistPage });

function WatchlistPage() {
  const { tickers, add, remove, hydrated } = useWatchlist();
  const results = useStockQuotes(tickers);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedQuery = useStockQuote(selected);

  const {
    portfolio, transactions, cashBalance,
    addFunds, withdrawFunds, buy, sell,
  } = usePortfolioState();

  const [modal, setModal] = useState<"add" | "withdraw" | "buy" | "sell" | null>(null);
  const [sellPrefill, setSellPrefill] = useState<string | null>(null);
  const [portfolioPrices, setPortfolioPrices] = useState<Record<string, number>>({});

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
    (ticker: string, price: number, qty: number, date: string) => {
      const ok = sell(ticker, price, qty, date);
      if (!ok) { toast.error("Sell failed"); return false; }
      const pl = portfolio.find((h) => h.ticker === ticker);
      const profit = pl ? (price - pl.avgPrice) * qty : 0;
      toast.success(`Sold ${qty} × ${ticker} | P&L: ${profit >= 0 ? "+" : ""}₹${profit.toFixed(2)}`);
      return true;
    },
    [sell, portfolio]
  );

  // ✅ FIXED: Smart setter that only updates state when prices actually change
  const handlePricesChange = useCallback((newPrices: Record<string, number>) => {
    setPortfolioPrices(prev => {
      const keys = Object.keys(newPrices);
      if (keys.length !== Object.keys(prev).length) return newPrices;
      for (const k of keys) {
        if (prev[k] !== newPrices[k]) return newPrices;
      }
      return prev; // same values = same reference = no re-render
    });
  }, []);

  const portfolioValue = useMemo(() => {
    let v = cashBalance || 0;
    for (const h of portfolio) v += (portfolioPrices[h.ticker] ?? h.avgPrice) * h.qty;
    return v;
  }, [portfolio, portfolioPrices, cashBalance]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="space-y-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight creative:bg-gradient-to-r creative:from-foreground creative:to-primary creative:bg-clip-text creative:text-transparent sm:text-4xl">
              Dalal Street
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              NSE watchlist, portfolio, and transaction history — all in one tape.
            </p>
          </div>
          <PortfolioSummary results={results} />
        </section>

        <Tabs defaultValue="watchlist" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto bg-card creative:shadow-soft minimal:rounded-none minimal:border-b minimal:border-border minimal:bg-transparent minimal:p-0">
            <TabsTrigger value="watchlist" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <ListChecks className="h-3.5 w-3.5" /> Watchlist
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <Briefcase className="h-3.5 w-3.5" /> Portfolio
            </TabsTrigger>
            <TabsTrigger value="sold" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <Archive className="h-3.5 w-3.5" /> Sold
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <Receipt className="h-3.5 w-3.5" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <LineChart className="h-3.5 w-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="sip" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <Repeat className="h-3.5 w-3.5" /> SIP
            </TabsTrigger>
            <TabsTrigger value="goals" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <Target className="h-3.5 w-3.5" /> Goals
            </TabsTrigger>
            <TabsTrigger value="dividends" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <Coins className="h-3.5 w-3.5" /> Dividends
            </TabsTrigger>
            <TabsTrigger value="tax" className="gap-1.5 minimal:rounded-none minimal:border-b-2 minimal:border-transparent minimal:bg-transparent minimal:data-[state=active]:border-primary minimal:data-[state=active]:bg-transparent minimal:data-[state=active]:shadow-none">
              <FileText className="h-3.5 w-3.5" /> Tax
            </TabsTrigger>
          </TabsList>

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
            />
          </TabsContent>

          <TabsContent value="sold">
            <SoldStocksPanel transactions={transactions} />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionsTable transactions={transactions} />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsPanel portfolio={portfolio} results={results} />
          </TabsContent>

          <TabsContent value="sip">
            <SIPPanel prices={portfolioPrices} />
          </TabsContent>

          <TabsContent value="goals">
            <GoalsPanel portfolioValue={portfolioValue} />
          </TabsContent>

          <TabsContent value="dividends">
            <DividendsPanel />
          </TabsContent>

          <TabsContent value="tax">
            <TaxReportPanel transactions={transactions} />
          </TabsContent>
        </Tabs>

        <footer className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">/</kbd> to focus search.
          Data via Yahoo Finance.
        </footer>
      </main>

      <AddFundsModal
        open={modal === "add"}
        onClose={() => setModal(null)}
        cashBalance={cashBalance}
        onConfirm={(amt) => { addFunds(amt); toast.success(`Added ₹${amt.toFixed(2)}`); }}
      />
      <WithdrawModal
        open={modal === "withdraw"}
        onClose={() => setModal(null)}
        cashBalance={cashBalance}
        onConfirm={(amt) => { const ok = withdrawFunds(amt); if (ok) toast.success(`Withdrew ₹${amt.toFixed(2)}`); return ok; }}
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
    </div>
  );
}
