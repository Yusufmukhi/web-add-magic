import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Search, Copy, AlertTriangle, BarChart2,
  Key, X, ChevronRight, TrendingUp, Users, BookOpen,
  MessageSquare, Building2, Newspaper, Send,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResearchEntry {
  query: string;
  report: string;
  timestamp: number;
}

type GeminiPart = { text?: string; thought?: boolean };

type FollowUpType =
  | "redflags"
  | "peers"
  | "promoter"
  | "agm"
  | "shareholding"
  | "news"
  | "custom";

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY_API  = "gemini_api_key";
const LS_KEY_HIST = "research_history";
const MAX_HIST    = 8;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
const GEMINI_STREAM_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;

// ─── Dig Deeper button config ────────────────────────────────────────────────

const DIG_DEEPER_BUTTONS: {
  type: FollowUpType;
  label: string;
  loadingLabel: string;
  icon: React.ElementType;
  iconClass: string;
  prompt: (stock: string) => string;
}[] = [
  {
    type: "redflags",
    label: "Red Flags",
    loadingLabel: "Analysing...",
    icon: AlertTriangle,
    iconClass: "text-destructive",
    prompt: (s) =>
      `For the NSE/BSE listed stock ${s}, give me the top 6 specific red flags an investor MUST monitor right now. Use the latest available data including recent filings, news, and results. Format as a numbered list — bold heading for each red flag, then 2-3 sentences of specific explanation with data points. Be brutally direct. No generic warnings.`,
  },
  {
    type: "peers",
    label: "Peer Compare",
    loadingLabel: "Comparing...",
    icon: BarChart2,
    iconClass: "text-primary",
    prompt: (s) =>
      `Compare the NSE/BSE listed stock ${s} with its 3 closest listed Indian peers. Present a markdown table with these columns: Company | CMP (₹) | Mkt Cap (₹Cr) | Revenue Growth YoY% | EBITDA Margin% | PAT Margin% | ROCE% | PE (TTM) | Debt/Equity. After the table, write a 3-sentence verdict — is ${s} a better or worse bet vs peers right now, and why?`,
  },
  {
    type: "promoter",
    label: "Promoter Profile",
    loadingLabel: "Loading...",
    icon: Users,
    iconClass: "text-amber-500",
    prompt: (s) =>
      `Give me a detailed promoter analysis for the NSE/BSE listed company ${s}. Cover:
1. **Promoter Background** — Who are the promoters? Their professional background, other businesses, track record. Are they first-generation entrepreneurs or inheritors?
2. **Promoter Holding & Trend** — Current promoter holding %. Has it increased or decreased in the last 4 quarters? Any pledging?
3. **Management Quality Signals** — Has management delivered on past guidance? Any history of corporate governance issues, SEBI orders, or fraud allegations?
4. **Promoter Communication** — How do they talk to investors? Do they give clear guidance? Are they accessible?
5. **Key Management Team** — Who is the CEO/MD, CFO? Their tenure, background, and credibility.
6. **Red Flags or Green Flags** — Give a final 2-sentence assessment: is this management trustworthy and capable?
Use the latest available public information.`,
  },
  {
    type: "agm",
    label: "AGM / Concall",
    loadingLabel: "Loading...",
    icon: BookOpen,
    iconClass: "text-purple-500",
    prompt: (s) =>
      `Find the most recent AGM (Annual General Meeting) and/or earnings concall transcript details for the NSE/BSE listed company ${s}. Summarize:
1. **Key Management Commentary** — What did the MD/CEO say about business outlook, growth plans, and challenges? Quote specific statements if available.
2. **FY Guidance** — What revenue, margin, and growth guidance did management give for the current or next fiscal year?
3. **Order Book / Pipeline** — Any specific order wins, pipeline size, or capacity expansion mentioned?
4. **Capex Plans** — How much capex is planned and for what purpose?
5. **Analyst Questions** — What were the sharpest analyst questions, and how did management respond?
6. **Management Tone** — Were they confident, defensive, or evasive? What topics did they avoid?
7. **What to Watch** — Based on their commentary, what 2-3 milestones should investors track in the next 2 quarters?
Use the latest concall (Q3/Q4 FY25 or most recent available).`,
  },
  {
    type: "shareholding",
    label: "Shareholding",
    loadingLabel: "Loading...",
    icon: Building2,
    iconClass: "text-blue-500",
    prompt: (s) =>
      `Give me a detailed shareholding pattern analysis for the NSE/BSE listed stock ${s}. Cover:
1. **Current Shareholding Pattern** — Present a table: Promoters% | FII/FPI% | DII (MF+Insurance)% | Retail (Public)% | Others% with latest quarter data.
2. **QoQ Trend** — How has each category changed over the last 4 quarters? Show as a mini table.
3. **Key FII Investors** — Which specific foreign funds hold this stock? Have they been buying or selling?
4. **Key DII/MF Investors** — Which mutual fund houses hold significant stakes? Any SIP inflows visible?
5. **Ace Investors** — Do any well-known individual investors (Ashish Kacholia, Vijay Kedia, Dolly Khanna, etc.) hold this stock?
6. **Institutional Activity Signal** — Based on the trend, are institutions accumulating or distributing? What does this signal?
Use the latest available quarterly disclosure data.`,
  },
  {
    type: "news",
    label: "Recent News",
    loadingLabel: "Loading...",
    icon: Newspaper,
    iconClass: "text-green-500",
    prompt: (s) =>
      `Search for the most recent news and developments for the NSE/BSE listed company ${s} in the last 30-60 days. Summarize:
1. **Business News** — Any new contracts, order wins, partnerships, product launches, or expansion announcements?
2. **Results & Earnings** — Latest quarterly results summary and market reaction.
3. **Regulatory / Legal** — Any SEBI notices, court cases, government actions, or compliance issues?
4. **Management Changes** — Any key hirings, resignations, or board changes?
5. **Sector News** — Any sector-wide developments (policy, demand, competition) affecting this company?
6. **Stock Price Triggers** — What news caused significant price movements recently?
7. **Upcoming Catalysts** — Any known upcoming events — results date, AGM, order announcements, capex commissioning?
Present as a clean structured summary. Be specific with dates and numbers.`,
  },
];

