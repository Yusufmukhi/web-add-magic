"""
Stock Watchlist Backend (FastAPI + yfinance)
Run locally:  uvicorn server:app --reload --port 8000
"""
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import urllib.parse
import logging
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


@api_router.get("/")
async def api_root():
    return {"message": "Stock Watchlist API is running"}


@api_router.get("/yahoo/quote/{ticker}")
async def get_yahoo_quote(ticker: str):
    ticker = ticker.strip().upper()
    if not ticker:
        return {"error": "Ticker is required"}
    if not ticker.endswith(".NS"):
        ticker = f"{ticker}.NS"
    try:
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
    except Exception as exc:
        logger.error(f"Error fetching quote for {ticker}: {exc}")
        return {"error": str(exc)}


@api_router.get("/yahoo/chart/{ticker}")
async def get_yahoo_chart(ticker: str):
    ticker = ticker.strip().upper()
    if not ticker.endswith(".NS"):
        ticker = f"{ticker}.NS"
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


@api_router.get("/yahoo/search")
async def search_yahoo_stocks(q: str):
    query = q.strip().upper()
    if not query:
        return {"quotes": []}
    try:
        if not query.endswith(".NS"):
            query = f"{query}.NS"
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
        logger.error(f"Error searching Yahoo for {q}: {exc}")
        return {"error": str(exc)}


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


app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
