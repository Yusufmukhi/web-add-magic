import { useState, useEffect, useRef } from "react";
import { Sparkles, Search, Copy, Trash2, AlertTriangle, BarChart2, Key, X, ChevronRight } from "lucide-react";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY_API   = "gemini_api_key";
const LS_KEY_HIST  = "research_history";
const MAX_HIST     = 5;
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`;

const SYSTEM_PROMPT = `You are Aurum, an elite institutional equity research analyst specializing exclusively in Indian stock markets — NSE and BSE listed companies. You have deep expertise in Indian accounting standards (Ind AS), SEBI regulations, sectoral dynamics of the Indian economy, and the behavioral patterns of Indian retail vs institutional investors.

Your analysis style is modeled after top Indian broking house research reports — like Motilal Oswal, Kotak Securities, ICICI Direct, and Nuvama. You are direct, data-driven, and you give a real opinion — not generic disclaimers.

When asked to analyse a stock, always follow this exact structure:

## 🏢 Business Overview
- What the company actually does (not copy-paste from annual report — explain it simply)
- Key products / services / revenue segments with approximate % contribution
- Promoter background and credibility (any red flags or track record?)
- Market position — leader, challenger, niche player?
- Listed on NSE/BSE? BSE SME? Year of listing?

## 📊 Financial Snapshot (Last 4 Quarters / Latest Annual)
- Revenue (₹ Cr) — absolute number + YoY growth %
- EBITDA and EBITDA margin % — trend improving or deteriorating?
- Net Profit (₹ Cr) + PAT margin %
- Debt-to-Equity ratio — is the balance sheet clean?
- ROCE and ROE — are they above cost of capital?
- Cash flow from operations — is profit backed by real cash?
- Any one-time items distorting numbers?

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
- Use Google Search to fetch the LATEST available data — current price, latest quarterly results, recent news
- All financial figures must be in Indian format (₹ Crores)
- If this is an SME IPO or recently listed stock, mention it clearly and add extra caution
- If promoter holding has decreased recently, flag it as a red flag
- If FII/DII holding has increased recently, flag it as a positive signal
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

// ─── Markdown renderer (simple, no deps) ─────────────────────────────────────

function ReportRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="mt-6 mb-2 text-base font-bold text-foreground border-b border-border pb-1">
          {line.replace("## ", "")}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mt-4 mb-1 text-sm font-semibold text-foreground">
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      const content = line.slice(2, -2);
      elements.push(
        <p key={key++} className="text-sm font-semibold text-foreground my-0.5">{content}</p>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const content = line.slice(2);
      elements.push(
        <div key={key++} className="flex gap-2 text-sm text-muted-foreground my-0.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
          <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-1" />);
    } else {
      elements.push(
        <p key={key++} className="text-sm text-muted-foreground my-0.5"
          dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    }
  }

  return <div className="py-1">{elements}</div>;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-muted px-1 rounded text-xs'>$1</code>");
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, userQuery: string): Promise<string> {
  const res = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: `Analyse this Indian stock for me: ${userQuery}` }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

