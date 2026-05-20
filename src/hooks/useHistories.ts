import { useQueries } from "@tanstack/react-query";
import { fetchHistory } from "@/services/api";
import type { HistoryApiResponse } from "@/types/api.types";

export type HistoryPoint = { date: string; close: number };

export function useHistories(tickers: string[], period = "3mo") {
  const queries = useQueries({
    queries: tickers.map((t) => ({
      queryKey: ["history", t, period],
      queryFn: async (): Promise<HistoryPoint[]> => {
        const res: HistoryApiResponse = await fetchHistory(t, period);
        if (res.error) throw new Error(res.error);
        return res.history ?? [];
      },
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const map: Record<string, HistoryPoint[]> = {};
  tickers.forEach((t, i) => {
    map[t] = queries[i].data ?? [];
  });
  return { map, isLoading };
}
