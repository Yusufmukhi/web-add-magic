import { useQuery } from "@tanstack/react-query";

export interface NewsItem {
  uuid: string;
  title: string;
  link: string;
  publisher: string;
  publishedAt: string | null;
  thumbnail: string | null;
}

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export function useStockNews(ticker: string | null) {
  return useQuery<NewsItem[]>({
    queryKey: ["news", ticker],
    enabled: !!ticker,
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/yahoo/news/${encodeURIComponent(ticker!)}`);
      if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);
      const data = await res.json() as { news?: NewsItem[] };
      return data.news ?? [];
    },
  });
}
