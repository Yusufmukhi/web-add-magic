import type {
  HistoryApiResponse,
  QuoteApiResponse,
  SearchApiResponse,
} from "@/types/api.types";
import type { StockQuote } from "@/types/stock.types";

// Empty string = same origin. The Cloudflare Worker handles /api/* routes
// directly, so no separate backend server is needed.
// VITE_API_BASE_URL can still override this for local dev pointing at a
// local FastAPI instance (e.g. http://localhost:8000).
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchQuoteRaw(ticker: string): Promise<QuoteApiResponse> {
  return getJSON<QuoteApiResponse>(
    `/api/yahoo/quote/${encodeURIComponent(ticker)}`
  );
}

export async function fetchQuote(ticker: string): Promise<StockQuote> {
  const data = await fetchQuoteRaw(ticker);
  if (data.error) throw new Error(data.error);
  const r = data.quoteSummary?.result?.[0];
  if (!r) throw new Error("No data");
  const ap = r.assetProfile ?? {};
  const sd = r.summaryDetail ?? {};
  const fd = r.financialData ?? {};
  const ks = r.defaultKeyStatistics ?? {};
  const cmp = fd.currentPrice?.raw ?? sd.previousClose?.raw ?? 0;
  const prevClose = sd.previousClose?.raw ?? cmp;
  const dayChange = cmp - prevClose;
  return {
    ticker,
    name: ap.longName ?? ticker,
    sector: ap.sector ?? "Unknown",
    industry: ap.industry ?? "",
    cmp,
    prevClose,
    dayChange,
    dayChangePct: prevClose ? (dayChange / prevClose) * 100 : 0,
    fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh?.raw ?? 0,
    fiftyTwoWeekLow: sd.fiftyTwoWeekLow?.raw ?? 0,
    marketCap: sd.marketCap?.raw ?? 0,
    pe: sd.trailingPE?.raw ?? null,
    pb: ks.priceToBook?.raw ?? null,
    eps: ks.trailingEps?.raw ?? null,
    bookValue: ks.bookValue?.raw ?? null,
    dividendYield: sd.dividendYield?.raw ?? null,
    debtToEquity: fd.debtToEquity?.raw ?? null,
    returnOnEquity: fd.returnOnEquity?.raw ?? null,
    totalRevenue: fd.totalRevenue?.raw ?? null,
    operatingMargins: fd.operatingMargins?.raw ?? null,
    profitMargins: fd.profitMargins?.raw ?? null,
    revenueGrowth: fd.revenueGrowth?.raw ?? null,
    heldPercentInsiders: ks.heldPercentInsiders?.raw ?? null,
    heldPercentInstitutions: ks.heldPercentInstitutions?.raw ?? null,
  };
}

export async function searchStocks(
  query: string
): Promise<SearchApiResponse["quotes"]> {
  if (!query.trim()) return [];
  const data = await getJSON<SearchApiResponse>(
    `/api/yahoo/search?q=${encodeURIComponent(query)}`
  );
  // Backend already filters to NSE/BSE equities and sorts NSE first.
  return (data.quotes ?? []).filter((q) => q.quoteType === "EQUITY");
}


export async function fetchHistory(
  ticker: string,
  period = "1mo"
): Promise<HistoryApiResponse> {
  return getJSON<HistoryApiResponse>(
    `/api/yahoo/history/${encodeURIComponent(ticker)}?period=${period}`
  );
}
