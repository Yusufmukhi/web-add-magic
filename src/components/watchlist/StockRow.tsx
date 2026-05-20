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

export function StockRow({ result, onRemove, onSelect, isSelected }: Props) {
  const { ticker, data, isLoading, error } = result;

  if (isLoading || (!data && !error)) {
    return (
      <tr className="border-b border-border">
        <td className="px-4 py-3 font-mono font-semibold">{ticker}</td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
        <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
        <td className="hidden px-4 py-3 md:table-cell"><Skeleton className="h-4 w-20" /></td>
        <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
        <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
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
        <td className="px-4 py-3 font-mono font-semibold">{ticker}</td>
        <td colSpan={8} className="px-4 py-3 text-sm text-loss">
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
      <td className="px-4 py-3">
        <div className="font-mono text-sm font-bold">{ticker}</div>
      </td>
      <td className="px-4 py-3">
        <div className="max-w-[200px] truncate text-sm font-medium">{data.name}</div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-[10px] ${sectorBadgeClass(data.sector)}`}>
          {data.sector}
        </Badge>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        {nearHigh && (
          <Badge variant="outline" className="border-gain/40 bg-gain/10 text-[10px] text-gain">
            Near 52W High
          </Badge>
        )}
        {nearLow && (
          <Badge variant="outline" className="border-loss/40 bg-loss/10 text-[10px] text-loss">
            Near 52W Low
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
        {formatINR(data.cmp)}
      </td>
      <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${changeColorClass(data.dayChange)}`}>
        <span className="inline-flex items-center gap-1">
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {formatChangePct(data.dayChangePct)}
        </span>
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <Sparkline ticker={ticker} positive={positive} />
      </td>
      <td className="hidden px-4 py-3 text-right font-mono text-xs text-muted-foreground md:table-cell">
        {formatNumber(data.pe)}
      </td>
      <td className="hidden px-4 py-3 text-right font-mono text-xs text-muted-foreground md:table-cell">
        {formatMarketCap(data.marketCap)}
      </td>
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
