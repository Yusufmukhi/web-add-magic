/**
 * Dalal Street — Stock API Worker
 *
 * Proxies Yahoo Finance requests server-side, avoiding CORS and rate-limit
 * issues that occur when fetching from the browser. Runs as part of the same
 * Cloudflare Worker as the frontend, so no separate backend is needed.
 *
 * Routes handled (all prefixed /api/yahoo/):
 *   GET /api/yahoo/quote/:ticker     — full quote + fundamentals
 *   GET /api/yahoo/history/:ticker   — OHLCV history (?period=1mo etc.)
 *   GET /api/yahoo/search?q=...      — ticker search (NSE equity only)
 *   GET /api/yahoo/news/:ticker      — stock news (Google News RSS)
 *   GET /api/                        — health-check
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Env {
  // No KV / D1 needed — pure in-memory TTL cache per isolate is enough.
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

// ---------------------------------------------------------------------------
// In-memory TTL cache (per isolate, resets on cold start — acceptable for
// market data where freshness matters more than persistence)
// ---------------------------------------------------------------------------

const _cache = new Map<string, CacheEntry>();
const _stale = new Map<string, unknown>(); // last known-good value per key

function cacheGet(key: string): unknown | null {
  const entry = _cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  return null;
}

function cacheSet(key: string, value: unknown, ttlMs: number): void {
  _cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  // Only persist as stale if it's a real data response (not an error)
  if (
    value &&
    typeof value === "object" &&
    !("error" in (value as Record<string, unknown>))
  ) {
    _stale.set(key, value);
  }
}

async function withCache<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>
): Promise<T> {
  const cached = cacheGet(key);
  if (cached !== null) return cached as T;

  try {
    const value = await producer();
    cacheSet(key, value, ttlMs);
    return value;
  } catch (err) {
    // Serve stale on error (rate-limit, network blip, etc.)
    const stale = _stale.get(key);
    if (stale !== undefined) {
      console.warn(`[cache] serving stale for ${key}:`, (err as Error).message);
      return stale as T;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance — Cookie + Crumb auth
//
// Yahoo Finance requires a session cookie and a "crumb" token for most API
// endpoints. We fetch these once per isolate lifetime and reuse them.
// On a 401 we reset and retry once (crumb can expire mid-session).
// ---------------------------------------------------------------------------

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
};

let _yfCookie: string | null = null;
let _yfCrumb: string | null = null;
let _yfCrumbFetching: Promise<void> | null = null;

async function ensureCrumb(): Promise<void> {
  if (_yfCookie && _yfCrumb) return;
  if (_yfCrumbFetching) return _yfCrumbFetching;

  _yfCrumbFetching = (async () => {
    try {
      // Step 1: Hit Yahoo Finance to get a session cookie
      const cookieRes = await fetch("https://fc.yahoo.com", {
        headers: { "User-Agent": YF_HEADERS["User-Agent"] },
        redirect: "follow",
      });
      const setCookie = cookieRes.headers.get("set-cookie") ?? "";
      // Extract just the key=value part (before first semicolon)
      _yfCookie = setCookie.split(";")[0].trim() || null;

      if (!_yfCookie) {
        // Fallback: try the finance page directly
        const fallback = await fetch("https://finance.yahoo.com", {
          headers: { "User-Agent": YF_HEADERS["User-Agent"] },
          redirect: "follow",
        });
        const fb = fallback.headers.get("set-cookie") ?? "";
        _yfCookie = fb.split(";")[0].trim() || "A=dummy";
      }

      // Step 2: Exchange cookie for a crumb token
      const crumbRes = await fetch(
        "https://query1.finance.yahoo.com/v1/test/getcrumb",
        {
          headers: {
            ...YF_HEADERS,
            Cookie: _yfCookie ?? "",
          },
        }
      );

      if (crumbRes.ok) {
        const text = await crumbRes.text();
        // Crumb is a plain string (not JSON), ~11 chars, may contain backslash-encoded chars
        _yfCrumb = text.trim();
      } else {
        console.warn(`[crumb] getcrumb returned HTTP ${crumbRes.status}`);
        _yfCrumb = null;
      }
    } catch (err) {
      console.error("[crumb] failed to obtain crumb:", (err as Error).message);
      _yfCookie = null;
      _yfCrumb = null;
    }
  })();

  await _yfCrumbFetching;
  _yfCrumbFetching = null;
}

function resetCrumb(): void {
  _yfCookie = null;
  _yfCrumb = null;
  _yfCrumbFetching = null;
}

/**
 * Fetch a Yahoo Finance URL, automatically attaching the session cookie and
 * crumb. Retries once if we get a 401 (stale crumb).
 */
