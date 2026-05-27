import { useState, useEffect } from "react";
import { ArrowLeft, Heart, TrendingUp, TrendingDown, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useStockQuote } from "@/hooks/useStockQuote";
import { usePortfolioState } from "@/hooks/usePortfolio";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useStockNews } from "@/hooks/useStockNews";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyStockModal } from "@/components/modals/BuyStockModal";
import { StatCard } from "./StatCard";
import { formatINR, formatMarketCap, formatNumber, formatPct, formatChangePct } from "@/utils/formatters";
import { changeColorClass } from "@/utils/colorHelpers";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  symbol: string;
  onBack: () => void;
}

function TradingViewChart({ symbol, theme }: { symbol: string; theme: string }) {
  const [range, setRange] = useState("1D");
  const ranges = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
  const intervalMap: Record<string, string> = {
    "1D": "D", "1W": "W", "1M": "M", "3M": "3M", "1Y": "12M", "ALL": "60M",
  };
  const rangeMap: Record<string, string> = {
    "1D": "1D", "1W": "5D", "1M": "1M", "3M": "3M", "1Y": "12M", "ALL": "60M",
  };

  const config = encodeURIComponent(JSON.stringify({
    autosize: true,
    symbol: `NSE:${symbol}`,
    interval: intervalMap[range],
    range: rangeMap[range],
    timezone: "Asia/Kolkata",
    theme: theme === "dark" ? "dark" : "light",
    style: "1",
    locale: "en",
    hide_side_toolbar: false,
    allow_symbol_change: false,
    save_image: false,
    calendar: false,
  }));

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              range === r
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border" style={{ height: 360 }}>
        <iframe
          key={`${symbol}-${range}-${theme}`}
          src={`https://s.tradingview.com/embed-widget/advanced-chart/?locale=en#${config}`}
          className="h-full w-full border-0"
          title={`${symbol} Chart`}
          allowTransparency
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}