// ─── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Aurum, an elite institutional equity research analyst specializing exclusively in Indian stock markets — NSE and BSE listed companies. You have deep expertise in Indian accounting standards (Ind AS), SEBI regulations, sectoral dynamics of the Indian economy, and the behavioral patterns of Indian retail vs institutional investors.

Your analysis style is modeled after top Indian broking house research reports — like Motilal Oswal, Kotak Securities, ICICI Direct, and Nuvama. You are direct, data-driven, and you give a real opinion — not generic disclaimers.

When asked to analyse a stock, always follow this exact structure:

## 🏢 Business Overview
- What the company actually does (not copy-paste from annual report — explain it simply)
- Key products / services / revenue segments with approximate % contribution
- Promoter background and credibility (any red flags or strong track record?)
- Market position — leader, challenger, niche player?
- Listed on NSE/BSE? BSE SME? Year of listing?

## 👤 Promoter & Management Quality
- Who are the promoters? First-gen entrepreneur or inheritor? Other businesses?
- Current promoter holding % — increasing or decreasing over last 4 quarters?
- Any pledging? If yes, what %?
- Management track record on delivering guidance — honest or over-promising?
- Any SEBI orders, corporate governance issues, or red flags?
- Management tone in recent concalls — confident, defensive, or evasive?

## 📊 Financial Snapshot (Last 4 Quarters / Latest Annual)
- Revenue (₹ Cr) — absolute number + YoY growth %
- EBITDA and EBITDA margin % — trend improving or deteriorating?
- Net Profit (₹ Cr) + PAT margin %
- Debt-to-Equity ratio — is the balance sheet clean?
- ROCE and ROE — are they above cost of capital?
- Cash flow from operations — is profit backed by real cash?
- Any one-time items distorting numbers?

## 🏛️ Shareholding & Institutional Activity
- Current FII%, DII%, Promoter%, Retail% (latest quarter)
- QoQ change in FII and DII holdings — accumulating or distributing?
- Any notable ace investors (Kacholia, Kedia, Khanna etc.) holding this?
- Mutual fund SIP inflow visible in the stock?

## 📣 Latest AGM / Concall Highlights
- Key management guidance from most recent concall or AGM
- Order book size or pipeline if disclosed
- Capex plans and expected commissioning timelines
- Any forward guidance on revenue or margins
- Key risks flagged by management themselves

## ⚠️ Key Risks (minimum 4, be specific — no generic "market risk")
- Sector-specific risks
- Company-specific risks (promoter pledge, debt, customer concentration)
- Regulatory or policy risks
- Competition risks

## 🚀 Growth Catalysts (minimum 4, be specific with numbers where possible)
- Order book / pipeline
- Capacity expansion
- New product launches or markets
- Government schemes or PLI benefits
- Tailwinds in the sector

