import { useState, useRef } from "react";
import { TrendingDown, TrendingUp, AlertCircle } from "lucide-react";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { formatINR, formatChangePct } from "@/utils/formatters";
import { changeColorClass } from "@/utils/colorHelpers";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "./Sparkline";

interface Props {
  result: QuoteResult;
  onRemove: (t: string) => void;
  onTap: (t: string) => void;
}

export function MobileStockRow({ result, onRemove, onTap }: Props) {
  const { ticker, data, isLoading, error } = result;
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (dx > 50 && dy < 30) setSwiped(true);
    else if (dx < -20) setSwiped(false);
  };

  if (isLoading || (!data && !error)) {
    return (
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="text-right">
          <Skeleton className="h-4 w-16 mb-1" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex-1">
          <div className="font-mono text-sm font-bold">{ticker}</div>
          <div className="flex items-center gap-1 text-xs text-loss">
            <AlertCircle className="h-3 w-3" /> Failed to load
          </div>
        </div>
        <button
          onClick={() => onRemove(ticker)}
          className="rounded-full px-3 py-1 text-xs text-loss bg-loss/10 font-medium"
        >
          Remove
        </button>
      </div>
    );
  }

  const positive = data.dayChange >= 0;

  if (swiped) {
    return (
      <div className="flex items-center border-b border-border bg-loss/10 px-4 py-3">
        <div className="flex-1">
          <div className="font-mono text-sm font-bold">{ticker}</div>
          <div className="text-xs text-muted-foreground">{data.name}</div>
        </div>
        <button
          onClick={() => { onRemove(ticker); setSwiped(false); }}
          className="rounded-full bg-loss px-4 py-1.5 text-xs font-semibold text-white"
        >
          Remove
        </button>
        <button
          onClick={() => setSwiped(false)}
          className="ml-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 border-b border-border px-4 py-3 active:bg-accent/40 transition-colors cursor-pointer select-none"
      style={{ minHeight: 56 }}
      onClick={() => onTap(ticker)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left: symbol + name */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[14px] font-bold leading-tight">{ticker}</div>
        <div className="truncate text-[12px] text-muted-foreground leading-tight mt-0.5">{data.name}</div>
      </div>

      {/* Middle: sparkline */}
      <div className="hidden sm:block">
        <Sparkline ticker={ticker} positive={positive} />
      </div>

      {/* Right: CMP + change pill */}
      <div className="text-right shrink-0">
        <div className="font-mono text-[14px] font-bold leading-tight">{formatINR(data.cmp)}</div>
        <div
          className={`mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
            positive
              ? "bg-gain/15 text-gain"
              : "bg-loss/15 text-loss"
          }`}
        >
          {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {formatChangePct(data.dayChangePct)}
        </div>
      </div>
    </div>
  );
}
