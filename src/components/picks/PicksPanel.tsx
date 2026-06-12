/**
 * PicksPanel — 3 tabs:
 * 1. Stock Screener — real Yahoo Finance data, scored by fundamentals
 * 2. Smart Money — Gemini + live search for FII/DII/ace investor flows
 * 3. Theme Engine — macro/sector ripple impact mapping
 */

import { useState, useCallback, useEffect } from "react";
import {
  TrendingUp, Building2, Layers, Zap, Gem,
  Users, Eye, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, AlertCircle, BarChart2, ArrowUpRight,
  Star, Info, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchQuote } from "@/services/api";
import type { StockQuote } from "@/types/stock.types";
import { ThemeEngine } from "./ThemeEngine";
import {
  getSupabaseConfig, isStale, ageLabel,
  getThesis, saveThesis,
  getSmartMoney, saveSmartMoney,
  getUniverse, saveUniverse,
} from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type CapCategory = "largecap" | "midcap" | "smallcap" | "sme";
type SmartTab = "fiidii" | "ace" | "analyst";
type MainTab = "screener" | "smartmoney" | "themes";

interface ScoredStock {
  ticker: string;
  quote: StockQuote;
  score: number;
  scoreBreakdown: string[];
  fallFromHigh: number;
  thesis?: string;
  thesisLoading?: boolean;
}

interface SmartMoneyEntry {
  ticker: string;
  name: string;
  detail: string;
  signal: string;
  extra: string;
  type: "fiidii" | "ace" | "analyst";
}

// ─── Stock universes ──────────────────────────────────────────────────────────

const UNIVERSES: Record<CapCategory, string[]> = {
  largecap: [
    "HDFCBANK", "AXISBANK", "ICICIBANK", "KOTAKBANK", "SBIN",
    "TATAMOTORS", "MARUTI", "BAJAJ-AUTO", "HEROMOTOCO", "M&M",
    "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB",
    "WIPRO", "TECHM", "LTIM", "HCLTECH",
    "TITAN", "HINDUNILVR", "NESTLEIND", "DABUR",
    "NTPC", "POWERGRID", "ONGC", "COALINDIA",
    "JSWSTEEL", "TATASTEEL", "HINDALCO",
    "BAJFINANCE", "BAJAJFINSV",
  ],
  midcap: [
    "PERSISTENT", "COFORGE", "MPHASIS", "KSOLVES",
    "APOLLOHOSP", "METROPOLIS",
    "SUPREMEIND", "ASTRAL", "PRINCEPIPE",
    "CAMS", "CDSL",
    "IRCTC", "CONCOR",
    "IDFCFIRSTB", "FEDERALBNK", "KARURVYSYA",
    "SCHAEFFLER", "TIMKEN", "GRINDWELL",
    "JKCEMENT", "RAMCOCEM",
    "TRENT", "APLAPOLLO",
    "SOLARINDS", "CLEAN",
  ],
  smallcap: [
    "APOLLOMICRO", "DATAMATICS", "NUCLEUS",
    "KAYNES", "SYRMA", "AVALON",
    "RATEGAIN", "ROUTE",
    "RVNL", "IRFC", "RAILTEL",
    "SUZLON", "INOXWIND",
    "ELECON", "TITAGARH",
    "PNBHOUSING", "AAVAS",
    "GPIL", "MANINFRA",
    "MTAR",
  ],
  sme: [
    "YATHARTH", "ARCHEAN", "GANDHAR",
    "SENCO", "AZAD",
    "NYKAA", "ZOMATO", "DELHIVERY",
    "IDEAFORGE", "IXIGO",
    "WAAREE", "INOXGREEN",
  ],
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface ScoreResult { score: number; breakdown: string[]; }

function scoreLargecap(q: StockQuote, fallFromHigh: number): ScoreResult {
  let score = 0; const breakdown: string[] = [];
  if (fallFromHigh >= 30) { score += 30; breakdown.push(`▼${fallFromHigh.toFixed(0)}% from 52W high`); }
  else if (fallFromHigh >= 20) { score += 20; breakdown.push(`▼${fallFromHigh.toFixed(0)}% from high`); }
  else if (fallFromHigh >= 10) { score += 10; breakdown.push(`▼${fallFromHigh.toFixed(0)}% from high`); }
  if (q.returnOnEquity != null && q.returnOnEquity > 0.15) { score += 20; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(0)}%`); }
  else if (q.returnOnEquity != null && q.returnOnEquity > 0.10) { score += 10; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(0)}%`); }
  if (q.operatingMargins != null && q.operatingMargins > 0.15) { score += 15; breakdown.push(`OPM ${(q.operatingMargins * 100).toFixed(0)}%`); }
  if (q.pe != null && q.pe > 0 && q.pe < 20) { score += 20; breakdown.push(`PE ${q.pe.toFixed(1)}x cheap`); }
  else if (q.pe != null && q.pe > 0 && q.pe < 30) { score += 10; breakdown.push(`PE ${q.pe.toFixed(1)}x`); }
  if (q.debtToEquity != null && q.debtToEquity < 0.5) { score += 10; breakdown.push("Low leverage"); }
  if (q.heldPercentInstitutions != null && q.heldPercentInstitutions > 0.4) { score += 5; breakdown.push("High inst. hold"); }
  return { score, breakdown };
}

