import { useRef, useState, useEffect } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { useStockHistory } from "@/hooks/useStockHistory";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  ticker: string;
  positive: boolean;
}

// FIX: Use IntersectionObserver to lazy-load sparklines so we don't fire
// N simultaneous history requests when the watchlist first renders.
export function Sparkline({ ticker, positive }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-8 w-24">
      {visible ? <SparklineInner ticker={ticker} positive={positive} /> : <Skeleton className="h-8 w-24" />}
    </div>
  );
}

function SparklineInner({ ticker, positive }: Props) {
  const { data, isLoading } = useStockHistory(ticker, "1mo");

  if (isLoading) return <Skeleton className="h-8 w-24" />;
  if (!data || data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;

  const points = data.slice(-7).map((d) => ({ v: d.close }));
  const color = positive ? "var(--gain)" : "var(--loss)";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