// FIX: was destructuring `news` but hook returns `data`
function NewsSection({ ticker }: { ticker: string }) {
  const { data: news, isLoading } = useStockNews(ticker);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-border p-3">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!news || news.length === 0) {
    return (
      <a
        href={`https://news.google.com/search?q=${encodeURIComponent(ticker + " NSE stock")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4" />
        News unavailable — tap to search on Google News
      </a>
    );
  }

  const timeAgo = (iso: string | null) => {
    if (!iso) return "";
    const diff = Date.now() - Date.parse(iso);
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="space-y-2">
      {news.slice(0, 6).map((item) => (
        <a
          key={item.uuid}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 hover:bg-accent/40 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{item.publisher}</span>
              {item.publishedAt && <><span>·</span><span>{timeAgo(item.publishedAt)}</span></>}
            </div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary mt-0.5" />
        </a>
      ))}
    </div>
  );
}

export function StockDetailPage({ symbol, onBack }: Props) {
  const { data, isLoading } = useStockQuote(symbol);
  const { portfolio, cashBalance, buy } = usePortfolioState();
  const { tickers, add, remove } = useWatchlist();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [buyOpen, setBuyOpen] = useState(false);
  const [fundamentalsOpen, setFundamentalsOpen] = useState(false);

  const isWatchlisted = tickers.includes(symbol);
  const holding = portfolio.find((h) => h.ticker === symbol);

  useEffect(() => {
    document.title = `${symbol} | Dalal Street`;
    return () => { document.title = "Dalal Street — NSE Stock Watchlist"; };
  }, [symbol]);

  const holdingSummary = (() => {
    if (!holding || !data) return null;
    const cmp = data.cmp;
    const currentValue = cmp * holding.qty;
    const invested = holding.avgPrice * holding.qty;
    const pl = currentValue - invested;
    const plPct = invested > 0 ? (pl / invested) * 100 : 0;
    return { qty: holding.qty, avgPrice: holding.avgPrice, currentValue, pl, plPct };
  })();

  const formatIN = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Sticky header */}
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
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold leading-tight">{data.name}</h1>
              <Badge variant="outline" className="font-mono text-[11px]">{symbol}</Badge>
              <Badge variant="outline" className="text-[11px]">NSE</Badge>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[26px] font-semibold tracking-tight">
                {formatINR(data.cmp)}
              </span>
              <span className={`flex items-center gap-1 text-sm font-semibold ${changeColorClass(data.dayChange)}`}>
                {data.dayChange >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {data.dayChange >= 0 ? "+" : ""}{formatINR(data.dayChange)} ({formatChangePct(data.dayChangePct)})
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => (isWatchlisted ? remove(symbol) : add(symbol))}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  isWatchlisted
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${isWatchlisted ? "fill-current" : ""}`} />
                {isWatchlisted ? "Watchlisted" : "Watchlist"}
              </button>
              <Button size="sm" className="rounded-full font-semibold" onClick={() => setBuyOpen(true)}>
                Buy
              </Button>
            </div>
          </div>
        ) : null}

        {/* SECTION 2 — TradingView Chart */}
        <div className="space-y-2">
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Chart</h2>
          <TradingViewChart symbol={symbol} theme={theme} />
        </div>

        {/* SECTION 3 — Key Stats */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : data ? (
          <div className="space-y-2">
            <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Key Stats</h2>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Market Cap" value={formatMarketCap(data.marketCap)} />
              <StatCard label="P/E Ratio" value={formatNumber(data.pe)} />
              <StatCard label="P/B Ratio" value={formatNumber(data.pb)} />
              <StatCard label="EPS (TTM)" value={data.eps == null ? "—" : formatINR(data.eps)} />
              <StatCard label="52W High" value={formatINR(data.fiftyTwoWeekHigh)} tone="gain" />
              <StatCard label="52W Low" value={formatINR(data.fiftyTwoWeekLow)} tone="loss" />
            </div>
          </div>
        ) : null}

        {/* SECTION 4 — More Fundamentals */}
        {data && (
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setFundamentalsOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-medium hover:bg-accent/40 transition-colors"
            >
              <span>More Fundamentals</span>
              {fundamentalsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {fundamentalsOpen && (
              <div className="grid grid-cols-3 gap-2 p-3 border-t border-border bg-muted/20">
                <StatCard label="Div Yield" value={formatPct(data.dividendYield, 2, 100)} />
                <StatCard label="ROE" value={formatPct(data.returnOnEquity, 2, 100)} />
                <StatCard label="Net Margin" value={formatPct(data.profitMargins, 2, 100)} />
                <StatCard label="Debt/Equity" value={data.debtToEquity == null ? "—" : formatNumber(data.debtToEquity / 100)} />
                <StatCard label="Op. Margin" value={formatPct(data.operatingMargins, 2, 100)} />
                <StatCard label="Promoter %" value={formatPct(data.heldPercentInsiders, 2, 100)} />
              </div>
            )}
          </div>
        )}

        {/* SECTION 5 — News */}
        <div className="space-y-2">
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Latest News</h2>
          <NewsSection ticker={symbol} />
        </div>

        {/* SECTION 6 — Mini Holding Summary (if also a holding) */}
        {holdingSummary && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Your Position</h2>
            <p className="text-sm">
              You hold <span className="font-semibold">{holdingSummary.qty} shares</span> @ avg{" "}
              <span className="font-mono font-semibold">₹{formatIN(holdingSummary.avgPrice)}</span>
            </p>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Current Value</div>
                <div className="font-mono font-semibold">₹{formatIN(holdingSummary.currentValue)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">P&L</div>
                <div className={`font-mono font-semibold ${holdingSummary.pl >= 0 ? "text-gain" : "text-loss"}`}>
                  {holdingSummary.pl >= 0 ? "+" : ""}₹{formatIN(holdingSummary.pl)}{" "}
                  <span className="text-xs">({holdingSummary.plPct.toFixed(2)}%)</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate({ to: "/holding/$symbol", params: { symbol } })}
              className="text-xs text-primary hover:underline font-medium"
            >
              View full holding →
            </button>
          </div>
        )}

        {/* External links */}
        <div className="flex flex-wrap gap-2 pb-4">
          <a href={`https://finance.yahoo.com/quote/${symbol}.NS`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full">
              <ExternalLink className="h-3 w-3" /> Yahoo Finance
            </Button>
          </a>
          <a href={`https://www.screener.in/company/${symbol}/consolidated/`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full">
              <ExternalLink className="h-3 w-3" /> Screener.in
            </Button>
          </a>
        </div>
      </div>

      <BuyStockModal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        cashBalance={cashBalance}
        onConfirm={(ticker, price, qty, date) => buy(ticker, price, qty, date)}
      />
    </div>
  );
}