function scoreMidcap(q: StockQuote): ScoreResult {
  let score = 0; const breakdown: string[] = [];
  if (q.returnOnEquity != null && q.returnOnEquity > 0.20) { score += 30; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(0)}% excellent`); }
  else if (q.returnOnEquity != null && q.returnOnEquity > 0.15) { score += 20; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(0)}%`); }
  if (q.revenueGrowth != null && q.revenueGrowth > 0.20) { score += 25; breakdown.push(`Rev +${(q.revenueGrowth * 100).toFixed(0)}% YoY`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.12) { score += 15; breakdown.push(`Rev +${(q.revenueGrowth * 100).toFixed(0)}% YoY`); }
  if (q.operatingMargins != null && q.operatingMargins > 0.15) { score += 20; breakdown.push(`OPM ${(q.operatingMargins * 100).toFixed(0)}%`); }
  if (q.debtToEquity != null && q.debtToEquity < 0.3) { score += 15; breakdown.push("Near debt-free"); }
  else if (q.debtToEquity != null && q.debtToEquity < 0.7) { score += 8; breakdown.push("Low debt"); }
  if (q.pe != null && q.pe > 0 && q.pe < 40) { score += 10; breakdown.push(`PE ${q.pe.toFixed(1)}x`); }
  return { score, breakdown };
}

