import { useQuery } from "@tanstack/react-query";
import { fetchHistory } from "@/services/api";

export function useStockHistory(ticker: string | null, period = "1mo") {
  return useQuery({
    queryKey: ["history", ticker, period],
    queryFn: async () => {
      const res = await fetchHistory(ticker as string, period);
      if (res.error) throw new Error(res.error);
      return res.history ?? [];
    },
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