async function callGeminiFollowUp(apiKey: string, stock: string, type: "redflags" | "peers"): Promise<string> {
  const prompt = type === "redflags"
    ? `For the NSE-listed stock ${stock}, give me the top 5 specific red flags an investor must monitor right now. Use latest available data. Format as a numbered list with a bold heading for each red flag and 1-2 sentences of explanation. Be direct and specific — no generic warnings.`
    : `Compare the NSE-listed stock ${stock} with its 3 closest listed peers on these metrics: Revenue Growth (YoY%), EBITDA Margin, Net Profit Margin, ROCE, PE Ratio, Debt/Equity. Present as a markdown table. Then give a 2-sentence summary of how ${stock} stands vs peers — is it a better or worse bet right now?`;

  const res = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
        AI Research uses Google Gemini with live web search. It's free — get your key from{" "}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
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
      <p className="text-[11px] text-muted-foreground">
        Your key is stored locally in your browser only — never sent anywhere except Google's API.
      </p>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AIResearchPanel() {
  const [apiKey, setApiKey]     = useState<string>(() => localStorage.getItem(LS_KEY_API) ?? "");
  const [query, setQuery]       = useState("");
  const [report, setReport]     = useState<string | null>(null);
  const [currentStock, setCurrentStock] = useState("");
  const [loading, setLoading]   = useState(false);
  const [followUpText, setFollowUpText] = useState<string | null>(null);
  const [followUpType, setFollowUpType] = useState<"redflags" | "peers" | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [history, setHistory]   = useState<ResearchEntry[]>(loadHistory);
  const reportRef = useRef<HTMLDivElement>(null);

  // Sync history to localStorage whenever it changes
  useEffect(() => { saveHistory(history); }, [history]);

  const handleAnalyse = async (stockQuery?: string) => {
    const q = (stockQuery ?? query).trim();
    if (!q) { toast.error("Enter a stock name or ticker"); return; }
    if (!apiKey) { toast.error("Add your Gemini API key first"); return; }

    setLoading(true);
    setReport(null);
    setFollowUpText(null);
    setFollowUpType(null);
    setCurrentStock(q.toUpperCase());

    try {
      const result = await callGemini(apiKey, q);
      setReport(result);
      // Prepend to history, deduplicate by query
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.query.toLowerCase() !== q.toLowerCase());
        return [{ query: q.toUpperCase(), report: result, timestamp: Date.now() }, ...filtered];
      });
      // Scroll to report
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Gemini error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async (type: "redflags" | "peers") => {
    if (!currentStock || !apiKey) return;
    setFollowUpLoading(true);
    setFollowUpType(type);
    setFollowUpText(null);
    try {
      const result = await callGeminiFollowUp(apiKey, currentStock, type);
      setFollowUpText(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Follow-up error: ${msg}`);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    const full = `AURUM RESEARCH — ${currentStock}\n${"─".repeat(50)}\n\n${report}`;
    navigator.clipboard.writeText(full).then(() => toast.success("Report copied!"));
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
    setFollowUpText(null);
    setFollowUpType(null);
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // ── No API key → show setup ──
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

  // ── Main UI ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">AI Research</h2>
          <Badge variant="outline" className="text-[10px]">Gemini + Live Search</Badge>
        </div>
        <button
          onClick={handleClearKey}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          title="Change API key"
        >
          <Key className="h-3 w-3" /> Change Key
        </button>
      </div>

      {/* Search bar */}
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
          <Button
            onClick={() => handleAnalyse()}
            disabled={loading || !query.trim()}
            className="gap-1.5 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Analysing..." : "Analyse"}
          </Button>
        </div>

        {/* History chips */}
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
      {loading && (
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

      {/* Report */}
      {report && !loading && (
        <Card className="p-5" ref={reportRef}>
          {/* Report header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg">{currentStock}</h3>
              <Badge variant="outline" className="text-[10px]">Aurum Report</Badge>
            </div>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
                <Copy className="h-3 w-3" /> Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setReport(null); setFollowUpText(null); setCurrentStock(""); }}
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Report body */}
          <ReportRenderer text={report} />

          {/* Follow-up actions */}
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Dig deeper</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => handleFollowUp("redflags")}
                disabled={followUpLoading}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-loss" />
                {followUpLoading && followUpType === "redflags" ? "Loading..." : "Top Red Flags"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => handleFollowUp("peers")}
                disabled={followUpLoading}
              >
                <BarChart2 className="h-3.5 w-3.5 text-primary" />
                {followUpLoading && followUpType === "peers" ? "Loading..." : "Compare with Peers"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Follow-up result */}
      {followUpText && !followUpLoading && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {followUpType === "redflags"
                ? <><AlertTriangle className="h-4 w-4 text-loss" /><h3 className="font-semibold text-sm">Red Flags — {currentStock}</h3></>
                : <><BarChart2 className="h-4 w-4 text-primary" /><h3 className="font-semibold text-sm">Peer Comparison — {currentStock}</h3></>
              }
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => navigator.clipboard.writeText(followUpText).then(() => toast.success("Copied!"))}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFollowUpText(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <ReportRenderer text={followUpText} />
        </Card>
      )}

      {followUpLoading && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              {followUpType === "redflags" ? "Identifying red flags..." : "Comparing with peers..."}
            </span>
          </div>
          <ReportSkeleton />
        </Card>
      )}

      {/* Empty state */}
      {!report && !loading && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-2">
          <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Type any NSE stock above</p>
          <p className="text-xs text-muted-foreground/60">
            Aurum will fetch live data and generate an institutional-grade report
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {["APOLLOMICRO", "TATAMOTORS", "IRFC", "ZOMATO", "DIXON"].map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); handleAnalyse(s); }}
                className="inline-flex items-center gap-0.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {s} <ChevronRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