function scoreSmallcap(q: StockQuote, fallFromHigh: number): ScoreResult {
  let score = 0; const breakdown: string[] = [];
  if (q.revenueGrowth != null && q.revenueGrowth > 0.30) { score += 35; breakdown.push(`Rev +${(q.revenueGrowth * 100).toFixed(0)}% YoY`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.20) { score += 25; breakdown.push(`Rev +${(q.revenueGrowth * 100).toFixed(0)}% YoY`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.10) { score += 15; breakdown.push(`Rev +${(q.revenueGrowth * 100).toFixed(0)}%`); }
  if (q.operatingMargins != null && q.operatingMargins > 0.12) { score += 20; breakdown.push(`OPM ${(q.operatingMargins * 100).toFixed(0)}%`); }
  if (q.returnOnEquity != null && q.returnOnEquity > 0.15) { score += 20; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(0)}%`); }
  if (q.debtToEquity != null && q.debtToEquity < 0.3) { score += 15; breakdown.push("Debt-free"); }
  if (fallFromHigh >= 15 && fallFromHigh <= 40) { score += 10; breakdown.push(`▼${fallFromHigh.toFixed(0)}% entry`); }
  return { score, breakdown };
}

function scoreSME(q: StockQuote): ScoreResult {
  let score = 0; const breakdown: string[] = [];
  if (q.revenueGrowth != null && q.revenueGrowth > 0.40) { score += 40; breakdown.push(`Rev +${(q.revenueGrowth * 100).toFixed(0)}% explosive`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.25) { score += 30; breakdown.push(`Rev +${(q.revenueGrowth * 100).toFixed(0)}%`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.15) { score += 15; breakdown.push(`Rev +${(q.revenueGrowth * 100).toFixed(0)}%`); }
  if (q.debtToEquity != null && q.debtToEquity < 0.2) { score += 20; breakdown.push("Debt-free"); }
  else if (q.debtToEquity != null && q.debtToEquity < 0.5) { score += 10; breakdown.push("Low debt"); }
  if (q.returnOnEquity != null && q.returnOnEquity > 0.20) { score += 25; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(0)}%`); }
  else if (q.returnOnEquity != null && q.returnOnEquity > 0.12) { score += 15; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(0)}%`); }
  if (q.operatingMargins != null && q.operatingMargins > 0.18) { score += 15; breakdown.push(`OPM ${(q.operatingMargins * 100).toFixed(0)}%`); }
  return { score, breakdown };
}

function scoreStock(category: CapCategory, q: StockQuote): ScoreResult {
  const fallFromHigh = q.fiftyTwoWeekHigh > 0
    ? ((q.fiftyTwoWeekHigh - q.cmp) / q.fiftyTwoWeekHigh) * 100 : 0;
  switch (category) {
    case "largecap": return scoreLargecap(q, fallFromHigh);
    case "midcap":   return scoreMidcap(q);
    case "smallcap": return scoreSmallcap(q, fallFromHigh);
    case "sme":      return scoreSME(q);
  }
}

// ─── Gemini helpers ───────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

type GeminiPart = { text?: string; thought?: boolean };
function extractGeminiText(data: unknown): string {
  const parts = (data as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> })
    ?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string).join("");
}

async function generateThesis(apiKey: string, ticker: string, quote: StockQuote, category: CapCategory): Promise<string> {
  const fallFromHigh = quote.fiftyTwoWeekHigh > 0
    ? ((quote.fiftyTwoWeekHigh - quote.cmp) / quote.fiftyTwoWeekHigh * 100).toFixed(1) : "N/A";
  const categoryContext: Record<CapCategory, string> = {
    largecap: "a large cap recovery play — quality company fallen from highs with re-rating potential",
    midcap: "a mid cap compounder — consistently growing, capable of 5-10x in 5-7 years",
    smallcap: "a small cap multibagger candidate — early stage in a sector boom",
    sme: "an SME generational wealth play — potential 20-30x in 7-10 years",
  };
  const prompt = `You are analysing ${ticker} (${quote.name ?? ticker}) screened as ${categoryContext[category]}.

REAL LIVE DATA (Yahoo Finance):
CMP: ₹${quote.cmp.toFixed(2)} | Mkt Cap: ${quote.marketCap > 0 ? (quote.marketCap / 1e7).toFixed(0) + " Cr" : "N/A"}
52W High: ₹${quote.fiftyTwoWeekHigh.toFixed(2)} | Fall: ${fallFromHigh}% | 52W Low: ₹${quote.fiftyTwoWeekLow.toFixed(2)}
PE: ${quote.pe?.toFixed(1) ?? "N/A"} | P/B: ${quote.pb?.toFixed(2) ?? "N/A"} | ROE: ${quote.returnOnEquity != null ? (quote.returnOnEquity * 100).toFixed(1) + "%" : "N/A"}
OPM: ${quote.operatingMargins != null ? (quote.operatingMargins * 100).toFixed(1) + "%" : "N/A"} | Rev Growth: ${quote.revenueGrowth != null ? (quote.revenueGrowth * 100).toFixed(1) + "%" : "N/A"} | D/E: ${quote.debtToEquity?.toFixed(2) ?? "N/A"}
Sector: ${quote.sector ?? "N/A"}

Use Google Search to find: latest quarterly results, recent order wins, business catalyst, management quality.

Write a concise investment thesis. Format exactly:
**Thesis:** [2 sentences on the investment case using the real data above]
**Key Catalyst:** [1 specific near-term trigger]
**Main Risk:** [1 specific risk]
**Conviction:** High / Medium / Low`;

  const res = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return extractGeminiText(await res.json());
}

async function fetchSmartMoneyData(apiKey: string, tab: SmartTab): Promise<SmartMoneyEntry[]> {
  const prompts: Record<SmartTab, string> = {
    fiidii: `Search NSE/BSE shareholding disclosures for Indian stocks where FII holding increased more than 0.5% QoQ in the most recent quarter. Also include stocks where both FII AND DII are simultaneously buying. Include small and mid cap stocks where smart money is quietly accumulating.
Return ONLY a valid JSON array, no markdown:
[{"ticker":"NSE_TICKER","name":"Company Name","detail":"FII +1.8% QoQ to 24.3%","signal":"FII Accumulation","extra":"DII also added 0.5%","type":"fiidii"}]
Give exactly 12 entries with exact NSE tickers. Prioritise stocks with meaningful FII/DII increases, not token additions.`,
    ace: `Search latest quarterly portfolio filings for Indian ace investors: Ashish Kacholia, Vijay Kedia, Dolly Khanna, Mukul Agrawal, Porinju Veliyath, Rekha Jhunjhunwala, Sunil Singhania, Ramesh Damani. Find stocks where any ace investor INCREASED stake in the most recent quarter or took a new position.
Return ONLY a valid JSON array, no markdown:
[{"ticker":"NSE_TICKER","name":"Company Name","detail":"Ashish Kacholia increased to 3.2% (+0.4% QoQ)","signal":"Ace Investor Adding","extra":"Known for niche manufacturing plays","type":"ace"}]
Give exactly 12 entries with exact NSE tickers. Include a mix of different investors.`,
    analyst: `Search for Indian stocks with the most Buy/Strong Buy ratings from Motilal Oswal, Kotak, ICICI Direct, Nuvama, Emkay, JM Financial, Axis Securities, HDFC Securities in the last 30 days. Include stocks with 3+ Buy ratings and upside >15%. Cover mid and small caps too, not just large caps.
Return ONLY a valid JSON array, no markdown:
[{"ticker":"NSE_TICKER","name":"Company Name","detail":"4 Buy ratings — avg target ₹850 (+28% upside)","signal":"Strong Analyst Consensus","extra":"Motilal Oswal initiated with Buy, target ₹900","type":"analyst"}]
Give exactly 12 entries with exact NSE tickers. Prioritise fresh ratings from the last 2 weeks.`,
  };

  const res = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompts[tab] }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = extractGeminiText(await res.json());
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = clean.indexOf("["); const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array in response");
  const parsed = JSON.parse(clean.slice(start, end + 1)) as SmartMoneyEntry[];
  if (!Array.isArray(parsed)) throw new Error("Invalid format");
  return parsed;
}

// ─── Dynamic stock universe via Gemini (replaces hardcoded UNIVERSES) ─────────

// ─── Gemini picks 15 stocks directly ─────────────────────────────────────────
// No "universe" concept. Gemini searches and selects 15 best stocks.
// Results cached in Supabase for 24h so Gemini isn't called every page load.

const CATEGORY_PROMPT: Record<CapCategory, string> = {
  largecap: "large cap Indian stocks (Nifty 50 / Nifty Next 50, market cap above ₹20,000 Cr)",
  midcap:   "mid cap Indian stocks (Nifty Midcap 150, market cap ₹5,000–20,000 Cr)",
  smallcap: "small cap Indian stocks (market cap ₹500–5,000 Cr, NSE-listed)",
  sme:      "SME and recently listed Indian stocks (NSE SME board, IPO in last 3 years, high-growth sectors)",
};

async function getGeminiPicks(apiKey: string, category: CapCategory): Promise<string[]> {
  // Step 1 — Gemini searches and picks 15 stocks (free text — no JSON)
  const r1 = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        `Search Screener.in, Moneycontrol, NSE India, and recent financial news to find the 15 best ${CATEGORY_PROMPT[category]} to buy or watch right now.

Pick stocks with:
- Strong fundamentals (good ROE, revenue growth, healthy margins)
- Reasonable valuation (not overpriced PE)
- Upcoming catalyst or current sector tailwind
- Cover at least 4–5 different sectors

List each as: NSE_TICKER — Company Name — Sector — Why interesting now` }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
    }),
  });
  if (!r1.ok) {
    const e = await r1.json().catch(() => ({}));
    throw new Error((e as { error?: { message?: string } })?.error?.message ?? `HTTP ${r1.status}`);
  }
  const pickText = extractGeminiText(await r1.json());
  if (!pickText || pickText.length < 50) throw new Error("Gemini returned no picks — try again");

  // Step 2 — Extract ONLY the NSE tickers as a clean JSON array
  const r2 = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        `Extract ONLY the NSE ticker symbols from the stock list below. Return a JSON array of strings. Nothing else — no explanation, no markdown.

${pickText}

Format: ["TICKER1","TICKER2",...] — uppercase NSE tickers, no .NS suffix.` }] }],
      generationConfig: { temperature: 0.0, maxOutputTokens: 400, responseMimeType: "application/json" },
    }),
  });
  if (!r2.ok) throw new Error(`Ticker extract HTTP ${r2.status}`);
  const raw = extractGeminiText(await r2.json());
  const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const s = clean.indexOf("["), e = clean.lastIndexOf("]");
  if (s === -1 || e === -1) throw new Error("Could not extract tickers from Gemini response");
  const tickers = JSON.parse(clean.slice(s, e + 1)) as string[];
  if (!Array.isArray(tickers) || tickers.length === 0) throw new Error("No tickers returned");
  return [
    ...new Set(
      tickers
        .map((t) => String(t).toUpperCase().replace(/\.NS$/i, "").trim())
        .filter((t) => t.length >= 2 && t.length <= 20 && /^[A-Z0-9&-]+$/.test(t))
    ),
  ];
}


const CAP_CONFIG: Record<CapCategory, {
  label: string; icon: React.ElementType; description: string;
  horizon: string; minScore: number;
}> = {
  largecap: { label: "Large Cap Recovery", icon: Building2, description: "Quality large caps fallen 20%+ from highs — strong fundamentals screened", horizon: "6–18 months", minScore: 40 },
  midcap:   { label: "Mid Cap Compounders", icon: Layers,   description: "High-ROE, high-growth mid caps on path to become large caps", horizon: "2–4 years", minScore: 45 },
  smallcap: { label: "Small Cap Multibaggers", icon: Zap,   description: "Sector-boom small caps with 3–5x potential — real financials screened", horizon: "2–3 years", minScore: 40 },
  sme:      { label: "SME / Emerging", icon: Gem,           description: "High-growth emerging companies in future-tech sectors", horizon: "5–7 years", minScore: 30 },
};

// ─── Stock card ───────────────────────────────────────────────────────────────

function StockCard({ stock, category, apiKey, onAnalyse, onGenerateThesis }: {
  stock: ScoredStock; category: CapCategory; apiKey: string;
  onAnalyse: (t: string) => void; onGenerateThesis: (ticker: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { quote: q, fallFromHigh, score, scoreBreakdown, thesis, thesisLoading } = stock;
  const dayUp = q.dayChangePct >= 0;
  const marketCapCr = q.marketCap / 1e7;

  return (
    <Card className="p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-bold text-sm text-foreground">{stock.ticker}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
              score >= 70 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
              score >= 50 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
              "bg-muted text-muted-foreground")}>Score {score}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[180px]">{q.name}</p>
          <p className="text-[10px] text-muted-foreground/60">{q.sector}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-bold text-sm text-foreground">₹{q.cmp.toFixed(2)}</p>
          <p className={cn("text-xs font-semibold", dayUp ? "text-emerald-500" : "text-red-500")}>
            {dayUp ? "▲" : "▼"} {Math.abs(q.dayChangePct).toFixed(2)}%
          </p>
          {marketCapCr > 0 && <p className="text-[10px] text-muted-foreground">{(marketCapCr / 100).toFixed(0)} Cr</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {scoreBreakdown.map((b) => (
          <span key={b} className="rounded-full bg-primary/8 border border-primary/20 px-2 py-0.5 text-[10px] text-primary/80">{b}</span>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: "PE", val: q.pe != null ? `${q.pe.toFixed(1)}x` : "—" },
          { label: "ROE", val: q.returnOnEquity != null ? `${(q.returnOnEquity * 100).toFixed(0)}%` : "—" },
          { label: "OPM", val: q.operatingMargins != null ? `${(q.operatingMargins * 100).toFixed(0)}%` : "—" },
          { label: "52W↓", val: fallFromHigh > 0 ? `${fallFromHigh.toFixed(0)}%` : "—" },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-md bg-muted/40 py-1">
            <p className="text-[9px] text-muted-foreground">{label}</p>
            <p className="text-xs font-semibold text-foreground">{val}</p>
          </div>
        ))}
      </div>

      {q.fiftyTwoWeekHigh > 0 && q.fiftyTwoWeekLow > 0 && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>₹{q.fiftyTwoWeekLow.toFixed(0)} 52W Low</span>
            <span>52W High ₹{q.fiftyTwoWeekHigh.toFixed(0)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary/60"
              style={{ width: `${Math.min(100, ((q.cmp - q.fiftyTwoWeekLow) / (q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow)) * 100)}%` }} />
          </div>
        </div>
      )}

      {expanded && (
        <div className="pt-1 space-y-2 border-t border-border">
          {thesis ? (
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
              {thesis.split("\n").filter((l) => l.trim()).map((line, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
              ))}
            </div>
          ) : thesisLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Generating thesis with live data...
            </div>
          ) : apiKey ? (
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs w-full" onClick={() => onGenerateThesis(stock.ticker)}>
              <Sparkles className="h-3 w-3" /> Generate AI Thesis (Gemini + live search)
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Add Gemini API key in Research tab to generate thesis</p>
          )}

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {[
              ["Rev Growth", q.revenueGrowth != null ? `${(q.revenueGrowth * 100).toFixed(1)}%` : "—"],
              ["D/E", q.debtToEquity != null ? q.debtToEquity.toFixed(2) : "—"],
              ["Inst. Hold", q.heldPercentInstitutions != null ? `${(q.heldPercentInstitutions * 100).toFixed(1)}%` : "—"],
              ["Div Yield", q.dividendYield != null ? `${(q.dividendYield * 100).toFixed(2)}%` : "—"],
              ["EPS", q.eps != null ? `₹${q.eps.toFixed(2)}` : "—"],
              ["P/B", q.pb != null ? `${q.pb.toFixed(2)}x` : "—"],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground text-[11px]">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-0.5">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Less" : "Details + Thesis"}
        </button>
        <button onClick={() => onAnalyse(stock.ticker)} className="flex items-center gap-1 text-[11px] text-primary hover:underline transition-colors">
          <Sparkles className="h-3 w-3" /> Full Report <ArrowUpRight className="h-2.5 w-2.5" />
        </button>
        <a href={`https://www.screener.in/company/${stock.ticker}/`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-auto">
          Screener <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </Card>
  );
}

