import { ExternalLink, RefreshCw, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { StockQuote } from "@/types/stock.types";
import {
  formatINR,
  formatMarketCap,
  formatNumber,
  formatPct,
  formatChangePct,
} from "@/utils/formatters";
import {
  calculateRating,
  changeColorClass,
  sectorBadgeClass,
} from "@/utils/colorHelpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "./StatCard";
import { StockNotesPanel } from "./StockNotesPanel";
import { StockNewsPanel } from "./StockNewsPanel";

interface Props {
  ticker: string | null;
  data: StockQuote | undefined;
  isLoading: boolean;
  onClose: () => void;
}

export function StockDetail({ ticker, data, isLoading, onClose }: Props) {
  const qc = useQueryClient();

  if (!ticker) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground minimal:rounded-none">
        Select a stock from the watchlist to see deep metrics.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 minimal:rounded-none minimal:border-x-0">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-10 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const rating = calculateRating(
    data.returnOnEquity,
    data.pe,
    data.revenueGrowth,
    data.debtToEquity
  );
  const positive = data.dayChange >= 0;

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 creative:gradient-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent minimal:p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">{data.name}</h2>
            <Badge variant="outline" className={sectorBadgeClass(data.sector)}>
              {data.sector}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {data.ticker}.NS {data.industry && `• ${data.industry}`}
          </p>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold tracking-tight">
              {formatINR(data.cmp)}
            </span>
            <span className={`font-mono text-sm font-semibold ${changeColorClass(data.dayChange)}`}>
              {formatChangePct(data.dayChangePct)}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`mt-3 ${
              rating.className === "strong-buy" || rating.className === "buy"
                ? "border-gain/40 bg-gain/10 text-gain"
                : rating.className === "sell"
                ? "border-loss/40 bg-loss/10 text-loss"
                : "border-warn/40 bg-warn/10 text-warn"
            }`}
          >
            {rating.emoji} {rating.label}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => qc.invalidateQueries({ queryKey: ["quote", ticker] })}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Price &amp; Valuation
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="52W High" value={formatINR(data.fiftyTwoWeekHigh)} />
          <StatCard label="52W Low" value={formatINR(data.fiftyTwoWeekLow)} />
          <StatCard label="Market Cap" value={formatMarketCap(data.marketCap)} />
          <StatCard label="P/E" value={formatNumber(data.pe)} />
          <StatCard label="P/B" value={formatNumber(data.pb)} />
          <StatCard label="EPS (TTM)" value={data.eps == null ? "—" : formatINR(data.eps)} />
          <StatCard label="Book Value" value={data.bookValue == null ? "—" : formatINR(data.bookValue)} />
          <StatCard
            label="Dividend Yield"
            value={formatPct(data.dividendYield, 2, 100)}
            tone={positive ? "gain" : "default"}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Profitability &amp; Growth
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Revenue (TTM)" value={formatMarketCap(data.totalRevenue ?? 0)} />
          <StatCard label="Operating Margin" value={formatPct(data.operatingMargins, 2, 100)} />
          <StatCard label="Net Margin" value={formatPct(data.profitMargins, 2, 100)} />
          <StatCard label="ROE" value={formatPct(data.returnOnEquity, 2, 100)} />
          <StatCard
            label="Revenue Growth"
            value={formatPct(data.revenueGrowth, 2, 100)}
            tone={data.revenueGrowth != null && data.revenueGrowth >= 0 ? "gain" : "loss"}
          />
          <StatCard
            label="Debt / Equity"
            value={data.debtToEquity == null ? "—" : formatNumber(data.debtToEquity / 100)}
          />
          <StatCard label="Insider Holding" value={formatPct(data.heldPercentInsiders, 2, 100)} />
          <StatCard label="Institutional" value={formatPct(data.heldPercentInstitutions, 2, 100)} />
        </div>
      </div>

      <StockNotesPanel ticker={ticker} />

      <StockNewsPanel ticker={ticker} />

      <div className="flex flex-wrap gap-2">
        <a
          href={`https://finance.yahoo.com/quote/${ticker}.NS`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="gap-2 minimal:rounded-none">
            <ExternalLink className="h-3 w-3" /> Yahoo Finance
          </Button>
        </a>
        <a
          href={`https://www.screener.in/company/${ticker}/consolidated/`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="gap-2 minimal:rounded-none">
            <ExternalLink className="h-3 w-3" /> Screener.in
          </Button>
        </a>
      </div>
    </div>
  );
}
