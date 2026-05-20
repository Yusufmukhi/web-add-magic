import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchQuote } from "@/services/api";
import type { StockQuote } from "@/types/stock.types";

const STALE = 5 * 60 * 1000;

export function useStockQuote(ticker: string | null) {
  return useQuery({
    queryKey: ["quote", ticker],
    queryFn: () => fetchQuote(ticker as string),
    enabled: !!ticker,
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
}

export interface QuoteResult {
  ticker: string;
  data: StockQuote | undefined;
  isLoading: boolean;
  error: unknown;
}

export function useStockQuotes(tickers: string[]): QuoteResult[] {
  const results = useQueries({
    queries: tickers.map((t) => ({
      queryKey: ["quote", t],
      queryFn: () => fetchQuote(t),
      staleTime: STALE,
      refetchOnWindowFocus: false,
    })),
  });

  // ✅ FIXED: Stable reference — only recomputes when data actually changes
  return useMemo(
    () =>
      tickers.map((t, i) => ({
        ticker: t,
        data: results[i].data,
        isLoading: results[i].isLoading,
        error: results[i].error,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickers, ...results.map((r) => r.data), ...results.map((r) => r.isLoading)]
  );
}