## 💰 Valuation
- Current market price (₹)
- Market cap (₹ Cr) — smallcap / midcap / largecap category
- TTM PE and Forward PE estimate
- Sector average PE for comparison
- EV/EBITDA if capital-intensive business
- PEG ratio if high-growth company
- Is it cheap, fairly valued, or expensive vs peers and history?
- Peer comparison: name 2-3 listed peers and how this stock compares

## 🎯 Verdict
**Recommendation: BUY / ACCUMULATE / HOLD / REDUCE / AVOID**
**Current Price: ₹___**
**Target Price (12 months): ₹___ (upside: __%)** 
**Stop Loss: ₹___ (downside: __%)** 
**Risk-Reward Ratio: X:1**
**Investment Horizon: Short term (< 6M) / Medium term (6-18M) / Long term (2-3Y)**
**Conviction Level: High / Medium / Low**

Give 2-3 sentences explaining your verdict — why you have this conviction, what is the key trigger to watch.

IMPORTANT RULES:
- Use Google Search to fetch the LATEST available data — current price, latest quarterly results, recent news, latest concall, latest AGM
- All financial figures must be in Indian format (₹ Crores)
- If this is an SME IPO or recently listed stock, mention it clearly and add extra caution
- If promoter holding has decreased recently, flag it prominently as a red flag
- If FII/DII holding has increased recently, flag it as a positive signal
- If promoter pledge is above 20%, flag it as a serious risk
- Never give vague answers like "the stock may go up or down" — give a real directional view
- If you genuinely don't have enough data (very obscure stock), say so clearly rather than making up numbers`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadHistory(): ResearchEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY_HIST) ?? "[]"); }
  catch { return []; }
}

function saveHistory(entries: ResearchEntry[]) {
  localStorage.setItem(LS_KEY_HIST, JSON.stringify(entries.slice(0, MAX_HIST)));
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function parseGeminiError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error occurred.";
  const msg = err.message;
  if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate"))
    return "Rate limit hit — free tier allows 10 req/min. Wait ~15 seconds and retry.";
  if (msg.includes("400"))
    return "Bad request. Ensure your API key has Gemini 2.5 Flash access at aistudio.google.com.";
  if (msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("api key"))
    return "Invalid or expired API key. Please re-enter it.";
  if (msg.includes("500") || msg.includes("503"))
    return "Gemini server error. Please try again in a few seconds.";
  return msg;
}

function extractText(parts: GeminiPart[] | undefined): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => typeof p.text === "string" && p.thought !== true)
    .map((p) => p.text as string)
    .join("");
}

// ─── Markdown renderer ───────────────────────────────────────────────────────

function ReportRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const rawElements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      rawElements.push(
        <h2 key={key++} className="mt-6 mb-2 text-base font-bold text-foreground border-b border-border pb-1">
          {line.replace("## ", "")}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      rawElements.push(
        <h3 key={key++} className="mt-4 mb-1 text-sm font-semibold text-foreground">
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.match(/^---+$/)) {
      rawElements.push(<hr key={key++} className="my-3 border-border" />);
    } else if (line.startsWith("> ")) {
      rawElements.push(
        <blockquote key={key++} className="my-2 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
          {line.slice(2)}
        </blockquote>
      );
    } else if (line.startsWith("| ")) {
      const cells = line.split("|").filter((c) => c.trim()).map((c) => c.trim());
      const nextLine = lines[i + 1] ?? "";
      const isSeparator = /^[\|\-\s]+$/.test(nextLine);
      if (isSeparator) {
        rawElements.push(
          <tr key={key++} data-table-row="header" className="bg-muted/60">
            {cells.map((c, j) => (
              <th key={j} className="px-3 py-2 text-left text-xs font-semibold text-foreground border border-border">
                {c}
              </th>
            ))}
          </tr>
        );
      } else if (/^[\|\-\s]+$/.test(line)) {
        // skip separator
      } else {
        rawElements.push(
          <tr key={key++} data-table-row="body" className="even:bg-muted/20 hover:bg-muted/30 transition-colors">
            {cells.map((c, j) => (
              <td key={j} className="px-3 py-1.5 text-xs text-muted-foreground border border-border">
                <span dangerouslySetInnerHTML={{ __html: formatInline(c) }} />
              </td>
            ))}
          </tr>
        );
      }
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      rawElements.push(
        <div key={key++} className="flex gap-2 text-sm text-muted-foreground my-0.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1] ?? "•";
      const content = line.replace(/^\d+\.\s/, "");
      rawElements.push(
        <div key={key++} className="flex gap-2.5 text-sm text-muted-foreground my-1">
          <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mt-0.5">
            {num}
          </span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
        </div>
      );
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      rawElements.push(
        <p key={key++} className="text-sm font-semibold text-foreground my-0.5">
          {line.slice(2, -2)}
        </p>
      );
    } else if (line.trim() === "") {
      rawElements.push(<div key={key++} className="h-1" />);
    } else {
      rawElements.push(
        <p
          key={key++}
          className="text-sm text-muted-foreground my-0.5"
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
        />
      );
    }
  }

  // wrap <tr> runs in <table>
  const finalElements: React.ReactNode[] = [];
  let tableRows: React.ReactNode[] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      finalElements.push(
        <div key={`tbl-${finalElements.length}`} className="overflow-x-auto my-3 rounded-md border border-border">
          <table className="w-full border-collapse text-sm">{tableRows}</table>
        </div>
      );
      tableRows = [];
    }
  };

  for (const el of rawElements) {
    const elem = el as React.ReactElement;
    if (elem?.type === "tr") {
      tableRows.push(el);
    } else {
      flushTable();
      finalElements.push(el);
    }
  }
  flushTable();

  return <div className="py-1">{finalElements}</div>;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-muted px-1 rounded text-xs'>$1</code>");
}

