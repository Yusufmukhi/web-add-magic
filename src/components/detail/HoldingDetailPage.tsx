import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, ShoppingCart, TrendingDown as SellIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useStockQuote } from "@/hooks/useStockQuote";
import { usePortfolioState } from "@/hooks/usePortfolio";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyStockModal } from "@/components/modals/BuyStockModal";
import { SellStockModal } from "@/components/modals/SellStockModal";
import { StatCard } from "./StatCard";
import { formatINR, formatMarketCap, formatNumber, formatPct, formatChangePct } from "@/utils/formatters";
import { changeColorClass } from "@/utils/colorHelpers";
import { xirr } from "@/utils/finance";
import type { Transaction } from "@/types/portfolio.types";

interface Props {
  symbol: string;
  onBack: () => void;
}

function TradingViewChartMini({ symbol, theme }: { symbol: string; theme: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border" style={{ height: 280 }}>
      <iframe
        src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_mini&symbol=NSE%3A${symbol}&interval=D&hidesidetoolbar=1&hidetoptoolbar=0&theme=${theme === "dark" ? "dark" : "light"}&style=1&timezone=Asia%2FKolkata&withdateranges=0&showpopupbutton=0&locale=en`}
        className="h-full w-full border-0"
        title={`${symbol} Mini Chart`}
        allowTransparency
      />
    </div>
  );
}

export function HoldingDetailPage({ symbol, onBack }: Props) {
  const { data, isLoading } = useStockQuote(symbol);
  const { portfolio, transactions, cashBalance, buy, sell } = usePortfolioState();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const holding = portfolio.find((h) => h.ticker === symbol);
  const stockTxns = useMemo(
    () => transactions.filter((t) => t.stock === symbol).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [transactions, symbol]
  );

  useEffect(() => {
    document.title = `${symbol} Holding | Dalal Street`;
    return () => { document.title = "Dalal Street — NSE Stock Watchlist"; };
  }, [symbol]);

  const cmp = data?.cmp ?? holding?.avgPrice ?? 0;

  const stats = useMemo(() => {
    if (!holding) return null;
    const invested = holding.avgPrice * holding.qty;
    const currentValue = cmp * holding.qty;
    const pl = currentValue - invested;
    const plPct = invested > 0 ? (pl / invested) * 100 : 0;

    // CAGR
    let cagrVal: number | null = null;
    const flows: number[] = [];
    const dates: string[] = [];
    const sorted = [...stockTxns]
      .filter((t) => (t.action === "BUY" || t.action === "SELL") && t.date)
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    sorted.forEach((t) => {
      if (t.action === "BUY") { flows.push(-t.amount); dates.push(t.date); }
      else if (t.action === "SELL") { flows.push(t.amount); dates.push(t.date); }
    });
    const today = new Date().toISOString().slice(0, 10);
    if (currentValue > 0) { flows.push(currentValue); dates.push(today); }
    if (flows.length >= 2) {
      const r = xirr(flows, dates);
      if (r != null && isFinite(r)) cagrVal = r * 100;
    }

    const realized = stockTxns.reduce((a, t) => t.action === "SELL" && t.meta?.profit != null ? a + t.meta.profit : a, 0);

    return { invested, currentValue, pl, plPct, cagr: cagrVal, realized };
  }, [holding, cmp, stockTxns]);

  const formatIN = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const prices = useMemo(() => {
    const m: Record<string, number> = {};
    if (data) m[symbol] = data.cmp;
    return m;
  }, [data, symbol]);

  return (
    <div className="min-h-screen pb-24 bg-background page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-bold truncate">{symbol}</div>
          {data && <div className="text-xs text-muted-foreground truncate">{data.name}</div>}
        </div>
        {data && (
          <div className="text-right">
            <div className="font-mono text-base font-bold">{formatINR(data.cmp)}</div>
            <div className={`text-xs font-semibold ${changeColorClass(data.dayChange)}`}>
              {formatChangePct(data.dayChangePct)}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-6">
        {/* SECTION 1 — Header */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
          ) : data ? (
            <>
              <div>
                <h1 className="text-xl font-bold">{data.name}</h1>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-mono text-[26px] font-semibold tracking-tight">{formatINR(data.cmp)}</span>
                  <span className={`flex items-center gap-1 text-sm font-semibold ${changeColorClass(data.dayChange)}`}>
                    {data.dayChange >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {formatChangePct(data.dayChangePct)}
                  </span>
                </div>
              </div>
            </>
          ) : null}

          {!holding ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
              No holding found for {symbol}.
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 rounded-full font-semibold flex-1" onClick={() => setBuyOpen(true)}>
                <ShoppingCart className="h-3.5 w-3.5" /> Buy More
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-full font-semibold flex-1" onClick={() => setSellOpen(true)}>
                <SellIcon className="h-3.5 w-3.5" /> Sell
              </Button>
            </div>
          )}
        </div>

        {/* SECTION 2 — Position Summary */}
        {holding && stats && (
          <div className="space-y-2">
            <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Position</h2>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Quantity" value={String(holding.qty)} />
              <StatCard label="Avg Buy Price" value={formatINR(holding.avgPrice)} />
              <StatCard label="CMP" value={formatINR(cmp)} />
              <StatCard label="Invested" value={`₹${formatIN(stats.invested)}`} />
              <StatCard label="Current Value" value={`₹${formatIN(stats.currentValue)}`} />
              <StatCard
                label="Unrealized P&L"
                value={`${stats.pl >= 0 ? "+" : ""}₹${formatIN(stats.pl)} (${stats.plPct.toFixed(2)}%)`}
                tone={stats.pl >= 0 ? "gain" : "loss"}
              />
              {stats.cagr !== null && (
                <StatCard
                  label="CAGR"
                  value={`${stats.cagr >= 0 ? "+" : ""}${stats.cagr.toFixed(2)}%`}
                  tone={stats.cagr >= 0 ? "gain" : "loss"}
                />
              )}
              {holding.buyDate && (
                <StatCard label="First Purchase" value={holding.buyDate} />
              )}
            </div>
          </div>
        )}

        {/* SECTION 3 — Transaction History */}
        <div className="space-y-2">
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Transactions</h2>
          {stockTxns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
              No transactions yet.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              {stockTxns.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold px-2 ${
                      t.action === "BUY"
                        ? "border-gain/40 bg-gain/10 text-gain"
                        : "border-loss/40 bg-loss/10 text-loss"
                    }`}
                  >
                    {t.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{t.date}</div>
                    {t.qty && t.price && (
                      <div className="text-sm">
                        {t.qty} × <span className="font-mono">{formatINR(t.price)}</span>
                      </div>
                    )}
                    {t.meta?.note && <div className="text-xs text-muted-foreground truncate">{t.meta.note}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold">₹{formatIN(t.amount)}</div>
                    {t.action === "SELL" && t.meta?.profit != null && (
                      <div className={`text-xs font-mono ${t.meta.profit >= 0 ? "text-gain" : "text-loss"}`}>
                        {t.meta.profit >= 0 ? "+" : ""}₹{formatIN(t.meta.profit)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 4 — Chart + Fundamentals */}
        <div className="space-y-2">
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Chart</h2>
          <TradingViewChartMini symbol={symbol} theme={theme} />
        </div>

        {data && (
          <div className="space-y-2">
            <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Fundamentals</h2>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Market Cap" value={formatMarketCap(data.marketCap)} />
              <StatCard label="P/E" value={formatNumber(data.pe)} />
              <StatCard label="P/B" value={formatNumber(data.pb)} />
              <StatCard label="ROE" value={formatPct(data.returnOnEquity, 2, 100)} />
              <StatCard label="52W High" value={formatINR(data.fiftyTwoWeekHigh)} tone="gain" />
              <StatCard label="52W Low" value={formatINR(data.fiftyTwoWeekLow)} tone="loss" />
            </div>
          </div>
        )}

        {/* SECTION 5 — Realized P&L */}
        {stats && stats.realized !== 0 && (
          <div className="space-y-2">
            <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Realized P&L</h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Realized Gain/Loss</span>
                <span className={`font-mono font-semibold ${stats.realized >= 0 ? "text-gain" : "text-loss"}`}>
                  {stats.realized >= 0 ? "+" : ""}₹{formatIN(stats.realized)}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {stockTxns.filter((t) => t.action === "SELL" && t.meta?.profit != null).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t.date} · {t.qty} shares @ {formatINR(t.price ?? 0)}</span>
                    <span className={`font-mono ${(t.meta?.profit ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                      {(t.meta?.profit ?? 0) >= 0 ? "+" : ""}₹{formatIN(t.meta?.profit ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* View on stock page */}
        <button
          onClick={() => navigate({ to: "/stock/$symbol", params: { symbol } })}
          className="text-sm text-primary hover:underline font-medium"
        >
          View full stock details →
        </button>
      </div>

      <BuyStockModal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        cashBalance={cashBalance}
        onConfirm={(ticker, price, qty, date) => buy(ticker, price, qty, date)}
      />
      <SellStockModal
        open={sellOpen}
        onClose={() => setSellOpen(false)}
        portfolio={portfolio}
        prices={prices}
        prefillTicker={symbol}
        onConfirm={(ticker, price, qty, date, charges) => sell(ticker, price, qty, date, charges)}
      />
    </div>
  );
}
