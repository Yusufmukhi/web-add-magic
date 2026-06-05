import { useMemo } from "react";
import { Grid3x3 } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHistories } from "@/hooks/useHistories";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  portfolio: Holding[];
}

// ─── Pearson correlation between two return series ────────────────────────────

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0; // not enough data

  const ax = a.slice(0, n);
  const bx = b.slice(0, n);

  const meanA = ax.reduce((s, v) => s + v, 0) / n;
  const meanB = bx.reduce((s, v) => s + v, 0) / n;

  let num = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = ax[i] - meanA;
    const db = bx[i] - meanB;
    num += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;
  return Math.max(-1, Math.min(1, num / denom));
}

// ─── Convert price series → daily return series ───────────────────────────────

function toReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

// ─── Cell colour based on correlation value ───────────────────────────────────

function cellBg(corr: number, isDiag: boolean): string {
  if (isDiag) return "rgba(99,102,241,0.15)"; // purple tint for diagonal
  const abs = Math.abs(corr);
  if (corr > 0) {
    // red tones — moving together
    const alpha = 0.08 + abs * 0.45;
    return `rgba(239,68,68,${alpha.toFixed(2)})`;
  } else {
    // green tones — diversifying
    const alpha = 0.08 + abs * 0.45;
    return `rgba(16,185,129,${alpha.toFixed(2)})`;
  }
}

function cellTextColor(corr: number, isDiag: boolean): string {
  if (isDiag) return "text-primary";
  const abs = Math.abs(corr);
  if (abs < 0.2) return "text-muted-foreground";
  if (corr > 0) return abs > 0.5 ? "text-red-500" : "text-red-400";
  return abs > 0.5 ? "text-emerald-500" : "text-emerald-400";
}

// ─── Interpretation label ─────────────────────────────────────────────────────

function interpretation(corr: number): { label: string; color: string } {
  const abs = Math.abs(corr);
  if (abs >= 0.7) return corr > 0
    ? { label: "Strong co-movement", color: "text-red-500" }
    : { label: "Strong diversifier", color: "text-emerald-500" };
  if (abs >= 0.4) return corr > 0
    ? { label: "Moderate co-movement", color: "text-orange-400" }
    : { label: "Moderate diversifier", color: "text-emerald-400" };
  return { label: "Weakly correlated", color: "text-muted-foreground" };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CorrelationMatrix({ portfolio }: Props) {
  const tickers = useMemo(
    () => portfolio.map((h) => h.ticker),
    [portfolio]
  );

  const { map, isLoading } = useHistories(tickers, "3mo");

  const { matrix, activeTickers, pairs } = useMemo(() => {
    if (!tickers.length) return { matrix: [], activeTickers: [], pairs: [] };

    // Build returns per ticker — only include tickers with enough data
    const returnsMap: Record<string, number[]> = {};
    for (const ticker of tickers) {
      const history = map[ticker] ?? [];
      if (history.length >= 10) {
        returnsMap[ticker] = toReturns(history.map((h) => h.close));
      }
    }

    const activeTickers = tickers.filter((t) => returnsMap[t]);
    const n = activeTickers.length;

    // Build N×N correlation matrix
    const matrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 1;
        return pearson(returnsMap[activeTickers[i]], returnsMap[activeTickers[j]]);
      })
    );

    // Build top interesting pairs (highest absolute non-diagonal correlation)
    const pairs: Array<{ a: string; b: string; corr: number }> = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push({ a: activeTickers[i], b: activeTickers[j], corr: matrix[i][j] });
      }
    }
    pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));

    return { matrix, activeTickers, pairs };
  }, [tickers, map]);

  if (portfolio.length < 2) return null;

  const n = activeTickers.length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Grid3x3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Correlation Matrix</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Based on 90 days of real daily returns (Pearson correlation).{" "}
        <span className="text-emerald-500 font-medium">Green = diversifying</span> ·{" "}
        <span className="text-red-500 font-medium">Red = moving together</span>
      </p>

      {isLoading && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm text-muted-foreground mb-2">
              Fetching 90-day price history for {tickers.length} stocks...
            </p>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {!isLoading && n < 2 && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              Not enough price history available yet. Try again after market hours.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && n >= 2 && (
        <div className="space-y-4">
          {/* Matrix */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                90-Day Return Correlation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div
                  className="inline-grid gap-1"
                  style={{
                    gridTemplateColumns: `64px repeat(${n}, minmax(48px, 1fr))`,
                    minWidth: `${64 + n * 52}px`,
                  }}
                >
                  {/* Header row */}
                  <div className="h-8" /> {/* empty top-left cell */}
                  {activeTickers.map((t) => (
                    <div
                      key={t}
                      className="h-8 flex items-center justify-center font-mono text-[10px] font-bold text-muted-foreground"
                    >
                      {t.slice(0, 6)}
                    </div>
                  ))}

                  {/* Data rows */}
                  {activeTickers.map((rowTicker, i) => (
                    <>
                      {/* Row label */}
                      <div
                        key={`label-${rowTicker}`}
                        className="h-10 flex items-center font-mono text-[10px] font-bold text-muted-foreground pr-1 truncate"
                      >
                        {rowTicker.slice(0, 8)}
                      </div>

                      {/* Cells */}
                      {activeTickers.map((colTicker, j) => {
                        const corr = matrix[i][j];
                        const isDiag = i === j;
                        return (
                          <div
                            key={`${rowTicker}-${colTicker}`}
                            className="h-10 rounded flex items-center justify-center text-[11px] font-bold transition-all"
                            style={{ backgroundColor: cellBg(corr, isDiag) }}
                            title={isDiag ? rowTicker : `${rowTicker} vs ${colTicker}: ${corr.toFixed(3)}`}
                          >
                            <span className={cellTextColor(corr, isDiag)}>
                              {isDiag ? "1.0" : corr.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top pairs insight */}
          {pairs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Key Relationships
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pairs.slice(0, 6).map(({ a, b, corr }) => {
                  const { label, color } = interpretation(corr);
                  const abs = Math.abs(corr);
                  return (
                    <div key={`${a}-${b}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold">
                          {a} <span className="text-muted-foreground font-normal">vs</span> {b}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${color}`}>{corr.toFixed(2)}</span>
                          <span className={`text-[10px] ${color}`}>{label}</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${corr > 0 ? "bg-red-400" : "bg-emerald-400"}`}
                          style={{ width: `${abs * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Plain-English summary */}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {(() => {
                      const highCorr = pairs.filter((p) => p.corr > 0.7);
                      const goodDiv = pairs.filter((p) => p.corr < -0.2);
                      if (highCorr.length > 0) {
                        return `⚠️ ${highCorr.map((p) => `${p.a} & ${p.b}`).join(", ")} are highly correlated — these are effectively one concentrated bet, not two separate positions.`;
                      }
                      if (goodDiv.length > 0) {
                        return `✅ Your portfolio has good diversification. ${goodDiv[0].a} and ${goodDiv[0].b} tend to move in opposite directions, reducing overall volatility.`;
                      }
                      return `📊 Moderate correlation across holdings. Your stocks generally move somewhat together — typical for a focused Indian equity portfolio.`;
                    })()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
