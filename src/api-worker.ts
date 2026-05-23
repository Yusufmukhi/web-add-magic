/**
 * Dalal Street — Stock API Worker
 *
 * Proxies Yahoo Finance requests server-side.
 * Uses Yahoo v8 chart API + cookie/crumb auth flow to avoid 401s.
 *
 * Routes:
 *   GET /api/yahoo/quote/:ticker
 *   GET /api/yahoo/history/:ticker?period=1mo
 *   GET /api/yahoo/search?q=...
 *   GET /api/
 */

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry { expiresAt: number; value: unknown }
const _cache = new Map<string, CacheEntry>();
const _stale = new Map<string, unknown>();

function cacheGet(key: string): unknown | null {
  const e = _cache.get(key);
  return e && e.expiresAt > Date.now() ? e.value : null;
}
function cacheSet(key: string, value: unknown, ttlMs: number): void {
  _cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  if (value && typeof value === "object" && !("error" in (value as Record<string, unknown>)))
    _stale.set(key, value);
}
async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet(key);
  if (hit !== null) return hit as T;
  try {
    const v = await fn();
    cacheSet(key, v, ttlMs);
    return v;
  } catch (err) {
    const stale = _stale.get(key);
    if (stale !== undefined) return stale as T;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance — cookie + crumb auth
// Yahoo requires: first GET consent page → extract cookie → get crumb → use both
// ---------------------------------------------------------------------------

let _crumb: string | null = null;
let _cookie: string | null = null;
let _crumbFetchedAt = 0;
const CRUMB_TTL = 55 * 60 * 1000; // refresh every 55 min

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
};

async function fetchCrumb(): Promise<{ crumb: string; cookie: string }> {
  // Step 1: hit Yahoo Finance to get session cookie
  const cookieRes = await fetch("https://finance.yahoo.com/", {
    headers: { ...BASE_HEADERS, "Accept": "text/html,application/xhtml+xml,*/*" },
    redirect: "follow",
  });
  const rawCookie = cookieRes.headers.get("set-cookie") ?? "";
  // Extract just the A3 or session cookies Yahoo needs
  const cookie = rawCookie
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.includes("="))
    .join("; ");

  // Step 2: fetch crumb using the cookie
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...BASE_HEADERS, Cookie: cookie },
  });
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes("<") || crumb.length > 20)
    throw new Error("Failed to get Yahoo crumb");
  return { crumb, cookie };
}

async function getAuth(): Promise<{ crumb: string; cookie: string }> {
  const now = Date.now();
  if (_crumb && _cookie && now - _crumbFetchedAt < CRUMB_TTL)
    return { crumb: _crumb, cookie: _cookie };
  const auth = await fetchCrumb();
  _crumb = auth.crumb;
  _cookie = auth.cookie;
  _crumbFetchedAt = now;
  return auth;
}

async function yfFetch(url: string): Promise<unknown> {
  const { crumb, cookie } = await getAuth();
  const fullUrl = url.includes("?") ? `${url}&crumb=${encodeURIComponent(crumb)}` : `${url}?crumb=${encodeURIComponent(crumb)}`;
  const res = await fetch(fullUrl, {
    headers: { ...BASE_HEADERS, Cookie: cookie, Origin: "https://finance.yahoo.com", Referer: "https://finance.yahoo.com/" },
  });
  if (res.status === 401 || res.status === 403) {
    // Crumb expired mid-session — force refresh and retry once
    _crumb = null; _cookie = null;
    const auth2 = await getAuth();
    const retryUrl = url.includes("?")
      ? `${url}&crumb=${encodeURIComponent(auth2.crumb)}`
      : `${url}?crumb=${encodeURIComponent(auth2.crumb)}`;
    const res2 = await fetch(retryUrl, {
      headers: { ...BASE_HEADERS, Cookie: auth2.cookie, Origin: "https://finance.yahoo.com", Referer: "https://finance.yahoo.com/" },
    });
    if (!res2.ok) throw new Error(`Yahoo Finance HTTP ${res2.status}`);
    return res2.json();
  }
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// NSE symbol helper
// ---------------------------------------------------------------------------
function toNS(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.startsWith("^")) return t;
  return t.endsWith(".NS") ? t : `${t}.NS`;
}

