import { useState } from "react";
import { Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

export function StressTest({ portfolio, results }: Props) {
  const [dropPct, setDropPct] = useState(20);
  // FIXED: use useLocalStorage hook instead of raw localStorage
  const [betaOverrides, setBetaOverrides] = useLocalStorage<Record<string, number>>(
    "stress_beta_overrides",
    {}
  );

  if (!portfolio.length) return null;

  const saveBeta = (ticker: string, val: number) => {
    setBetaOverrides((prev) => ({ ...prev, [ticker]: val }));
  };

  const priceMap: Record<string, number> = {};
  for (const result of results) {
    if (result.data?.cmp) {
      priceMap[result.ticker] = result.data.cmp;
    }
  }

  const rows = portfolio.map((h) => {
    const cmp = priceMap[h.ticker] ?? h.avgPrice;
    const currentValue = h.qty * cmp;
    const beta = betaOverrides[h.ticker] ?? 1.0;
    const effectiveDrop = Math.min(dropPct * beta, 95);
    const valueAfterDrop = currentValue * (1 - effectiveDrop / 100);
    const loss = currentValue - valueAfterDrop;
    return { ...h, cmp, currentValue, beta, effectiveDrop, valueAfterDrop, loss };
  });

  rows.sort((a, b) => b.loss - a.loss);

  const totalCurrent = rows.reduce((sum, r) => sum + r.currentValue, 0);
  const totalAfter = rows.reduce((sum, r) => sum + r.valueAfterDrop, 0);
  const totalLoss = totalCurrent - totalAfter;

  const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Stress Test</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Simulate a Nifty crash on your portfolio
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            If Nifty drops{" "}
            <span className="text-primary font-bold">{dropPct}%</span>
          </label>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={dropPct}
            onChange={(e) => setDropPct(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5%</span>
            <span>60%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Current Value</p>
            <p className="text-sm font-semibold">{fmt(totalCurrent)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">After Drop</p>
            <p className="text-sm font-semibold">{fmt(totalAfter)}</p>
          </div>
          <div className="rounded-lg bg-red-500/10 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Estimated Loss</p>
            <p className="text-sm font-semibold text-red-500">-{fmt(totalLoss)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left py-2 pr-3 font-medium">Stock</th>
                <th className="text-center py-2 px-3 font-medium">Beta</th>
                <th className="text-right py-2 px-3 font-medium">Current ₹</th>
                <th className="text-right py-2 px-3 font-medium">After Drop ₹</th>
                <th className="text-right py-2 pl-3 font-medium">Loss ₹</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ticker} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3 font-medium">{row.ticker}</td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={betaOverrides[row.ticker] ?? 1.0}
                      onChange={(e) => saveBeta(row.ticker, parseFloat(e.target.value))}
                      className="w-16 text-center text-sm bg-muted rounded px-1 py-0.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{fmt(row.currentValue)}</td>
                  <td className="py-2 px-3 text-right">{fmt(row.valueAfterDrop)}</td>
                  <td className="py-2 pl-3 text-right text-red-500 font-medium">-{fmt(row.loss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Beta = 1 means stock moves with Nifty. Beta 1.5 = 50% more volatile.
          Edit betas to match your stocks.
        </p>
      </CardContent>
    </Card>
  );
}
