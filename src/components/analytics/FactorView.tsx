import { useMemo } from "react";
import { Layers } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(Math.max(n, min), max);
}

function scoreColor(s: number): string {
  return s >= 70 ? "text-emerald-500" : s >= 50 ? "text-yellow-500" : "text-red-500";
}

function scoreBorder(s: number): string {
  return s >= 70
    ? "border-emerald-500 text-emerald-500"
    : s >= 50
    ? "border-yellow-500 text-yellow-500"
    : "border-red-500 text-red-500";
}

function tiltLabel(s: number): string {
  return s >= 70 ? "Strong" : s >= 50 ? "Moderate" : "Weak";
}

function computeScores(d: ReturnType<(typeof Object)["create"]> | null | undefined) {
  if (!d) return { value: 50, quality: 50, growth: 50, momentum: 50 };

  // Value
  let value = 50;
  if (d.pe != null) {
    value = d.pe < 15 ? 90 : d.pe < 25 ? 70 : d.pe < 40 ? 50 : 20;
  }
  if (d.pb != null) {
    if (d.pb < 1.5) value += 10;
    else if (d.pb > 5) value -= 10;
  }
  value = clamp(value);

  // Quality
  let quality = 50;
  if (d.returnOnEquity != null) {
    const roe = d.returnOnEquity * 100;
    if (roe > 20) quality += 25;
    else if (roe > 15) quality += 15;
    else if (roe < 0) quality -= 20;
  }
  if (d.debtToEquity != null) {
    if (d.debtToEquity < 50) quality += 15;
    else if (d.debtToEquity < 100) quality += 5;
    else if (d.debtToEquity > 200) quality -= 20;
  }
  if (d.profitMargins != null) {
    const pm = d.profitMargins * 100;
    if (pm > 15) quality += 10;
    else if (pm > 5) quality += 5;
    else if (pm < 0) quality -= 15;
  }
  quality = clamp(quality);

  // Growth
  let growth = 50;
  if (d.revenueGrowth != null) {
    const g = d.revenueGrowth * 100;
    growth = g > 20 ? 90 : g > 10 ? 70 : g > 0 ? 50 : 20;
  }

  // Momentum
  let momentum = 50;
  const high = d.fiftyTwoWeekHigh ?? 0;
  const low = d.fiftyTwoWeekLow ?? 0;
  if (high > low && low > 0) {
    const position = (d.cmp - low) / (high - low);
    momentum = clamp(position * 100);
  }

  return { value, quality, growth, momentum };
}

const FACTOR_META = [
  {
    key: "value" as const,
    label: "Value",
    desc: (s: number) =>
      s >= 70
        ? "Holdings are trading at attractive valuations. Good margin of safety."
        : s >= 50
        ? "Mixed valuations. Some holdings are fairly priced, others slightly expensive."
        : "Portfolio leans expensive. High PE/PB suggests growth expectations are already priced in.",
  },
  {
    key: "quality" as const,
    label: "Quality",
    desc: (s: number) =>
      s >= 70
        ? "Strong fundamentals — high ROE, clean balance sheet, healthy margins."
        : s >= 50
        ? "Average quality. Watch debt levels and margin trends closely."
        : "Quality concerns — low ROE, high debt, or weak margins. Higher risk of disappointment.",
  },
  {
    key: "growth" as const,
    label: "Growth",
    desc: (s: number) =>
      s >= 70
        ? "Portfolio has strong revenue growth momentum. You're betting on compounders."
        : s >= 50
        ? "Moderate growth. Not a pure growth portfolio — blend of growth and value bets."
        : "Slow or negative revenue growth. Portfolio is more defensive or value-oriented.",
  },
  {
    key: "momentum" as const,
    label: "Momentum",
    desc: (s: number) =>
      s >= 70
        ? "Most holdings near 52-week highs. Strong price momentum — trend is your friend."
        : s >= 50
        ? "Mixed momentum. Some holdings recovering, others still in downtrend."
        : "Holdings near 52-week lows. Either deep value opportunity or broken stocks — tread carefully.",
  },
];

export function FactorView({ portfolio, results }: Props) {
  const data = useMemo(() => {
    if (!portfolio.length) return null;

    const priceMap: Record<string, number> = {};
    for (const r of results) {
      if (r.data?.cmp) priceMap[r.ticker] = r.data.cmp;
    }

    const rows = portfolio.map((h) => {
      const currentPrice = priceMap[h.ticker] ?? h.avgPrice;
      const holdingValue = h.qty * currentPrice;
      const r = results.find((x) => x.ticker === h.ticker);
      const scores = computeScores(r?.data ?? null);
      return { ticker: h.ticker, holdingValue, scores };
    });

    const totalValue = rows.reduce((s, r) => s + r.holdingValue, 0);

    const portfolio_scores = {
      value: 0,
      quality: 0,
      growth: 0,
      momentum: 0,
    };

    if (totalValue > 0) {
      for (const row of rows) {
        const w = row.holdingValue / totalValue;
        portfolio_scores.value += w * row.scores.value;
        portfolio_scores.quality += w * row.scores.quality;
        portfolio_scores.growth += w * row.scores.growth;
        portfolio_scores.momentum += w * row.scores.momentum;
      }
    }

    const sorted = [...rows].sort((a, b) => b.holdingValue - a.holdingValue);

    return { portfolio_scores, sorted };
  }, [portfolio, results]);

  if (!portfolio.length || !data) return null;

  const { portfolio_scores, sorted } = data;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Layers className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Factor Decomposition</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Portfolio tilt across Value, Quality, Growth, Momentum.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
        {FACTOR_META.map(({ key, label, desc }) => {
          const s = Math.round(portfolio_scores[key]);
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-end gap-2">
                  <span className={`text-4xl font-bold ${scoreColor(s)}`}>{s}</span>
                  <span className="text-sm text-muted-foreground mb-1">/100</span>
                </div>
                <Badge variant="outline" className={scoreBorder(s)}>
                  {tiltLabel(s)}
                </Badge>
                <div className="h-1.5 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${
                      s >= 70 ? "bg-emerald-500" : s >= 50 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${s}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc(s)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Holdings Factor Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[1fr_repeat(4,_48px)] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
            <span>Stock</span>
            <span className="text-center">Val</span>
            <span className="text-center">Qual</span>
            <span className="text-center">Grw</span>
            <span className="text-center">Mom</span>
          </div>
          {sorted.map((row) => {
            const s = row.scores;
            const mini = [s.value, s.quality, s.growth, s.momentum];
            return (
              <div
                key={row.ticker}
                className="grid grid-cols-[1fr_repeat(4,_48px)] gap-2 items-center"
              >
                <span className="font-mono text-xs font-semibold">{row.ticker}</span>
                {mini.map((score, i) => (
                  <div key={i} className="flex justify-center">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        score >= 70
                          ? "bg-emerald-500/20 text-emerald-500"
                          : score >= 50
                          ? "bg-yellow-500/20 text-yellow-500"
                          : "bg-red-500/20 text-red-500"
                      }`}
                    >
                      {Math.round(score)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