// ─── Smart money card ─────────────────────────────────────────────────────────

function SmartMoneyCard({ entry, onAnalyse }: { entry: SmartMoneyEntry; onAnalyse: (t: string) => void }) {
  return (
    <Card className="p-4 space-y-2 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-foreground">{entry.ticker}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
              entry.type === "fiidii" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
              entry.type === "ace" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
              "bg-blue-500/15 text-blue-600 dark:text-blue-400")}>
              {entry.signal}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.name}</p>
        </div>
        <button onClick={() => onAnalyse(entry.ticker)} className="flex items-center gap-0.5 text-[10px] text-primary hover:underline shrink-0">
          <Sparkles className="h-3 w-3" /> Report
        </button>
      </div>
      <p className="text-xs font-medium text-foreground">{entry.detail}</p>
      <p className="text-[11px] text-muted-foreground">{entry.extra}</p>
    </Card>
  );
}

// ─── Loading grid ─────────────────────────────────────────────────────────────

function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 space-y-3 animate-pulse">
          <div className="flex justify-between">
            <div className="space-y-1.5"><div className="h-4 w-24 rounded bg-muted" /><div className="h-3 w-36 rounded bg-muted" /></div>
            <div className="space-y-1.5"><div className="h-4 w-20 rounded bg-muted" /><div className="h-3 w-14 rounded bg-muted" /></div>
          </div>
          <div className="grid grid-cols-4 gap-1">{[1,2,3,4].map((j) => <div key={j} className="h-8 rounded bg-muted" />)}</div>
          <div className="h-3 w-full rounded bg-muted" />
        </Card>
      ))}
    </div>
  );
}