// ─── Streaming API call ───────────────────────────────────────────────────────

async function callGeminiStream(
  apiKey: string,
  userQuery: string,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch(GEMINI_STREAM_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: `Analyse this Indian stock for me: ${userQuery}` }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const parts = parsed?.candidates?.[0]?.content?.parts as GeminiPart[] | undefined;
        const chunk = extractText(parts);
        if (chunk) {
          fullText += chunk;
          onChunk(fullText);
        }
      } catch {
        // partial JSON — skip
      }
    }
  }

  if (!fullText) throw new Error("Empty response from Gemini.");
  return fullText;
}

// ─── Non-streaming follow-up (preset + custom) ───────────────────────────────

async function callGeminiFollowUp(
  apiKey: string,
  stock: string,
  prompt: string
): Promise<string> {
  const res = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = extractText(data?.candidates?.[0]?.content?.parts);
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-3 animate-pulse py-2">
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-5/6 rounded bg-muted" />
      <div className="h-3 w-4/5 rounded bg-muted" />
      <div className="mt-4 h-4 w-1/2 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-3/4 rounded bg-muted" />
      <div className="mt-4 h-4 w-2/3 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-5/6 rounded bg-muted" />
    </div>
  );
}

// ─── API Key Setup ────────────────────────────────────────────────────────────