async function yfFetch(url: string, isRetry = false): Promise<unknown> {
  await ensureCrumb();

  // Append crumb to query string if we have one
  const fullUrl =
    _yfCrumb
      ? `${url}${url.includes("?") ? "&" : "?"}crumb=${encodeURIComponent(_yfCrumb)}`
      : url;

  const res = await fetch(fullUrl, {
    headers: {
      ...YF_HEADERS,
      ..._yfCookie ? { Cookie: _yfCookie } : {},
    },
  });

  if (res.status === 401 && !isRetry) {
    // Crumb expired — reset and retry exactly once
    console.warn("[yfFetch] 401, refreshing crumb and retrying…");
    resetCrumb();
    return yfFetch(url, true);
  }

  if (!res.ok) {
    throw new Error(`Yahoo Finance returned HTTP ${res.status} for ${url}`);
  }

  return res.json();
}

// NSE suffix helper
function toNS(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.startsWith("^")) return t; // indices like ^NSEI
  return t.endsWith(".NS") ? t : `${t}.NS`;
}

// ---------------------------------------------------------------------------
// Quote endpoint  →  /api/yahoo/quote/:ticker
//
// Uses Yahoo Finance v10 quoteSummary with the same modules the Python
// backend used, so the frontend api.ts mapper works without any changes.
// ---------------------------------------------------------------------------

async function handleQuote(ticker: string): Promise<unknown> {
  const symbol = toNS(ticker);
  const key = `quote:${symbol}`;

  return withCache(key, 60_000, async () => {
    const modules = [
      "assetProfile",
      "summaryDetail",
      "financialData",
      "defaultKeyStatistics",
    ].join(",");

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&corsDomain=finance.yahoo.com&formatted=true&lang=en-US&region=US`;
    const data = await yfFetch(url);
    return data;
  });
}

// ---------------------------------------------------------------------------
// History endpoint  →  /api/yahoo/history/:ticker?period=1mo
//
// Returns { history: [{date, close}], symbol } — same shape as Python backend.
// ---------------------------------------------------------------------------

const ALLOWED_PERIODS = new Set([
  "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max",
]);

const PERIOD_INTERVAL: Record<string, string> = {
  "1d": "1m",
  "5d": "5m",
  "1mo": "1d",
  "3mo": "1d",
  "6mo": "1d",
  "1y": "1wk",
  "2y": "1wk",
  "5y": "1mo",
  "10y": "1mo",
  ytd: "1d",
  max: "1mo",
};

async function handleHistory(
  ticker: string,
  period: string
): Promise<unknown> {
  const symbol = toNS(ticker);
  if (!ALLOWED_PERIODS.has(period)) period = "1mo";
  const interval = PERIOD_INTERVAL[period] ?? "1d";
  const key = `history:${symbol}:${period}`;
  const ttl = ["1d", "5d"].includes(period) ? 60_000 : 30 * 60_000;

  return withCache(key, ttl, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}&includePrePost=false&corsDomain=finance.yahoo.com`;
    const raw = (await yfFetch(url)) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            adjclose?: Array<{ adjclose?: number[] }>;
            quote?: Array<{ close?: number[] }>;
          };
        }>;
        error?: unknown;
      };
    };

    if (raw?.chart?.error) {
      return { error: String(raw.chart.error), symbol };
    }

    const result = raw?.chart?.result?.[0];
    if (!result) return { history: [], symbol };

    const timestamps = result.timestamp ?? [];
    // Prefer adjclose, fall back to close
    const closes =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      [];

    const history = timestamps
      .map((ts, i) => {
        const close = closes[i];
        if (close == null || isNaN(close)) return null;
        const date = new Date(ts * 1000).toISOString().slice(0, 10);
        return { date, close: Math.round(close * 100) / 100 };
      })
      .filter(Boolean);

    return { history, symbol };
  });
}

// ---------------------------------------------------------------------------
// Search endpoint  →  /api/yahoo/search?q=...
//
// Returns { quotes: [...] } filtered to NSE equities — same shape as Python.
// ---------------------------------------------------------------------------