// ─── Main PicksPanel ──────────────────────────────────────────────────────────

interface PicksPanelProps {
  onNavigateToResearch?: (ticker: string) => void;
}

export function PicksPanel({ onNavigateToResearch }: PicksPanelProps) {
  const apiKey = localStorage.getItem("gemini_api_key") ?? "";

  const [mainTab, setMainTab] = useState<MainTab>("screener");
  const [activeCapTab, setActiveCapTab] = useState<CapCategory>("largecap");
  const [smartTab, setSmartTab] = useState<SmartTab>("fiidii");

  const [picksCache, setPicksCache] = useState<Partial<Record<CapCategory, ScoredStock[]>>>({});
  const [picksLoading, setPicksLoading] = useState<CapCategory | null>(null);
  const [picksTime, setPicksTime] = useState<Partial<Record<CapCategory, string>>>({});
  const [picksError, setPicksError] = useState<string | null>(null);

  const [smartCache, setSmartCache] = useState<Partial<Record<SmartTab, SmartMoneyEntry[]>>>({});
  const [smartLoading, setSmartLoading] = useState<SmartTab | null>(null);
  const [smartTime, setSmartTime] = useState<Partial<Record<SmartTab, string>>>({});

  const runScreener = useCallback(async (category: CapCategory, force = false) => {
    if (!force && picksCache[category]) return;
    setPicksLoading(category);
    setPicksError(null);
    const config = CAP_CONFIG[category];

    try {
      // ── Get 15 stocks from Gemini (or Supabase cache), fallback to hardcoded ──
      let tickers: string[];
      let source = "curated";

      if (apiKey) {
        const hasSB = !!getSupabaseConfig();
        try {
          if (hasSB && !force) {
            const cached = await getUniverse(category);
            if (cached && cached.length > 0) {
              tickers = cached;
              source = "cached";
            } else {
              tickers = await getGeminiPicks(apiKey, category);
              await saveUniverse(category, tickers);
              source = "live";
            }
          } else {
            tickers = await getGeminiPicks(apiKey, category);
            if (hasSB) await saveUniverse(category, tickers);
            source = "live";
          }
        } catch {
          tickers = UNIVERSES[category]; // fallback if Gemini fails
          source = "curated";
        }
      } else {
        tickers = UNIVERSES[category];
      }

      // ── Fetch real Yahoo Finance data for each ticker ────────────────────
      const BATCH = 5;
      const quotes: { ticker: string; quote: StockQuote | null }[] = [];
      for (let i = 0; i < tickers.length; i += BATCH) {
        const batch = tickers.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (t) => ({ ticker: t, quote: await fetchQuote(t + ".NS") }))
        );
        for (const r of results) if (r.status === "fulfilled") quotes.push(r.value);
        if (i + BATCH < tickers.length) await new Promise((r) => setTimeout(r, 300));
      }

      // ── Score + show all that pass threshold ────────────────────────────
      const scored: ScoredStock[] = quotes
        .filter((q) => q.quote != null && q.quote.cmp > 0)
        .map(({ quote }) => {
          const q = quote!;
          const fallFromHigh = q.fiftyTwoWeekHigh > 0
            ? ((q.fiftyTwoWeekHigh - q.cmp) / q.fiftyTwoWeekHigh) * 100 : 0;
          const { score, breakdown } = scoreStock(category, q);
          return { ticker: q.ticker.replace(".NS", ""), quote: q, score, scoreBreakdown: breakdown, fallFromHigh };
        })
        .filter((s) => s.score >= config.minScore)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) {
        setPicksError("No stocks passed the score filters. Try refreshing — Gemini may pick different stocks next time.");
      }
      setPicksCache((prev) => ({ ...prev, [category]: scored }));
      setPicksTime((prev) => ({
        ...prev,
        [category]: source === "live"
          ? `Gemini picks · ${new Date().toLocaleTimeString("en-IN")}`
          : source === "cached"
          ? `Cached picks · ${new Date().toLocaleTimeString("en-IN")}`
          : new Date().toLocaleTimeString("en-IN"),
      }));
    } catch (err) {
      setPicksError(`Screener failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setPicksLoading(null);
    }
  }, [picksCache, apiKey]);

  const handleGenerateThesis = useCallback(async (ticker: string) => {
    if (!apiKey) { toast.error("Add Gemini API key in Research tab first"); return; }
    const allPicks = Object.values(picksCache).flat();
    const stock = allPicks.find((s) => s?.ticker === ticker);
    if (!stock) return;

    // 1. Check Supabase cache first
    const hasSB = !!getSupabaseConfig();
    if (hasSB) {
      const cached = await getThesis(ticker);
      if (cached && !isStale(cached.updated_at)) {
        // Serve from cache
        const freshLabel = ageLabel(cached.updated_at);
        setPicksCache((prev) => {
          const updated = { ...prev };
          for (const cat of Object.keys(updated) as CapCategory[]) {
            updated[cat] = updated[cat]?.map((s) =>
              s.ticker === ticker
                ? { ...s, thesis: cached.thesis + `\n\n*📦 Cached ${freshLabel} — click refresh to regenerate*`, thesisLoading: false }
                : s
            );
          }
          return updated;
        });
        return;
      }
    }

    // 2. Mark as loading
    setPicksCache((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated) as CapCategory[]) {
        updated[cat] = updated[cat]?.map((s) => s.ticker === ticker ? { ...s, thesisLoading: true } : s);
      }
      return updated;
    });

    try {
      const thesis = await generateThesis(apiKey, ticker, stock.quote, activeCapTab);

      // 3. Store in Supabase
      if (hasSB) await saveThesis(ticker, activeCapTab, thesis);

      setPicksCache((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated) as CapCategory[]) {
          updated[cat] = updated[cat]?.map((s) => s.ticker === ticker ? { ...s, thesis, thesisLoading: false } : s);
        }
        return updated;
      });
    } catch {
      toast.error("Thesis generation failed — check your Gemini API key");
      setPicksCache((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated) as CapCategory[]) {
          updated[cat] = updated[cat]?.map((s) => s.ticker === ticker ? { ...s, thesisLoading: false } : s);
        }
        return updated;
      });
    }
  }, [apiKey, picksCache, activeCapTab]);

  const runSmartMoney = useCallback(async (tab: SmartTab, force = false) => {
    if (!apiKey) { toast.error("Add Gemini API key in the Research tab to use Smart Money"); return; }

    // 1. Check Supabase cache (unless forced refresh)
    if (!force) {
      const hasSB = !!getSupabaseConfig();
      if (hasSB) {
        const cached = await getSmartMoney(tab);
        if (cached && !isStale(cached.updated_at)) {
          try {
            const entries = JSON.parse(cached.entries_json) as SmartMoneyEntry[];
            setSmartCache((prev) => ({ ...prev, [tab]: entries }));
            setSmartTime((prev) => ({ ...prev, [tab]: `Cached ${ageLabel(cached.updated_at)}` }));
            return;
          } catch { /* ignore parse error, fall through to fresh fetch */ }
        }
      }
      if (smartCache[tab]) return;
    }

    setSmartLoading(tab);
    try {
      const entries = await fetchSmartMoneyData(apiKey, tab);

      // 2. Store in Supabase
      if (getSupabaseConfig()) await saveSmartMoney(tab, entries);

      setSmartCache((prev) => ({ ...prev, [tab]: entries }));
      setSmartTime((prev) => ({ ...prev, [tab]: new Date().toLocaleTimeString("en-IN") }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smart money fetch failed");
    } finally {
      setSmartLoading(null);
    }
  }, [apiKey, smartCache]);

  useEffect(() => { runScreener("largecap"); }, []); // eslint-disable-line

  const currentPicks = picksCache[activeCapTab];
  const currentSmart = smartCache[smartTab];
  const isLoadingCap = picksLoading === activeCapTab;
  const isLoadingSmart = smartLoading === smartTab;
  const cfg = CAP_CONFIG[activeCapTab];

  const MAIN_TABS: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: "screener", label: "Screener", icon: TrendingUp },
    { id: "smartmoney", label: "Smart Money", icon: Eye },
    { id: "themes", label: "Theme Engine", icon: Zap },
  ];

  const SMART_TABS: { id: SmartTab; label: string }[] = [
    { id: "fiidii", label: "FII / DII Flows" },
    { id: "ace", label: "Ace Investors" },
    { id: "analyst", label: "Analyst Buys" },
  ];

  return (
    <div className="space-y-5">
      {/* Top header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Picks</h2>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Live NSE data</span>
        </div>
      </div>

      {/* Main tab switcher */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
        {MAIN_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all",
              mainTab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ══ SCREENER TAB ══ */}
      {mainTab === "screener" && (
        <div className="space-y-4">
          <Card className="p-3 bg-muted/40 border-dashed">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">{apiKey ? "Gemini picks + real data:" : "Screener:"}</strong>{" "}
                {apiKey
                  ? "Gemini searches NSE/Screener.in and picks 15 best stocks for this category right now. Real Yahoo Finance data is then fetched and scored. Picks cached in Supabase for 24h."
                  : "Add a Gemini API key in Research tab so AI can pick real current stocks. Without it, uses a curated static list."}
              </p>
            </div>
          </Card>

          {/* Cap tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(Object.keys(CAP_CONFIG) as CapCategory[]).map((cat) => {
              const Icon = CAP_CONFIG[cat].icon;
              return (
                <button key={cat} onClick={() => { setActiveCapTab(cat); runScreener(cat); }}
                  className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                    activeCapTab === cat ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground")}>
                  <Icon className="h-3.5 w-3.5" />{CAP_CONFIG[cat].label}
                  {picksCache[cat] && activeCapTab !== cat && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{cfg.description}</p>
              <p className="text-[10px] text-muted-foreground/60">Horizon: {cfg.horizon} · {apiKey ? "Gemini picks 15 stocks" : `${UNIVERSES[activeCapTab].length} curated`} · Min score: {cfg.minScore}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {picksTime[activeCapTab] && <span className="text-[10px] text-muted-foreground">{picksTime[activeCapTab]}</span>}
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => runScreener(activeCapTab, true)} disabled={isLoadingCap}>
                <RefreshCw className={cn("h-3 w-3", isLoadingCap && "animate-spin")} />
                {isLoadingCap ? "Fetching..." : "Refresh"}
              </Button>
            </div>
          </div>

          {isLoadingCap ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {apiKey ? "Gemini picking stocks → fetching live prices → scoring..." : `Fetching live data for ${UNIVERSES[activeCapTab].length} stocks...`}
              </div>
              <LoadingGrid />
            </div>
          ) : picksError ? (
            <Card className="p-6 text-center space-y-2 border-destructive/30">
              <AlertCircle className="h-6 w-6 text-destructive/60 mx-auto" />
              <p className="text-sm text-muted-foreground">{picksError}</p>
              <Button size="sm" variant="outline" onClick={() => runScreener(activeCapTab, true)}>Retry</Button>
            </Card>
          ) : currentPicks && currentPicks.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {currentPicks.map((stock) => (
                  <StockCard key={stock.ticker} stock={stock} category={activeCapTab} apiKey={apiKey}
                    onAnalyse={(t) => onNavigateToResearch?.(t)}
                    onGenerateThesis={handleGenerateThesis} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-right">
                Scores based on live financial data. Not investment advice.
              </p>
            </>
          ) : currentPicks && currentPicks.length === 0 ? (
            <Card className="p-8 text-center space-y-2">
              <Eye className="h-6 w-6 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No stocks passed the strict filters right now.</p>
              <p className="text-xs text-muted-foreground/60">This is intentional — try refreshing or another category.</p>
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
              {(() => { const Icon = cfg.icon; return <Icon className="h-8 w-8 text-muted-foreground/30 mx-auto" />; })()}
              <p className="text-sm font-medium text-muted-foreground">{cfg.label}</p>
              <Button size="sm" onClick={() => runScreener(activeCapTab)} className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Run Screener
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ══ SMART MONEY TAB ══ */}
      {mainTab === "smartmoney" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {SMART_TABS.map(({ id, label }) => (
              <button key={id} onClick={() => { setSmartTab(id); runSmartMoney(id); }}
                className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  smartTab === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground")}>
                {label}
                {smartCache[id] && smartTab !== id && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {smartTab === "fiidii" && "Stocks where FIIs/DIIs increased holdings last quarter — based on public NSE/BSE filings"}
              {smartTab === "ace" && "Latest additions by Kacholia, Kedia, Khanna, Agrawal, Veliyath — public filings"}
              {smartTab === "analyst" && "3+ analyst Buy ratings with 20%+ upside from Motilal, Kotak, ICICI Direct"}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {smartTime[smartTab] && <span className="text-[10px] text-muted-foreground">{smartTime[smartTab]}</span>}
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                onClick={() => runSmartMoney(smartTab, true)} disabled={isLoadingSmart || !apiKey}>
                <RefreshCw className={cn("h-3 w-3", isLoadingSmart && "animate-spin")} />
                {isLoadingSmart ? "Loading..." : currentSmart ? "Refresh" : "Load"}
              </Button>
            </div>
          </div>

          {!apiKey && (
            <Card className="p-4 border-dashed text-center space-y-1">
              <p className="text-sm text-muted-foreground">Add Gemini API key in the Research tab to use Smart Money</p>
              <p className="text-xs text-muted-foreground/60">Smart Money uses Gemini + Google Search to pull real public filing data</p>
            </Card>
          )}

          {isLoadingSmart ? <LoadingGrid count={3} />
          : currentSmart && currentSmart.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {currentSmart.map((entry, i) => (
                  <SmartMoneyCard key={i} entry={entry} onAnalyse={(t) => onNavigateToResearch?.(t)} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/70 text-right">Based on public filings · {smartTime[smartTab]}</p>
            </>
          ) : currentSmart && currentSmart.length === 0 ? (
            <Card className="p-6 text-center"><p className="text-sm text-muted-foreground">No data returned. Try refreshing.</p></Card>
          ) : apiKey ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
              <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {smartTab === "fiidii" && "FII / DII Accumulation Signals"}
                {smartTab === "ace" && "Ace Investor Portfolio Additions"}
                {smartTab === "analyst" && "Analyst Consensus Buy Calls"}
              </p>
              <Button size="sm" onClick={() => runSmartMoney(smartTab)} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Load
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* ══ THEME ENGINE TAB ══ */}
      {mainTab === "themes" && (
        <ThemeEngine
          apiKey={apiKey}
          onNavigateToResearch={(t) => onNavigateToResearch?.(t)}
        />
      )}

      <p className="text-[10px] text-muted-foreground/50 leading-relaxed border-t border-border pt-4">
        ⚠️ Screener uses real live data from Yahoo Finance. Smart Money uses Gemini AI with Google Search on public filings. Theme Engine is based on historical Indian market patterns. This is a personal research tool — not SEBI-registered investment advice. Always do your own due diligence.
      </p>
    </div>
  );
}
