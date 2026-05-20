interface RawField<T = number> {
  raw?: T | null;
}

export interface QuoteApiResponse {
  error?: string;
  quoteSummary?: {
    result?: Array<{
      assetProfile?: {
        longName?: string;
        sector?: string;
        industry?: string;
        website?: string;
        country?: string;
        employees?: number | null;
      };
      summaryDetail?: {
        previousClose?: RawField;
        fiftyTwoWeekHigh?: RawField;
        fiftyTwoWeekLow?: RawField;
        marketCap?: RawField;
        trailingPE?: RawField;
        dividendYield?: RawField;
      };
      financialData?: {
        currentPrice?: RawField;
        debtToEquity?: RawField;
        returnOnEquity?: RawField;
        totalRevenue?: RawField;
        operatingMargins?: RawField;
        profitMargins?: RawField;
        revenueGrowth?: RawField;
      };
      defaultKeyStatistics?: {
        trailingEps?: RawField;
        priceToBook?: RawField;
        bookValue?: RawField;
        heldPercentInsiders?: RawField;
        heldPercentInstitutions?: RawField;
      };
    }>;
  };
}

export interface SearchApiResponse {
  error?: string;
  quotes?: Array<{
    symbol: string;
    exchange?: string;
    quoteType?: string;
    longname?: string;
    shortname?: string;
  }>;
}

export interface HistoryApiResponse {
  error?: string;
  symbol?: string;
  history?: Array<{ date: string; close: number }>;
}