async function handleSearch(query: string): Promise<unknown> {
  const q = query.trim().toUpperCase();
  if (!q) return { quotes: [] };

  const symbol = toNS(q);
  const key = `search:${symbol}`;

  return withCache(key, 5 * 60_000, async () => {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=IN&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=false&enableCb=false&enableNavLinks=false&enableEnhancedTrivialQuery=true&corsDomain=finance.yahoo.com`;

    const raw = (await yfFetch(url)) as {
      quotes?: Array<{
        symbol?: string;
        exchange?: string;
        quoteType?: string;
        longname?: string;
        shortname?: string;
      }>;
    };

    const quotes = (raw?.quotes ?? [])
      // FIX: Yahoo returns "NSI" on some endpoints and "NSE" on others — accept both
      .filter(
        (q) =>
          (q.exchange === "NSI" || q.exchange === "NSE") &&
          q.quoteType === "EQUITY"
      )
      .map((q) => ({
        symbol: q.symbol,
        exchange: q.exchange,
        quoteType: q.quoteType,
        longname: q.longname ?? "",
        shortname: q.shortname ?? "",
      }));

    return { quotes };
  });
}

// ---------------------------------------------------------------------------
// News endpoint  →  /api/yahoo/news/:ticker
//
// Uses Google News RSS — no auth required, returns India-specific results.
// ---------------------------------------------------------------------------

async function handleNews(ticker: string): Promise<unknown> {
  const symbol = toNS(ticker);
  const key = `news:${symbol}`;

  return withCache(key, 15 * 60_000, async () => {
    // Strip .NS suffix and index prefix for a clean search query
    const bare = ticker.replace(/\.NS$/i, "").replace(/^\^/, "");
    const query = `${bare} NSE stock`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;

    const res = await fetch(rssUrl, {
      headers: { "User-Agent": YF_HEADERS["User-Agent"] },
    });
    if (!res.ok) throw new Error(`Google News returned HTTP ${res.status}`);

    const xml = await res.text();

    const items: Array<{
      uuid: string;
      title: string;
      link: string;
      publisher: string;
      publishedAt: string | null;
      thumbnail: null;
    }> = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const getTag = (block: string, tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      if (!m) return "";
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    };

    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
      const block = match[1];
      const rawTitle = getTag(block, "title");
      const link = getTag(block, "link");
      const pubDate = getTag(block, "pubDate");
      const source = getTag(block, "source");

      // Google News titles look like "Headline - Publisher". Split it.
      let title = rawTitle;
      let publisher = source;
      const dashIdx = rawTitle.lastIndexOf(" - ");
      if (dashIdx > 0) {
        title = rawTitle.slice(0, dashIdx).trim();
        if (!publisher) publisher = rawTitle.slice(dashIdx + 3).trim();
      }

      const pubIso = pubDate ? new Date(pubDate).toISOString() : null;
      items.push({
        uuid: `${symbol}-${i++}`,
        title,
        link,
        publisher,
        publishedAt: pubIso && pubIso !== "Invalid Date" ? pubIso : null,
        thumbnail: null,
      });
    }

    return { news: items };
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleApiRequest(
  request: Request
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Only handle GET /api/* routes
  if (request.method !== "GET" || !path.startsWith("/api/")) return null;

  try {
    // Health check
    if (path === "/api/" || path === "/api") {
      return jsonResponse({ message: "Stock Watchlist API is running" });
    }

    // Quote: /api/yahoo/quote/:ticker
    const quoteMatch = path.match(/^\/api\/yahoo\/quote\/(.+)$/);
    if (quoteMatch) {
      const ticker = decodeURIComponent(quoteMatch[1]);
      const data = await handleQuote(ticker);
      return jsonResponse(data);
    }

    // History: /api/yahoo/history/:ticker
    const historyMatch = path.match(/^\/api\/yahoo\/history\/(.+)$/);
    if (historyMatch) {
      const ticker = decodeURIComponent(historyMatch[1]);
      const period = url.searchParams.get("period") ?? "1mo";
      const data = await handleHistory(ticker, period);
      return jsonResponse(data);
    }

    // Search: /api/yahoo/search?q=...
    if (path === "/api/yahoo/search") {
      const q = url.searchParams.get("q") ?? "";
      const data = await handleSearch(q);
      return jsonResponse(data);
    }

    // News: /api/yahoo/news/:ticker
    const newsMatch = path.match(/^\/api\/yahoo\/news\/(.+)$/);
    if (newsMatch) {
      const ticker = decodeURIComponent(newsMatch[1]);
      const data = await handleNews(ticker);
      return jsonResponse(data);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (err) {
    console.error("[api-worker] error:", err);
    return jsonResponse({ error: (err as Error).message }, 502);
  }
}
