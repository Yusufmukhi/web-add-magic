import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { useStockHistory } from "@/hooks/useStockHistory";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  ticker: string;
  positive: boolean;
}

export function Sparkline({ ticker, positive }: Props) {
  const { data, isLoading } = useStockHistory(ticker, "1mo");

  if (isLoading) return <Skeleton className="h-8 w-24" />;
  if (!data || data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;

  const points = data.slice(-7).map((d) => ({ v: d.close }));
  const color = positive ? "var(--gain)" : "var(--loss)";

  return (
    <div className="h-8 w-24">
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
    </div>
  );
}