// ---------------------------------------------------------------------------
// Quote  →  /api/yahoo/quote/:ticker
// Uses v8 chart + v10 quoteSummary fallback, both with crumb auth
// ---------------------------------------------------------------------------
async function handleQuote(ticker: string): Promise<unknown> {
  const symbol = toNS(ticker);
  return withCache(`quote:${symbol}`, 60_000, async () => {
    const modules = "assetProfile,summaryDetail,financialData,defaultKeyStatistics";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&formatted=true&lang=en-US&region=US`;
    return yfFetch(url);
  });
}

// ---------------------------------------------------------------------------
// History  →  /api/yahoo/history/:ticker?period=1mo
// ---------------------------------------------------------------------------
const ALLOWED_PERIODS = new Set(["1d","5d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"]);
const PERIOD_INTERVAL: Record<string, string> = {
  "1d":"1m","5d":"5m","1mo":"1d","3mo":"1d","6mo":"1d",
  "1y":"1wk","2y":"1wk","5y":"1mo","10y":"1mo","ytd":"1d","max":"1mo",
};

async function handleHistory(ticker: string, period: string): Promise<unknown> {
  const symbol = toNS(ticker);
  if (!ALLOWED_PERIODS.has(period)) period = "1mo";
  const interval = PERIOD_INTERVAL[period] ?? "1d";
  const ttl = ["1d","5d"].includes(period) ? 60_000 : 30 * 60_000;

  return withCache(`history:${symbol}:${period}`, ttl, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}&includePrePost=false`;
    const raw = await yfFetch(url) as {
      chart?: { result?: Array<{ timestamp?: number[]; indicators?: { adjclose?: Array<{adjclose?: number[]}>; quote?: Array<{close?: number[]}> } }>; error?: unknown };
    };
    if (raw?.chart?.error) return { error: String(raw.chart.error), symbol };
    const result = raw?.chart?.result?.[0];
    if (!result) return { history: [], symbol };
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? [];
    const history = timestamps
      .map((ts, i) => { const c = closes[i]; if (c == null || isNaN(c)) return null; return { date: new Date(ts * 1000).toISOString().slice(0,10), close: Math.round(c * 100) / 100 }; })
      .filter(Boolean);
    return { history, symbol };
  });
}

// ---------------------------------------------------------------------------
// Search  →  /api/yahoo/search?q=...
// ---------------------------------------------------------------------------
async function handleSearch(query: string): Promise<unknown> {
  const q = query.trim().toUpperCase();
  if (!q) return { quotes: [] };
  return withCache(`search:${toNS(q)}`, 5 * 60_000, async () => {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=IN&quotesCount=10&newsCount=0&listsCount=0`;
    const raw = await yfFetch(url) as { quotes?: Array<{ symbol?: string; exchange?: string; quoteType?: string; longname?: string; shortname?: string }> };
    const quotes = (raw?.quotes ?? [])
      .filter((q) => q.exchange === "NSI" && q.quoteType === "EQUITY")
      .map((q) => ({ symbol: q.symbol, exchange: q.exchange, quoteType: q.quoteType, longname: q.longname ?? "", shortname: q.shortname ?? "" }));
    return { quotes };
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS")
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" } });

  if (request.method !== "GET" || !path.startsWith("/api/")) return null;

  try {
    if (path === "/api/" || path === "/api")
      return json({ message: "Stock Watchlist API is running" });

    const quoteMatch = path.match(/^\/api\/yahoo\/quote\/(.+)$/);
    if (quoteMatch) return json(await handleQuote(decodeURIComponent(quoteMatch[1])));

    const historyMatch = path.match(/^\/api\/yahoo\/history\/(.+)$/);
    if (historyMatch) return json(await handleHistory(decodeURIComponent(historyMatch[1]), url.searchParams.get("period") ?? "1mo"));

    if (path === "/api/yahoo/search") return json(await handleSearch(url.searchParams.get("q") ?? ""));

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("[api-worker]", err);
    return json({ error: (err as Error).message }, 502);
  }
}
