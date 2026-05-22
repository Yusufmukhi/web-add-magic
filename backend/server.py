"""
Stock Watchlist Backend (FastAPI + yfinance)
Run locally:  uvicorn server:app --reload --port 8000
"""
import time
import urllib.parse
import logging
from typing import Any, Callable

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stock-app")

app = FastAPI(title="Stock Watchlist Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# ---------- Simple in-memory TTL cache ------------------------------------
# Avoids hammering Yahoo (which rate-limits cloud IPs) for every page load.
# Structure: { key: (expires_at_epoch, value) }
# We also keep a "stale" copy used as a fallback when Yahoo returns 429.
_cache: dict[str, tuple[float, Any]] = {}
_stale: dict[str, Any] = {}


def _is_rate_limited(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    err = str(value.get("error", "")).lower()
    return "too many requests" in err or "rate limit" in err or "429" in err


def cached(key: str, ttl: float, producer: Callable[[], Any]) -> Any:
    """Return cached value if fresh; otherwise call producer and cache it.
    If producer fails or is rate-limited, fall back to the last good value."""
    now = time.time()
    hit = _cache.get(key)
    if hit and hit[0] > now:
        return hit[1]

    try:
        value = producer()
    except Exception as exc:
        logger.error(f"cache producer error for {key}: {exc}")
        if key in _stale:
            logger.info(f"serving stale cache for {key}")
            return _stale[key]
        return {"error": str(exc)}

    # If upstream returned a rate-limit error, prefer last good value
    if _is_rate_limited(value) and key in _stale:
        logger.warning(f"upstream rate-limited for {key}; serving stale cache")
        # Re-cache stale for a shorter window so we retry soon
        _cache[key] = (now + 15, _stale[key])
        return _stale[key]

    _cache[key] = (now + ttl, value)
    if not _is_rate_limited(value) and not (isinstance(value, dict) and value.get("error")):
        _stale[key] = value
    return value


# --------------------------------------------------------------------------


@api_router.get("/")
async def api_root():
    return {"message": "Stock Watchlist API is running"}


def _build_quote_payload(ticker: str) -> dict:
    stock = yf.Ticker(ticker)
    info = stock.info or {}
    return {
        "quoteSummary": {
            "result": [{
                "assetProfile": {
                    "longName":  info.get("longName", ticker),
                    "sector":    info.get("sector", ""),
                    "industry":  info.get("industry", ""),
                    "website":   info.get("website", ""),
                    "country":   info.get("country", ""),
                    "employees": info.get("fullTimeEmployees"),
                },
                "summaryDetail": {
                    "previousClose":    {"raw": info.get("previousClose", 0)},
                    "fiftyTwoWeekHigh": {"raw": info.get("fiftyTwoWeekHigh", 0)},
                    "fiftyTwoWeekLow":  {"raw": info.get("fiftyTwoWeekLow", 0)},
                    "marketCap":        {"raw": info.get("marketCap", 0)},
                    "trailingPE":       {"raw": info.get("trailingPE")},
                    "dividendYield":    {"raw": info.get("dividendYield")},
                },
                "financialData": {
                    "currentPrice":     {"raw": info.get("currentPrice", info.get("regularMarketPrice", 0))},
                    "debtToEquity":     {"raw": info.get("debtToEquity")},
                    "returnOnEquity":   {"raw": info.get("returnOnEquity")},
                    "totalRevenue":     {"raw": info.get("totalRevenue")},
                    "operatingMargins": {"raw": info.get("operatingMargins")},
                    "profitMargins":    {"raw": info.get("profitMargins")},
                    "revenueGrowth":    {"raw": info.get("revenueGrowth")},
                },
                "defaultKeyStatistics": {
                    "trailingEps":             {"raw": info.get("trailingEps")},
                    "priceToBook":             {"raw": info.get("priceToBook")},
                    "bookValue":               {"raw": info.get("bookValue")},
                    "heldPercentInsiders":     {"raw": info.get("heldPercentInsiders")},
                    "heldPercentInstitutions": {"raw": info.get("heldPercentInstitutions")},
                },
            }]
        }
    }


@api_router.get("/yahoo/quote/{ticker}")
async def get_yahoo_quote(ticker: str):
    ticker = ticker.strip().upper()
    if not ticker:
        return {"error": "Ticker is required"}
    if not ticker.endswith(".NS"):
        ticker = f"{ticker}.NS"

    def producer():
        try:
            return _build_quote_payload(ticker)
        except Exception as exc:
            logger.error(f"Error fetching quote for {ticker}: {exc}")
            return {"error": str(exc)}

    # 60s freshness for live quotes
    return cached(f"quote:{ticker}", ttl=60, producer=producer)


@api_router.get("/yahoo/chart/{ticker}")
async def get_yahoo_chart(ticker: str):
    ticker = ticker.strip().upper()
    if not ticker.endswith(".NS"):
        ticker = f"{ticker}.NS"

    def producer():
        try:
            stock = yf.Ticker(ticker)
            info = stock.info or {}
            return {
                "chart": {
                    "result": [{
                        "meta": {
                            "regularMarketPrice": info.get("currentPrice", info.get("regularMarketPrice", 0)),
                            "previousClose": info.get("previousClose", 0),
                        }
                    }]
                }
            }
        except Exception as exc:
            logger.error(f"Error fetching chart for {ticker}: {exc}")
            return {"error": str(exc)}

    return cached(f"chart:{ticker}", ttl=60, producer=producer)


@api_router.get("/yahoo/search")
async def search_yahoo_stocks(q: str):
    query = q.strip().upper()
    if not query:
        return {"quotes": []}
    if not query.endswith(".NS"):
        query = f"{query}.NS"

    def producer():
        try:
            stock = yf.Ticker(query)
            info = stock.info or {}
            if info and info.get("longName"):
                return {
                    "quotes": [{
                        "symbol": query,
                        "exchange": "NSI",
                        "quoteType": "EQUITY",
                        "longname": info.get("longName", ""),
                        "shortname": info.get("shortName", ""),
                    }]
                }
            return {"quotes": []}
        except Exception as exc:
            logger.error(f"Error searching Yahoo for {query}: {exc}")
            return {"error": str(exc)}

    # search results rarely change — cache 5 minutes
    return cached(f"search:{query}", ttl=300, producer=producer)


@api_router.get("/yahoo/history/{ticker}")
async def get_yahoo_history(ticker: str, period: str = "2y"):
    raw = urllib.parse.unquote(ticker).strip().upper()
    if raw.startswith("^"):
        symbol = raw
    elif raw.endswith(".NS"):
        symbol = raw
    else:
        symbol = f"{raw}.NS"
    allowed = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}
    if period not in allowed:
        period = "2y"

    def producer():
        try:
            stock = yf.Ticker(symbol)
            hist = stock.history(period=period)
            if hist.empty:
                return {"history": [], "symbol": symbol}
            data = [
                {"date": str(idx.date()), "close": round(float(row["Close"]), 2)}
                for idx, row in hist.iterrows()
            ]
            return {"history": data, "symbol": symbol}
        except Exception as exc:
            logger.error(f"Error fetching history for {symbol}: {exc}")
            return {"error": str(exc), "symbol": symbol}

    # historical data changes slowly — cache 30 minutes
    return cached(f"history:{symbol}:{period}", ttl=1800, producer=producer)


app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
