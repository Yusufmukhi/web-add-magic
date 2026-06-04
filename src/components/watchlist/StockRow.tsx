import { TrendingDown, TrendingUp, X, AlertCircle } from "lucide-react";
import type { QuoteResult } from "@/hooks/useStockQuote";
import {
  formatINR,
  formatMarketCap,
  formatNumber,
  formatChangePct,
} from "@/utils/formatters";
import {
  changeColorClass,
  isNear52WeekHigh,
  isNear52WeekLow,
  sectorBadgeClass,
} from "@/utils/colorHelpers";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkline } from "./Sparkline";

interface Props {
  result: QuoteResult;
  onRemove: (t: string) => void;
  onSelect: (t: string) => void;
  isSelected: boolean;
}

/** Deterministic colour from ticker string */
function tickerColor(ticker: string): string {
  const palette = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
    "#10b981", "#06b6d4", "#f59e0b", "#6366f1",
  ];
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function LogoAvatar({ ticker }: { ticker: string }) {
  return (
    <div
      className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-[10px]"
      style={{ background: tickerColor(ticker) }}
    >
      {ticker.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function StockRow({ result, onRemove, onSelect, isSelected }: Props) {
  const { ticker, data, isLoading, error } = result;

  if (isLoading || (!data && !error)) {
    return (
      <tr className="border-b border-border">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </td>
        <td className="hidden px-4 py-3 md:table-cell"><Skeleton className="h-4 w-16" /></td>
        <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
        <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-14" /></td>
        <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-14" /></td>
        <td className="hidden px-4 py-3 lg:table-cell"><Skeleton className="h-8 w-24" /></td>
        <td className="hidden px-4 py-3 text-right md:table-cell"><Skeleton className="ml-auto h-4 w-12" /></td>
        <td className="hidden px-4 py-3 text-right md:table-cell"><Skeleton className="ml-auto h-4 w-20" /></td>
        <td className="px-4 py-3" />
      </tr>
    );
  }

  if (error || !data) {
    return (
      <tr className="border-b border-border">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <LogoAvatar ticker={ticker} />
            <span className="font-mono text-sm font-semibold">{ticker}</span>
          </div>
        </td>
        <td colSpan={7} className="px-4 py-3 text-sm text-loss">
          <span className="inline-flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Failed to load data
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <Button size="icon" variant="ghost" onClick={() => onRemove(ticker)}>
            <X className="h-4 w-4" />
          </Button>
        </td>
      </tr>
    );
  }

  const positive = data.dayChange >= 0;
  const nearHigh = isNear52WeekHigh(data.cmp, data.fiftyTwoWeekHigh);
  const nearLow = isNear52WeekLow(data.cmp, data.fiftyTwoWeekLow);

  return (
    <tr
      onClick={() => onSelect(ticker)}
      className={`cursor-pointer border-b border-border transition-colors hover:bg-accent/50 ${
        isSelected ? "bg-accent/60 creative:shadow-glow" : ""
      }`}
    >
      {/* Symbol column: avatar + ticker + company name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <LogoAvatar ticker={ticker} />
          <div>
            <div className="font-mono text-[13px] font-bold leading-tight">{ticker}</div>
            <div className="text-[11px] text-muted-foreground truncate max-w-[160px] leading-tight">{data.name}</div>
          </div>
        </div>
      </td>

      {/* Sector badge — hidden on small */}
      <td className="hidden px-4 py-3 md:table-cell">
        <div className="space-y-1">
          <Badge variant="outline" className={`text-[10px] ${sectorBadgeClass(data.sector)}`}>
            {data.sector}
          </Badge>
          {nearHigh && (
            <Badge variant="outline" className="block border-gain/40 bg-gain/10 text-[10px] text-gain">
              Near 52W High
            </Badge>
          )}
          {nearLow && (
            <Badge variant="outline" className="block border-loss/40 bg-loss/10 text-[10px] text-loss">
              Near 52W Low
            </Badge>
          )}
        </div>
      </td>

      {/* Last (CMP) */}
      <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold">
        {formatINR(data.cmp)}
      </td>

      {/* Chg (absolute) */}
      <td className={`px-4 py-3 text-right font-mono text-[13px] font-semibold ${changeColorClass(data.dayChange)}`}>
        {data.dayChange >= 0 ? "+" : ""}{formatNumber(data.dayChange, 2)}
      </td>

      {/* Chg% */}
      <td className={`px-4 py-3 text-right font-mono text-[13px] font-semibold ${changeColorClass(data.dayChange)}`}>
        <span className="inline-flex items-center justify-end gap-1">
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {formatChangePct(data.dayChangePct)}
        </span>
      </td>

      {/* 7D Sparkline */}
      <td className="hidden px-4 py-3 lg:table-cell">
        <Sparkline ticker={ticker} positive={positive} />
      </td>

      {/* P/E */}
      <td className="hidden px-4 py-3 text-right font-mono text-xs text-muted-foreground md:table-cell">
        {formatNumber(data.pe)}
      </td>

      {/* Mkt Cap */}
      <td className="hidden px-4 py-3 text-right font-mono text-xs text-muted-foreground md:table-cell">
        {formatMarketCap(data.marketCap)}
      </td>

      {/* Remove */}
      <td className="px-4 py-3 text-right">
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(ticker);
          }}
          aria-label={`Remove ${ticker}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
