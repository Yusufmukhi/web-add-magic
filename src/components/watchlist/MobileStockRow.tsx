import { useState, useRef } from "react";
import { TrendingDown, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAccumulationSignal } from "@/hooks/useAccumulationSignal";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { formatINR, formatChangePct } from "@/utils/formatters";
import { changeColorClass } from "@/utils/colorHelpers";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  result: QuoteResult;
  onRemove: (t: string) => void;
  onTap: (t: string) => void;
}

/** Generate a deterministic pastel colour from a ticker string */
function tickerColor(ticker: string): string {
  const palette = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
    "#10b981", "#06b6d4", "#f59e0b", "#6366f1",
  ];
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
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

  /** Compact logo avatar using ticker initials */
  const LogoAvatar = ({ size = 36 }: { size?: number }) => (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold text-white"
      style={{
        width: size,
        height: size,
        background: tickerColor(ticker),
        fontSize: size * 0.35,
        letterSpacing: "-0.02em",
      }}
    >
      {ticker.slice(0, 2).toUpperCase()}
    </div>
  );

  if (isLoading || (!data && !error)) {
    return (
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-9 w-9 rounded-full" />
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
        <LogoAvatar />
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
  const signal = getAccumulationSignal(data.volume, data.avgVolume, data.dayChangePct);
    return (
      <div className="flex items-center gap-3 border-b border-border bg-loss/10 px-4 py-3">
        <LogoAvatar />
        <div className="flex-1">
          <div className="font-mono text-sm font-bold">{ticker}</div>
          <div className="text-xs text-muted-foreground truncate">{data.name}</div>
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
      style={{ minHeight: 60 }}
      onClick={() => onTap(ticker)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Company logo avatar */}
      <LogoAvatar size={38} />

      {/* Symbol + company name */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[14px] font-bold leading-tight">{ticker}</div>
            {signal === "accumulation" && <Badge className="mt-0.5 bg-emerald-500/20 text-emerald-600 text-[9px] px-1 py-0 w-fit">▲ Accum</Badge>}
            {signal === "distribution" && <Badge className="mt-0.5 bg-orange-500/20 text-orange-600 text-[9px] px-1 py-0 w-fit">▼ Dist</Badge>}
        <div className="truncate text-[12px] text-muted-foreground leading-tight mt-0.5">{data.name}</div>
      </div>

      {/* CMP + change pill */}
      <div className="text-right shrink-0">
        <div className="font-mono text-[14px] font-bold leading-tight">{formatINR(data.cmp)}</div>
        <div
          className={`mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
            positive ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
          }`}
        >
          {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {formatChangePct(data.dayChangePct)}
        </div>
      </div>
    </div>
  );
}
