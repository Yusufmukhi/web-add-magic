/**
 * PicksPanel — Real screener using your existing Yahoo Finance API
 *
 * How it works:
 * 1. Each category has a curated universe of ~20-30 real NSE tickers
 * 2. We fetch live quotes for all of them using your existing fetchQuote API
 * 3. We score and filter using real financial data (PE, ROE, margins, 52W fall, etc.)
 * 4. Top picks are shown with REAL live prices and metrics
 * 5. Gemini (optional) writes a thesis ONLY for the pre-screened winners — not for stock selection
 * 6. Smart Money uses Gemini with google_search to pull real FII/DII/ace investor data
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

// ─── Types ────────────────────────────────────────────────────────────────────

type CapCategory = "largecap" | "midcap" | "smallcap" | "sme";
type SmartTab = "fiidii" | "ace" | "analyst";

interface ScoredStock {
  ticker: string;
  quote: StockQuote;
  score: number;
  scoreBreakdown: string[];
  fallFromHigh: number;    // % below 52W high (positive = fallen)
  thesis?: string;         // Gemini-generated, optional
  thesisLoading?: boolean;
}

interface SmartMoneyEntry {
  ticker: string;
  name: string;
  detail: string;          // e.g. "FII +1.8% QoQ" or "Ashish Kacholia +0.4%"
  signal: string;
  extra: string;
  type: "fiidii" | "ace" | "analyst";
}

// ─── Stock universes — real NSE tickers ──────────────────────────────────────
// These are curated manually — real companies, real tickers.
// Yahoo Finance NS suffix added in fetchQuote via your Cloudflare worker.

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
    "APOLLOHOSP", "METROPOLIS", "VIJAYA",
    "SUPREMEIND", "ASTRAL", "PRINCEPIPE",
    "CAMS", "CDSL", "BSESMO",
    "IRCTC", "CONCOR",
    "IDFCFIRSTB", "FEDERALBNK", "KARURVYSYA",
    "SCHAEFFLER", "TIMKEN", "GRINDWELL",
    "JKCEMENT", "RAMCOCEM", "HEIDELBERG",
    "TRENT", "VEDL", "APLAPOLLO",
    "SOLARINDS", "CLEAN",
  ],
  smallcap: [
    "APOLLOMICRO", "DATAMATICS", "NUCLEUS",
    "PARADEEP", "GPIL", "MANINFRA",
    "KAYNES", "SYRMA", "AVALON",
    "RATEGAIN", "ROUTE", "CARTRADE",
    "RVNL", "IRFC", "RAILTEL",
    "SUZLON", "INOXWIND", "WAAREE",
    "IDEAFORGE", "PARAS",
    "ELECON", "TEXRAIL", "TITAGARH",
    "VAIBHAVGBL", "GOLDIAM",
    "PNBHOUSING", "AAVAS",
  ],
  sme: [
    // BSE SME / NSE Emerge — actual listed names
    // Note: SME tickers on Yahoo may need .BO suffix handled by your worker
    "YATHARTH", "SARVESHWAR", "CONCORD",
    "SENCO", "ARCHEAN", "GANDHAR",
    "SAAKSHI", "AZAD",
    "NUVOCO", "MACROTECH",
    "NYKAA", "ZOMATO", "DELHIVERY",
    "IDEAFORGE", "IXIGO",
  ],
};

// ─── Scoring logic — uses REAL data from your API ─────────────────────────────

interface ScoreResult {
  score: number;
  breakdown: string[];
}

function scoreLargecap(q: StockQuote, fallFromHigh: number): ScoreResult {
  // Large cap recovery: fallen quality names with improving signals
  let score = 0;
  const breakdown: string[] = [];

  if (fallFromHigh >= 30) { score += 30; breakdown.push(`▼ ${fallFromHigh.toFixed(0)}% from 52W high`); }
  else if (fallFromHigh >= 20) { score += 20; breakdown.push(`▼ ${fallFromHigh.toFixed(0)}% from 52W high`); }
  else if (fallFromHigh >= 10) { score += 10; breakdown.push(`▼ ${fallFromHigh.toFixed(0)}% from 52W high`); }

  if (q.returnOnEquity != null && q.returnOnEquity > 0.15) { score += 20; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(1)}%`); }
  else if (q.returnOnEquity != null && q.returnOnEquity > 0.10) { score += 10; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(1)}%`); }

  if (q.operatingMargins != null && q.operatingMargins > 0.15) { score += 15; breakdown.push(`OPM ${(q.operatingMargins * 100).toFixed(1)}%`); }

  if (q.pe != null && q.pe > 0 && q.pe < 20) { score += 20; breakdown.push(`PE ${q.pe.toFixed(1)}x — cheap`); }
  else if (q.pe != null && q.pe > 0 && q.pe < 30) { score += 10; breakdown.push(`PE ${q.pe.toFixed(1)}x`); }

  if (q.debtToEquity != null && q.debtToEquity < 0.5) { score += 10; breakdown.push("Low leverage"); }
  if (q.heldPercentInstitutions != null && q.heldPercentInstitutions > 0.4) { score += 5; breakdown.push("High inst. holding"); }

  return { score, breakdown };
}

function scoreMidcap(q: StockQuote): ScoreResult {
  // Mid cap compounder: high ROE, good margins, revenue growth, manageable PE
  let score = 0;
  const breakdown: string[] = [];

  if (q.returnOnEquity != null && q.returnOnEquity > 0.20) { score += 30; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(1)}% — excellent`); }
  else if (q.returnOnEquity != null && q.returnOnEquity > 0.15) { score += 20; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(1)}%`); }

  if (q.revenueGrowth != null && q.revenueGrowth > 0.20) { score += 25; breakdown.push(`Rev growth ${(q.revenueGrowth * 100).toFixed(1)}% YoY`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.12) { score += 15; breakdown.push(`Rev growth ${(q.revenueGrowth * 100).toFixed(1)}% YoY`); }

  if (q.operatingMargins != null && q.operatingMargins > 0.15) { score += 20; breakdown.push(`OPM ${(q.operatingMargins * 100).toFixed(1)}%`); }

  if (q.debtToEquity != null && q.debtToEquity < 0.3) { score += 15; breakdown.push("Near debt-free"); }
  else if (q.debtToEquity != null && q.debtToEquity < 0.7) { score += 8; breakdown.push("Low debt"); }

  if (q.pe != null && q.pe > 0 && q.pe < 40) { score += 10; breakdown.push(`PE ${q.pe.toFixed(1)}x — reasonable`); }

  return { score, breakdown };
}

function scoreSmallcap(q: StockQuote, fallFromHigh: number): ScoreResult {
  // Small cap multibagger: high growth, improving margins, not over-valued
  let score = 0;
  const breakdown: string[] = [];

  if (q.revenueGrowth != null && q.revenueGrowth > 0.30) { score += 35; breakdown.push(`Rev growth ${(q.revenueGrowth * 100).toFixed(1)}% YoY`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.20) { score += 25; breakdown.push(`Rev growth ${(q.revenueGrowth * 100).toFixed(1)}% YoY`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.10) { score += 15; breakdown.push(`Rev growth ${(q.revenueGrowth * 100).toFixed(1)}%`); }

  if (q.operatingMargins != null && q.operatingMargins > 0.12) { score += 20; breakdown.push(`OPM ${(q.operatingMargins * 100).toFixed(1)}%`); }

  if (q.returnOnEquity != null && q.returnOnEquity > 0.15) { score += 20; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(1)}%`); }

  if (q.debtToEquity != null && q.debtToEquity < 0.3) { score += 15; breakdown.push("Debt-free / minimal debt"); }

  // For small caps, some fall from high is actually a buying opportunity
  if (fallFromHigh >= 15 && fallFromHigh <= 40) { score += 10; breakdown.push(`▼ ${fallFromHigh.toFixed(0)}% entry opportunity`); }

  return { score, breakdown };
}

function scoreSME(q: StockQuote): ScoreResult {
  // SME generational wealth: high growth, clean balance sheet, emerging sectors
  let score = 0;
  const breakdown: string[] = [];

  if (q.revenueGrowth != null && q.revenueGrowth > 0.40) { score += 40; breakdown.push(`Rev growth ${(q.revenueGrowth * 100).toFixed(1)}% — explosive`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.25) { score += 30; breakdown.push(`Rev growth ${(q.revenueGrowth * 100).toFixed(1)}%`); }
  else if (q.revenueGrowth != null && q.revenueGrowth > 0.15) { score += 15; breakdown.push(`Rev growth ${(q.revenueGrowth * 100).toFixed(1)}%`); }

  if (q.debtToEquity != null && q.debtToEquity < 0.2) { score += 20; breakdown.push("Effectively debt-free"); }
  else if (q.debtToEquity != null && q.debtToEquity < 0.5) { score += 10; breakdown.push("Low debt"); }

  if (q.returnOnEquity != null && q.returnOnEquity > 0.20) { score += 25; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(1)}%`); }
  else if (q.returnOnEquity != null && q.returnOnEquity > 0.12) { score += 15; breakdown.push(`ROE ${(q.returnOnEquity * 100).toFixed(1)}%`); }

  if (q.operatingMargins != null && q.operatingMargins > 0.18) { score += 15; breakdown.push(`OPM ${(q.operatingMargins * 100).toFixed(1)}%`); }

  return { score, breakdown };
}

function scoreStock(category: CapCategory, q: StockQuote): ScoreResult {
  const fallFromHigh = q.fiftyTwoWeekHigh > 0
    ? ((q.fiftyTwoWeekHigh - q.cmp) / q.fiftyTwoWeekHigh) * 100
    : 0;

  switch (category) {
    case "largecap": return scoreLargecap(q, fallFromHigh);
    case "midcap":   return scoreMidcap(q);
    case "smallcap": return scoreSmallcap(q, fallFromHigh);
    case "sme":      return scoreSME(q);
  }
}

// ─── Gemini thesis generator — only for pre-screened winners ─────────────────

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

type GeminiPart = { text?: string; thought?: boolean };

function extractText(data: unknown): string {
  const parts = (data as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> })
    ?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string).join("");
}

async function generateThesis(apiKey: string, ticker: string, quote: StockQuote, category: CapCategory): Promise<string> {
  const fallFromHigh = quote.fiftyTwoWeekHigh > 0
    ? ((quote.fiftyTwoWeekHigh - quote.cmp) / quote.fiftyTwoWeekHigh * 100).toFixed(1)
    : "N/A";

  const categoryContext: Record<CapCategory, string> = {
    largecap: "a large cap recovery play — high quality company that has fallen from highs with potential to re-rate",
    midcap: "a mid cap compounder — consistently growing business capable of 5-10x in 5-7 years",
    smallcap: "a small cap multibagger candidate — early stage in a sector boom",
    sme: "an SME generational wealth play — potential 20-30x in 7-10 years in a future-tech sector",
  };

  const prompt = `You are analysing ${ticker} (${quote.name}) which has been screened as ${categoryContext[category]}.

REAL DATA (live from Yahoo Finance):
- CMP: ₹${quote.cmp.toFixed(2)}
- Market Cap: ₹${quote.marketCap > 0 ? (quote.marketCap / 1e7).toFixed(0) + " Cr" : "N/A"}
- 52W High: ₹${quote.fiftyTwoWeekHigh.toFixed(2)} | Fall from high: ${fallFromHigh}%
- 52W Low: ₹${quote.fiftyTwoWeekLow.toFixed(2)}
- PE (TTM): ${quote.pe?.toFixed(1) ?? "N/A"}
- P/B: ${quote.pb?.toFixed(2) ?? "N/A"}
- ROE: ${quote.returnOnEquity != null ? (quote.returnOnEquity * 100).toFixed(1) + "%" : "N/A"}
- Operating Margin: ${quote.operatingMargins != null ? (quote.operatingMargins * 100).toFixed(1) + "%" : "N/A"}
- Revenue Growth (YoY): ${quote.revenueGrowth != null ? (quote.revenueGrowth * 100).toFixed(1) + "%" : "N/A"}
- Debt/Equity: ${quote.debtToEquity?.toFixed(2) ?? "N/A"}
- Institutional Holding: ${quote.heldPercentInstitutions != null ? (quote.heldPercentInstitutions * 100).toFixed(1) + "%" : "N/A"}
- Sector: ${quote.sector}

Use Google Search to find:
1. What this company does and its key business
2. Latest quarterly results trend
3. Any recent order wins, capacity expansion, or business catalyst
4. Management quality signal

Then write a 3-sentence investment thesis for this stock. Be specific and use the real data above. Format:
**Thesis:** [2 sentences on the investment case]
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
  const data = await res.json();
  return extractText(data);
}

async function fetchSmartMoneyData(apiKey: string, tab: SmartTab): Promise<SmartMoneyEntry[]> {
  const prompts: Record<SmartTab, string> = {
    fiidii: `Search NSE/BSE shareholding data for Indian stocks where FII (Foreign Institutional Investor) holding increased by more than 1% in the most recent quarter filing available (Q3 or Q4 FY25). Also find stocks where both FII AND DII are simultaneously accumulating. 

Return ONLY a valid JSON array (no markdown, no explanation):
[{"ticker":"NSE_TICKER","name":"Company Name","detail":"FII +1.8% QoQ to 24.3%","signal":"FII Accumulation","extra":"DII also added 0.5% — both buying","type":"fiidii"}]

Give 6 entries. Use the exact NSE ticker symbol. Base it on the latest publicly available quarterly shareholding disclosures.`,

    ace: `Search for the latest quarterly portfolio disclosures filed with NSE/BSE for these ace investors: Ashish Kacholia, Vijay Kedia, Dolly Khanna, Mukul Agrawal, Porinju Veliyath, Rekha Jhunjhunwala. Find stocks where any of these investors INCREASED their stake in the most recent available quarter (latest 13F-equivalent Indian filing).

Return ONLY a valid JSON array (no markdown):
[{"ticker":"NSE_TICKER","name":"Company Name","detail":"Ashish Kacholia increased to 3.2% (+0.4% QoQ)","signal":"Ace Investor Adding","extra":"Known for tracking niche manufacturing plays","type":"ace"}]

Give 6 entries with the exact NSE ticker.`,

    analyst: `Search for Indian stocks that received the most Buy or Strong Buy ratings from top broking houses (Motilal Oswal, Kotak Securities, ICICI Direct, Nuvama, Emkay, JM Financial, Antique, Systematix) in the last 30 days. Find stocks with 3+ Buy ratings and upside > 20% from consensus target.

Return ONLY a valid JSON array (no markdown):
[{"ticker":"NSE_TICKER","name":"Company Name","detail":"4 analysts with Buy — avg target ₹850 (+28% upside)","signal":"Strong Analyst Consensus","extra":"Motilal Oswal initiated with Buy — target ₹900","type":"analyst"}]

Give 6 entries with exact NSE tickers.`,
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
  const data = await res.json();
  const text = extractText(data);
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array in response");
  const parsed = JSON.parse(clean.slice(start, end + 1)) as SmartMoneyEntry[];
  if (!Array.isArray(parsed)) throw new Error("Invalid format");
  return parsed;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(0)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(0)} L`;
  return `₹${n.toFixed(0)}`;
}

function fmtPct(n: number | null, multiply = false): string {
  if (n == null) return "—";
  const val = multiply ? n * 100 : n;
  return `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
}

// ─── Category config ──────────────────────────────────────────────────────────

const CAP_CONFIG: Record<CapCategory, {
  label: string;
  icon: React.ElementType;
  description: string;
  horizon: string;
  minScore: number;
  topN: number;
}> = {
  largecap: {
    label: "Large Cap Recovery",
    icon: Building2,
    description: "Quality large caps fallen 20%+ from highs — screened for strong fundamentals",
    horizon: "6–18 months",
    minScore: 40,
    topN: 5,
  },
  midcap: {
    label: "Mid Cap Compounders",
    icon: Layers,
    description: "High-ROE, high-growth mid caps on path to become large caps",
    horizon: "2–4 years",
    minScore: 45,
    topN: 5,
  },
  smallcap: {
    label: "Small Cap Multibaggers",
    icon: Zap,
    description: "Sector-boom small caps with 3–5x potential — real financials screened",
    horizon: "2–3 years",
    minScore: 40,
    topN: 5,
  },
  sme: {
    label: "SME / Emerging",
    icon: Gem,
    description: "High-growth emerging companies in future-tech sectors",
    horizon: "5–7 years",
    minScore: 30,
    topN: 5,
  },
};

// ─── Stock card ───────────────────────────────────────────────────────────────

function StockCard({
  stock,
  category,
  apiKey,
  onAnalyse,
  onGenerateThesis,
}: {
  stock: ScoredStock;
  category: CapCategory;
  apiKey: string;
  onAnalyse: (t: string) => void;
  onGenerateThesis: (ticker: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { quote: q, fallFromHigh, score, scoreBreakdown, thesis, thesisLoading } = stock;

  const marketCapCr = q.marketCap / 1e7;
  const dayUp = q.dayChangePct >= 0;

  return (
    <Card className="p-4 space-y-3 hover:border-primary/40 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-bold text-sm text-foreground">{q.ticker}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
              score >= 70 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
              score >= 50 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
              "bg-muted text-muted-foreground")}>
              Score {score}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[180px]">{q.name}</p>
          <p className="text-[10px] text-muted-foreground/60">{q.sector}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-bold text-sm text-foreground">₹{q.cmp.toFixed(2)}</p>
          <p className={cn("text-xs font-semibold", dayUp ? "text-emerald-500" : "text-red-500")}>
            {dayUp ? "▲" : "▼"} {Math.abs(q.dayChangePct).toFixed(2)}%
          </p>
          {marketCapCr > 0 && (
            <p className="text-[10px] text-muted-foreground">{(marketCapCr / 100).toFixed(0)} Cr</p>
          )}
        </div>
      </div>

      {/* Score badges */}
      <div className="flex flex-wrap gap-1">
        {scoreBreakdown.map((b) => (
          <span key={b} className="rounded-full bg-primary/8 border border-primary/20 px-2 py-0.5 text-[10px] text-primary/80">{b}</span>
        ))}
      </div>

      {/* Key metrics row */}
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

      {/* 52W range bar */}
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

      {/* Thesis section */}
      {expanded && (
        <div className="pt-1 space-y-2 border-t border-border">
          {thesis ? (
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
              {thesis.split("\n").filter((l) => l.trim()).map((line, i) => (
                <p key={i} dangerouslySetInnerHTML={{
                  __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                }} />
              ))}
            </div>
          ) : thesisLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Generating thesis with live data...
            </div>
          ) : apiKey ? (
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs w-full"
              onClick={() => onGenerateThesis(stock.ticker)}>
              <Sparkles className="h-3 w-3" />
              Generate AI Thesis (uses Gemini + live search)
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Add Gemini API key in Research tab to generate thesis</p>
          )}

          {/* Extra metrics when expanded */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {[
              ["Rev Growth", fmtPct(q.revenueGrowth, true)],
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

      {/* Actions */}
      <div className="flex items-center gap-3 pt-0.5">
        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Less" : "Details + Thesis"}
        </button>
        <button onClick={() => onAnalyse(q.ticker)}
          className="flex items-center gap-1 text-[11px] text-primary hover:underline transition-colors">
          <Sparkles className="h-3 w-3" />
          Full Aurum Report
          <ArrowUpRight className="h-2.5 w-2.5" />
        </button>
        <a href={`https://www.screener.in/company/${q.ticker}/`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-auto">
          Screener.in <ExternalLink className="h-2.5 w-2.5" />
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
        <button onClick={() => onAnalyse(entry.ticker)}
          className="flex items-center gap-0.5 text-[10px] text-primary hover:underline shrink-0">
          <Sparkles className="h-3 w-3" /> Report
        </button>
      </div>
      <p className="text-xs font-medium text-foreground">{entry.detail}</p>
      <p className="text-[11px] text-muted-foreground">{entry.extra}</p>
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 space-y-3 animate-pulse">
          <div className="flex justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-3 w-36 rounded bg-muted" />
            </div>
            <div className="space-y-1.5 text-right">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-3 w-14 rounded bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[1,2,3,4].map((j) => <div key={j} className="h-8 rounded bg-muted" />)}
          </div>
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

  const [activeCapTab, setActiveCapTab] = useState<CapCategory>("largecap");
  const [smartTab, setSmartTab] = useState<SmartTab>("fiidii");

  // Screener state
  const [picksCache, setPicksCache] = useState<Partial<Record<CapCategory, ScoredStock[]>>>({});
  const [picksLoading, setPicksLoading] = useState<CapCategory | null>(null);
  const [picksTime, setPicksTime] = useState<Partial<Record<CapCategory, string>>>({});
  const [picksError, setPicksError] = useState<string | null>(null);

  // Smart money state
  const [smartCache, setSmartCache] = useState<Partial<Record<SmartTab, SmartMoneyEntry[]>>>({});
  const [smartLoading, setSmartLoading] = useState<SmartTab | null>(null);
  const [smartTime, setSmartTime] = useState<Partial<Record<SmartTab, string>>>({});

  // Thesis generation per ticker
  const [thesisLoading, setThesisLoading] = useState<Set<string>>(new Set());

  const runScreener = useCallback(async (category: CapCategory, force = false) => {
    if (!force && picksCache[category]) return;
    setPicksLoading(category);
    setPicksError(null);

    const universe = UNIVERSES[category];
    const config = CAP_CONFIG[category];

    try {
      // Batch fetch all quotes (parallel, but throttled to avoid rate limits)
      const BATCH = 6;
      const quotes: { ticker: string; quote: StockQuote | null }[] = [];

      for (let i = 0; i < universe.length; i += BATCH) {
        const batch = universe.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (ticker) => {
            const q = await fetchQuote(ticker + ".NS");
            return { ticker, quote: q };
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled") quotes.push(r.value);
          else quotes.push({ ticker: batch[results.indexOf(r as PromiseSettledResult<unknown>)], quote: null });
        }
        // Small delay between batches to be kind to the API
        if (i + BATCH < universe.length) await new Promise((r) => setTimeout(r, 300));
      }

      // Score and filter
      const scored: ScoredStock[] = quotes
        .filter((q) => q.quote != null && q.quote.cmp > 0)
        .map(({ ticker, quote }) => {
          const q = quote!;
          const fallFromHigh = q.fiftyTwoWeekHigh > 0
            ? ((q.fiftyTwoWeekHigh - q.cmp) / q.fiftyTwoWeekHigh) * 100
            : 0;
          const { score, breakdown } = scoreStock(category, q);
          return { ticker: q.ticker.replace(".NS", ""), quote: q, score, scoreBreakdown: breakdown, fallFromHigh };
        })
        .filter((s) => s.score >= config.minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, config.topN);

      if (scored.length === 0) {
        setPicksError("No stocks passed the screener filters right now. Try refreshing or check back later.");
      }

      setPicksCache((prev) => ({ ...prev, [category]: scored }));
      setPicksTime((prev) => ({ ...prev, [category]: new Date().toLocaleTimeString("en-IN") }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setPicksError(`Screener failed: ${msg}. Check your internet connection.`);
    } finally {
      setPicksLoading(null);
    }
  }, [picksCache]);

  const handleGenerateThesis = useCallback(async (ticker: string) => {
    if (!apiKey) { toast.error("Add Gemini API key in the Research tab first"); return; }
    const allPicks = Object.values(picksCache).flat();
    const stock = allPicks.find((s) => s.ticker === ticker);
    if (!stock) return;

    setThesisLoading((prev) => new Set([...prev, ticker]));
    // Mark loading in the stock object
    setPicksCache((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated) as CapCategory[]) {
        updated[cat] = updated[cat]?.map((s) =>
          s.ticker === ticker ? { ...s, thesisLoading: true } : s
        );
      }
      return updated;
    });

    try {
      const thesis = await generateThesis(apiKey, ticker, stock.quote, activeCapTab);
      setPicksCache((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated) as CapCategory[]) {
          updated[cat] = updated[cat]?.map((s) =>
            s.ticker === ticker ? { ...s, thesis, thesisLoading: false } : s
          );
        }
        return updated;
      });
    } catch (err) {
      toast.error("Thesis generation failed — check your Gemini API key");
    } finally {
      setThesisLoading((prev) => {
        const next = new Set(prev);
        next.delete(ticker);
        return next;
      });
    }
  }, [apiKey, picksCache, activeCapTab]);

  const runSmartMoney = useCallback(async (tab: SmartTab, force = false) => {
    if (!apiKey) { toast.error("Add Gemini API key in the Research tab to use Smart Money"); return; }
    if (!force && smartCache[tab]) return;
    setSmartLoading(tab);

    try {
      const entries = await fetchSmartMoneyData(apiKey, tab);
      setSmartCache((prev) => ({ ...prev, [tab]: entries }));
      setSmartTime((prev) => ({ ...prev, [tab]: new Date().toLocaleTimeString("en-IN") }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smart money fetch failed");
    } finally {
      setSmartLoading(null);
    }
  }, [apiKey, smartCache]);

  // Auto-load first tab on mount
  useEffect(() => {
    runScreener("largecap");
  }, []);  // eslint-disable-line

  const currentPicks = picksCache[activeCapTab];
  const currentSmart = smartCache[smartTab];
  const isLoadingCap = picksLoading === activeCapTab;
  const isLoadingSmart = smartLoading === smartTab;
  const cfg = CAP_CONFIG[activeCapTab];

  const SMART_TABS: { id: SmartTab; label: string; icon: React.ElementType }[] = [
    { id: "fiidii", label: "FII / DII Flows", icon: Users },
    { id: "ace", label: "Ace Investors", icon: Star },
    { id: "analyst", label: "Analyst Buys", icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      {/* ── Real Screener header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Stock Screener</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Live data via Yahoo Finance</span>
        </div>
      </div>

      {/* How it works note */}
      <Card className="p-3 bg-muted/40 border-dashed">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">How it works:</strong> Fetches live NSE data for a curated universe of {Object.values(UNIVERSES).reduce((a, b) => a + b.length, 0)} stocks. Scores each using real metrics (ROE, margins, PE, 52W fall, growth). Shows top picks by score. Thesis is AI-generated separately — stock selection is 100% data-driven.
          </p>
        </div>
      </Card>

      {/* ── Cap tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(Object.keys(CAP_CONFIG) as CapCategory[]).map((cat) => {
          const Icon = CAP_CONFIG[cat].icon;
          return (
            <button key={cat}
              onClick={() => { setActiveCapTab(cat); runScreener(cat); }}
              className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                activeCapTab === cat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" />
              {CAP_CONFIG[cat].label}
              {picksCache[cat] && activeCapTab !== cat && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Loaded" />
              )}
            </button>
          );
        })}
      </div>

      {/* Description + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{cfg.description}</p>
          <p className="text-[10px] text-muted-foreground/60">Horizon: {cfg.horizon} · Universe: {UNIVERSES[activeCapTab].length} stocks · Min score: {cfg.minScore}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {picksTime[activeCapTab] && (
            <span className="text-[10px] text-muted-foreground">as of {picksTime[activeCapTab]}</span>
          )}
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
            onClick={() => runScreener(activeCapTab, true)} disabled={isLoadingCap}>
            <RefreshCw className={cn("h-3 w-3", isLoadingCap && "animate-spin")} />
            {isLoadingCap ? `Fetching ${UNIVERSES[activeCapTab].length} stocks...` : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Screener output */}
      {isLoadingCap ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Fetching live data for {UNIVERSES[activeCapTab].length} stocks and scoring them...
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
              <StockCard
                key={stock.ticker}
                stock={stock}
                category={activeCapTab}
                apiKey={apiKey}
                onAnalyse={(ticker) => onNavigateToResearch?.(ticker)}
                onGenerateThesis={handleGenerateThesis}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 text-right">
            Scores based on real financial data. Not investment advice. Do your own due diligence.
          </p>
        </>
      ) : currentPicks && currentPicks.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <Eye className="h-6 w-6 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No stocks passed the filters for this category right now.</p>
          <p className="text-xs text-muted-foreground/60">This is intentional — the screener is strict. Try refreshing or check a different category.</p>
        </Card>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
          {(() => { const Icon = cfg.icon; return <Icon className="h-8 w-8 text-muted-foreground/30 mx-auto" />; })()}
          <p className="text-sm font-medium text-muted-foreground">{cfg.label}</p>
          <p className="text-xs text-muted-foreground/60">{cfg.description}</p>
          <Button size="sm" onClick={() => runScreener(activeCapTab)} className="gap-1.5 mt-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Run Screener
          </Button>
        </div>
      )}

      {/* ── Smart Money section ── */}
      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Smart Money</h2>
            {!apiKey && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Requires Gemini key</Badge>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SMART_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => { setSmartTab(id); runSmartMoney(id); }}
              className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                smartTab === id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" />
              {label}
              {smartCache[id] && smartTab !== id && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {smartTab === "fiidii" && "Stocks where foreign & domestic institutions increased holdings last quarter"}
            {smartTab === "ace" && "Latest portfolio additions by Kacholia, Kedia, Khanna, Agrawal, Veliyath"}
            {smartTab === "analyst" && "3+ analyst Buy ratings with 20%+ upside from consensus target"}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {smartTime[smartTab] && (
              <span className="text-[10px] text-muted-foreground">as of {smartTime[smartTab]}</span>
            )}
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
              onClick={() => runSmartMoney(smartTab, true)} disabled={isLoadingSmart || !apiKey}>
              <RefreshCw className={cn("h-3 w-3", isLoadingSmart && "animate-spin")} />
              {isLoadingSmart ? "Loading..." : currentSmart ? "Refresh" : "Load"}
            </Button>
          </div>
        </div>

        {isLoadingSmart ? (
          <LoadingGrid count={3} />
        ) : currentSmart && currentSmart.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {currentSmart.map((entry, i) => (
              <SmartMoneyCard key={i} entry={entry} onAnalyse={(t) => onNavigateToResearch?.(t)} />
            ))}
          </div>
        ) : currentSmart && currentSmart.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No data returned. Try refreshing.</p>
          </Card>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
            <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {!apiKey
                ? "Add your Gemini API key in the Research tab to use Smart Money"
                : "Click Load to fetch the latest smart money signals"}
            </p>
            {apiKey && (
              <Button size="sm" onClick={() => runSmartMoney(smartTab)} className="gap-1.5 mt-1">
                <Sparkles className="h-3.5 w-3.5" />
                Load
              </Button>
            )}
          </div>
        )}
      </section>

      <p className="text-[10px] text-muted-foreground/50 leading-relaxed border-t border-border pt-4">
        ⚠️ Screener uses real live financial data from Yahoo Finance. Smart Money uses Gemini AI with Google Search on public filings. This is a personal research tool — not SEBI-registered investment advice. Always do your own due diligence before investing.
      </p>
    </div>
  );
}