function ApiKeySetup({ onSave }: { onSave: (key: string) => void }) {
  const [val, setVal] = useState("");

  const handleSave = () => {
    const trimmed = val.trim();
    if (!trimmed) { toast.error("Enter a valid API key"); return; }
    localStorage.setItem(LS_KEY_API, trimmed);
    onSave(trimmed);
    toast.success("API key saved!");
  };

  return (
    <Card className="p-6 space-y-4 border-dashed">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Setup Gemini API Key</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        AI Research uses <span className="font-medium text-foreground">Gemini 2.5 Flash</span> with live
        Google Search — free tier gives 1,500 requests/day. Get your key from{" "}
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          aistudio.google.com
        </a>
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Paste your Gemini API key here..."
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          type="password"
          className="font-mono text-xs"
        />
        <Button onClick={handleSave} className="shrink-0">Save Key</Button>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AIResearchPanelProps {
  prefillTicker?: string;
  onPrefillConsumed?: () => void;
}

export function AIResearchPanel({ prefillTicker, onPrefillConsumed }: AIResearchPanelProps = {}) {
  const [apiKey, setApiKey]     = useState<string>(() => localStorage.getItem(LS_KEY_API) ?? "");
  const [query, setQuery]       = useState("");
  const [report, setReport]     = useState<string | null>(null);
  const [currentStock, setCurrentStock] = useState("");
  const [loading, setLoading]   = useState(false);
  const [streamingText, setStreamingText] = useState<string>("");

  // Follow-up state
  const [followUpText, setFollowUpText]     = useState<string | null>(null);
  const [followUpType, setFollowUpType]     = useState<FollowUpType | null>(null);
  const [followUpLabel, setFollowUpLabel]   = useState<string>("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [customQuery, setCustomQuery]       = useState("");

  const [history, setHistory] = useState<ResearchEntry[]>(loadHistory);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveHistory(history); }, [history]);

  useEffect(() => {
    if (prefillTicker && prefillTicker.trim()) {
      setQuery(prefillTicker.trim());
      onPrefillConsumed?.();
      if (apiKey) {
        setTimeout(() => handleAnalyse(prefillTicker.trim()), 100);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTicker]);

  const handleAnalyse = useCallback(async (stockQuery?: string) => {
    const q = (stockQuery ?? query).trim();
    if (!q) { toast.error("Enter a stock name or ticker"); return; }
    if (!apiKey) { toast.error("Add your Gemini API key first"); return; }

    setLoading(true);
    setReport(null);
    setStreamingText("");
    setFollowUpText(null);
    setFollowUpType(null);
    setFollowUpLabel("");
    setCurrentStock(q.toUpperCase());

    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

    try {
      const result = await callGeminiStream(apiKey, q, (partial) => setStreamingText(partial));
      setStreamingText("");
      setReport(result);
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.query.toLowerCase() !== q.toLowerCase());
        return [{ query: q.toUpperCase(), report: result, timestamp: Date.now() }, ...filtered];
      });
    } catch (err) {
      toast.error(parseGeminiError(err));
    } finally {
      setLoading(false);
    }
  }, [apiKey, query]);

  const handleFollowUp = useCallback(async (type: FollowUpType, prompt: string, label: string) => {
    if (!currentStock || !apiKey) return;
    setFollowUpLoading(true);
    setFollowUpType(type);
    setFollowUpLabel(label);
    setFollowUpText(null);
    try {
      const result = await callGeminiFollowUp(apiKey, currentStock, prompt);
      setFollowUpText(result);
    } catch (err) {
      toast.error(parseGeminiError(err));
    } finally {
      setFollowUpLoading(false);
    }
  }, [apiKey, currentStock]);

  const handleCustomQuery = () => {
    if (!customQuery.trim()) { toast.error("Type your question first"); return; }
    const prompt = `For the NSE/BSE listed company ${currentStock}: ${customQuery.trim()}\n\nUse live web search to get the latest available data. Be specific and factual. Use Indian number formatting (₹ Crores). Structure your answer clearly with headings where appropriate.`;
    handleFollowUp("custom", prompt, customQuery.trim());
    setCustomQuery("");
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(`AURUM RESEARCH — ${currentStock}\n${"─".repeat(50)}\n\n${report}`)
      .then(() => toast.success("Report copied!"));
  };

  const handleClearKey = () => {
    localStorage.removeItem(LS_KEY_API);
    setApiKey("");
    toast("API key removed");
  };

  const handleLoadHistory = (entry: ResearchEntry) => {
    setReport(entry.report);
    setCurrentStock(entry.query);
    setQuery(entry.query);
    setStreamingText("");
    setFollowUpText(null);
    setFollowUpType(null);
    setFollowUpLabel("");
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const displayText = loading ? streamingText : report;
  const isStreaming = loading && streamingText.length > 0;

  if (!apiKey) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">AI Research</h2>
          <Badge variant="outline" className="text-[10px]">Powered by Gemini</Badge>
        </div>
        <ApiKeySetup onSave={setApiKey} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">AI Research</h2>
          <Badge variant="outline" className="text-[10px]">Gemini 2.5 Flash · Live · Streaming</Badge>
        </div>
        <button onClick={handleClearKey} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Key className="h-3 w-3" /> Change Key
        </button>
      </div>

      {/* Search */}
      <Card className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 font-medium"
              placeholder="APOLLOMICRO, Tata Motors, IRFC, Zomato..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleAnalyse()}
              disabled={loading}
            />
          </div>
          <Button onClick={() => handleAnalyse()} disabled={loading || !query.trim()} className="gap-1.5 shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Analysing..." : "Analyse"}
          </Button>
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground self-center">Recent:</span>
            {history.map((h) => (
              <button
                key={h.timestamp}
                onClick={() => handleLoadHistory(h)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-accent",
                  currentStock === h.query ? "border-primary text-primary bg-accent" : "border-border text-muted-foreground"
                )}
              >
                {h.query}
                <span className="text-[10px] opacity-60">{timeAgo(h.timestamp)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Loading skeleton */}
      {loading && !isStreaming && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Aurum is researching <span className="font-semibold text-foreground">{currentStock}</span> with live data...
            </span>
          </div>
          <ReportSkeleton />
        </Card>
      )}

      {/* Report card */}
      {displayText && (
        <Card className="p-5" ref={reportRef}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg">{currentStock}</h3>
              <Badge variant="outline" className="text-[10px]">Aurum Report</Badge>
              {isStreaming && (
                <span className="flex items-center gap-1 text-[10px] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Streaming...
                </span>
              )}
            </div>
            {!loading && (
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setReport(null); setStreamingText(""); setFollowUpText(null); setCurrentStock(""); }} className="h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <ReportRenderer text={displayText} />

          {/* ── Dig Deeper section ── */}
          {!loading && (
            <div className="mt-5 pt-4 border-t border-border space-y-3">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Dig Deeper
              </p>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2">
                {DIG_DEEPER_BUTTONS.map((btn) => {
                  const Icon = btn.icon;
                  const isActive = followUpType === btn.type;
                  const isThisLoading = followUpLoading && followUpType === btn.type;
                  return (
                    <Button
                      key={btn.type}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => handleFollowUp(btn.type, btn.prompt(currentStock), btn.label)}
                      disabled={followUpLoading}
                    >
                      <Icon className={cn("h-3.5 w-3.5", !isActive && btn.iconClass)} />
                      {isThisLoading ? btn.loadingLabel : btn.label}
                    </Button>
                  );
                })}
              </div>

              {/* Custom question input */}
              <div className="flex gap-2 pt-1">
                <div className="relative flex-1">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 text-xs h-8"
                    placeholder={`Ask anything about ${currentStock || "this stock"}...`}
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !followUpLoading && handleCustomQuery()}
                    disabled={followUpLoading}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs shrink-0"
                  onClick={handleCustomQuery}
                  disabled={followUpLoading || !customQuery.trim()}
                >
                  <Send className="h-3 w-3" />
                  Ask
                </Button>
              </div>

              {/* Custom query suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "What's the debt repayment schedule?",
                  "Any SEBI actions against management?",
                  "Order book visibility for next 2 years?",
                  "Export revenue contribution?",
                  "Working capital cycle trend?",
                  "Promoter interview or podcast insights?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setCustomQuery(suggestion)}
                    className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    disabled={followUpLoading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Follow-up result */}
      {followUpLoading && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Loading <span className="font-medium text-foreground">{followUpLabel}</span> for {currentStock}...
            </span>
          </div>
          <ReportSkeleton />
        </Card>
      )}

      {followUpText && !followUpLoading && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {(() => {
                const btn = DIG_DEEPER_BUTTONS.find((b) => b.type === followUpType);
                if (btn) {
                  const Icon = btn.icon;
                  return (
                    <>
                      <Icon className={cn("h-4 w-4", btn.iconClass)} />
                      <h3 className="font-semibold text-sm">
                        {followUpType === "custom" ? followUpLabel : `${btn.label} — ${currentStock}`}
                      </h3>
                    </>
                  );
                }
                return (
                  <>
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">{followUpLabel} — {currentStock}</h3>
                  </>
                );
              })()}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                onClick={() => navigator.clipboard.writeText(followUpText).then(() => toast.success("Copied!"))}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFollowUpText(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <ReportRenderer text={followUpText} />

          {/* Allow follow-up on follow-up */}
          <div className="mt-4 pt-3 border-t border-border flex gap-2">
            <div className="relative flex-1">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 text-xs h-8"
                placeholder="Ask a follow-up..."
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !followUpLoading && handleCustomQuery()}
                disabled={followUpLoading}
              />
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs shrink-0"
              onClick={handleCustomQuery} disabled={followUpLoading || !customQuery.trim()}>
              <Send className="h-3 w-3" />
              Ask
            </Button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!displayText && !loading && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-2">
          <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Type any NSE/BSE stock above</p>
          <p className="text-xs text-muted-foreground/60">
            Full report with promoter profile, AGM commentary, shareholding & verdict
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {["APOLLOMICRO", "TATAMOTORS", "IRFC", "ZOMATO", "DIXON"].map((s) => (
              <button key={s} onClick={() => { setQuery(s); handleAnalyse(s); }}
                className="inline-flex items-center gap-0.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                {s} <ChevronRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {!displayText && !loading && (
        <Card className="p-4 border-dashed border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Dig Deeper options after every report</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Promoter profile · AGM/Concall highlights · Shareholding trend · Peer compare · Red flags · Ask anything custom
          </p>
        </Card>
      )}
    </div>
  );
}
