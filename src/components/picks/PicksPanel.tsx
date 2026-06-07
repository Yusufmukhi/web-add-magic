import { useState, useCallback } from "react";
import {
  TrendingUp, Building2, Layers, Zap, Gem,
  Users, Eye, RefreshCw, ChevronDown, ChevronUp,
  Key, ExternalLink, Star, AlertCircle, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CapCategory = "largecap" | "midcap" | "smallcap" | "sme";
type SmartMoneyTab = "fiidii" | "ace" | "analyst";

interface StockPick {
  ticker: string;
  name: string;
  cmp: string;
  target: string;
  upside: string;
  horizon: string;
  thesis: string;
  catalyst: string;
  conviction: "High" | "Medium" | "Low";
  risk: string;
}

interface FiiDiiEntry {
  ticker: string;
  name: string;
  sector: string;
  fiiChange: string;
  diiChange: string;
  signal: string;
  recentNews: string;
}

interface AceInvestorEntry {
  investor: string;
  ticker: string;
  name: string;
  holdingPct: string;
  qoqChange: string;
  thesis: string;
}

interface AnalystEntry {
  ticker: string;
  name: string;
  buyRatings: number;
  avgTarget: string;
  upside: string;
  topBroker: string;
  recentCall: string;
}

type PicksResult =
  | { type: "picks"; category: CapCategory; stocks: StockPick[]; generatedAt: string }
  | { type: "fiidii"; entries: FiiDiiEntry[]; generatedAt: string }
  | { type: "ace"; entries: AceInvestorEntry[]; generatedAt: string }
  | { type: "analyst"; entries: AnalystEntry[]; generatedAt: string };

const LS_KEY_API = "gemini_api_key";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const CAP_CONFIG: Record<CapCategory, {
  label: string;
  icon: React.ElementType;
  description: string;
  prompt: string;
}> = {
  largecap: {
    label: "Large Cap Recovery",
    icon: Building2,
    description: "Fallen from highs, fundamentals intact, re-rating due",
    prompt: `Search for Indian large cap stocks (market cap above ₹20,000 Cr, Nifty 100 or Nifty 200) that have fallen 25%+ from their 52-week or all-time high but have strong fundamentals intact. FII buying resuming OR analyst upgrade cycle OR earnings recovery visible in latest quarter. Give exactly 5 stocks. Return ONLY valid JSON with no markdown:
{"stocks":[{"ticker":"NSE_TICKER","name":"Company Name","cmp":"₹XXX","target":"₹XXX","upside":"XX%","horizon":"6-12 months","thesis":"2 sentence thesis on recovery","catalyst":"specific near-term trigger","conviction":"High","risk":"main downside risk"}]}`,
  },
  midcap: {
    label: "Mid Cap Compounders",
    icon: Layers,
    description: "20-30% CAGR compounders on path to large cap",
    prompt: `Search for Indian mid cap stocks (market cap ₹5,000–₹20,000 Cr) that compound at 20-30% CAGR with clean balance sheets capable of migrating to large cap in 3-5 years. ROCE above 18%, D/E below 0.5, 3yr revenue CAGR above 20%. Give exactly 5 stocks. Return ONLY valid JSON with no markdown:
{"stocks":[{"ticker":"NSE_TICKER","name":"Company Name","cmp":"₹XXX","target":"₹XXX","upside":"XX%","horizon":"2-3 years","thesis":"2 sentence compounding thesis","catalyst":"specific growth driver","conviction":"High","risk":"main risk"}]}`,
  },
  smallcap: {
    label: "Small Cap Multibaggers",
    icon: Zap,
    description: "3-5x potential, sector boom early-stage plays",
    prompt: `Search for Indian small cap stocks (market cap ₹500–₹5,000 Cr, NSE/BSE mainboard) positioned for 3-5x returns. Early-stage in sector booms: defence, EMS, specialty chemicals, new energy, railways. Business inflection visible in latest 2 quarters. Give exactly 5 stocks. Return ONLY valid JSON with no markdown:
{"stocks":[{"ticker":"NSE_TICKER","name":"Company Name","cmp":"₹XXX","target":"₹XXX","upside":"XX%","horizon":"2-3 years","thesis":"2 sentence multibagger thesis","catalyst":"specific inflection trigger","conviction":"Medium","risk":"main risk"}]}`,
  },
  sme: {
    label: "SME Generational Wealth",
    icon: Gem,
    description: "20-30x potential in 5-7 years, future-tech sectors",
    prompt: `Search for BSE SME or NSE Emerge listed stocks in future-tech sectors: semiconductor supply chain, space tech, EV powertrains, AI hardware, defence electronics, specialty materials. Strong promoter, debt-free, growing order book. 20-30x potential in 5-7 years. Give exactly 5 stocks. Return ONLY valid JSON with no markdown:
{"stocks":[{"ticker":"SME_TICKER","name":"Company Name","cmp":"₹XXX","target":"₹XXX","upside":"XXXX%","horizon":"5-7 years","thesis":"2 sentence generational wealth thesis","catalyst":"sector tailwind or order book trigger","conviction":"Medium","risk":"liquidity and SME-specific risks"}]}`,
  },
};

function parseGeminiError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error occurred.";
  const msg = err.message;
  if (msg.includes("429") || msg.toLowerCase().includes("quota"))
    return "Rate limit hit — wait ~15 seconds and retry.";
  if (msg.includes("401") || msg.includes("403"))
    return "Invalid API key. Check it in the Research tab.";
  return msg;
}

function safeParseJSON(text: string): unknown {
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(clean.slice(start, end + 1));
}

type GeminiPart = { text?: string; thought?: boolean };

function extractText(data: unknown): string {
  const parts = (data as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> })
    ?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string).join("");
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  const text = extractText(data);
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}

async function fetchPicks(apiKey: string, category: CapCategory): Promise<StockPick[]> {
  const text = await callGemini(apiKey, CAP_CONFIG[category].prompt);
  const parsed = safeParseJSON(text) as { stocks: StockPick[] };
  if (!Array.isArray(parsed.stocks)) throw new Error("Unexpected format");
  return parsed.stocks;
}

async function fetchFiiDii(apiKey: string): Promise<FiiDiiEntry[]> {
  const prompt = `Search for Indian stocks where FII holding increased more than 1% quarter-on-quarter in the latest shareholding disclosure (NSE/BSE filings). Also find stocks where both FII AND DII are simultaneously increasing. Include large, mid, and small caps. Give exactly 6 stocks. Return ONLY valid JSON with no markdown:
{"entries":[{"ticker":"NSE_TICKER","name":"Company Name","sector":"Sector","fiiChange":"+X.X% QoQ","diiChange":"+X.X% QoQ","signal":"FII accumulation or Both FII+DII or DII accumulation","recentNews":"one line why institutions are buying"}]}`;
  const text = await callGemini(apiKey, prompt);
  const parsed = safeParseJSON(text) as { entries: FiiDiiEntry[] };
  if (!Array.isArray(parsed.entries)) throw new Error("Unexpected format");
  return parsed.entries;
}

async function fetchAceInvestors(apiKey: string): Promise<AceInvestorEntry[]> {
  const prompt = `Search for the latest quarterly portfolio disclosures of these Indian ace investors: Ashish Kacholia, Vijay Kedia, Dolly Khanna, Mukul Agrawal, Porinju Veliyath. Find stocks where any of these investors INCREASED holding in the most recent available quarter. Give exactly 6 entries. Return ONLY valid JSON with no markdown:
{"entries":[{"investor":"Investor Full Name","ticker":"NSE_TICKER","name":"Company Name","holdingPct":"X.XX%","qoqChange":"+X.XX%","thesis":"one line on why this investor likely bought"}]}`;
  const text = await callGemini(apiKey, prompt);
  const parsed = safeParseJSON(text) as { entries: AceInvestorEntry[] };
  if (!Array.isArray(parsed.entries)) throw new Error("Unexpected format");
  return parsed.entries;
}

async function fetchAnalystPicks(apiKey: string): Promise<AnalystEntry[]> {
  const prompt = `Search for Indian stocks with the most Buy/Strong Buy ratings from top broking houses (Motilal Oswal, Kotak Securities, ICICI Direct, Nuvama, Emkay, JM Financial) in the last 30 days. Find stocks with 3+ buy ratings and significant target upside. Give exactly 6 stocks. Return ONLY valid JSON with no markdown:
{"entries":[{"ticker":"NSE_TICKER","name":"Company Name","buyRatings":4,"avgTarget":"₹XXX","upside":"XX%","topBroker":"Broker Name","recentCall":"one line on latest bullish call reason"}]}`;
  const text = await callGemini(apiKey, prompt);
  const parsed = safeParseJSON(text) as { entries: AnalystEntry[] };
  if (!Array.isArray(parsed.entries)) throw new Error("Unexpected format");
  return parsed.entries;
}

function ConvictionBadge({ level }: { level: "High" | "Medium" | "Low" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
      level === "High" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      level === "Medium" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      level === "Low" && "bg-muted text-muted-foreground",
    )}>
      <Star className="h-2.5 w-2.5" />
      {level}
    </span>
  );
}

function StockPickCard({ pick, onAnalyse }: { pick: StockPick; onAnalyse: (t: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="p-4 space-y-2.5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-foreground">{pick.ticker}</span>
            <ConvictionBadge level={pick.conviction} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{pick.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-sm font-semibold text-foreground">{pick.cmp}</p>
          <p className="text-xs text-emerald-500 font-semibold">↑ {pick.upside}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{pick.thesis}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-primary" />
          Target: <span className="font-medium text-foreground ml-1">{pick.target}</span>
        </span>
        <span className="opacity-40">·</span>
        <span>{pick.horizon}</span>
      </div>
      {expanded && (
        <div className="pt-2 space-y-2 border-t border-border">
          <div>
            <p className="text-[11px] font-semibold text-foreground mb-0.5">Catalyst</p>
            <p className="text-xs text-muted-foreground">{pick.catalyst}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-foreground mb-0.5">Key Risk</p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
              {pick.risk}
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 pt-0.5">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Less" : "Details"}
        </button>
        <button onClick={() => onAnalyse(pick.ticker)} className="flex items-center gap-1 text-[11px] text-primary hover:underline transition-colors">
          <Sparkles className="h-3 w-3" />
          Full Report
          <ExternalLink className="h-2.5 w-2.5" />
        </button>
      </div>
    </Card>
  );
}

function FiiDiiCard({ entry }: { entry: FiiDiiEntry }) {
  const bothBuying = entry.signal.toLowerCase().includes("both");
  return (
    <Card className={cn("p-4 space-y-2 hover:border-primary/40 transition-colors", bothBuying && "border-emerald-500/30")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">{entry.ticker}</span>
            {bothBuying && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">FII+DII</span>}
          </div>
          <p className="text-xs text-muted-foreground">{entry.name} · {entry.sector}</p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <p className="text-xs font-semibold text-emerald-500">FII {entry.fiiChange}</p>
          <p className="text-xs text-muted-foreground">DII {entry.diiChange}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{entry.recentNews}</p>
    </Card>
  );
}

function AceCard({ entry }: { entry: AceInvestorEntry }) {
  return (
    <Card className="p-4 space-y-2 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">{entry.ticker}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{entry.investor.split(" ")[0]}</span>
          </div>
          <p className="text-xs text-muted-foreground">{entry.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-foreground">{entry.holdingPct}</p>
          <p className="text-xs font-semibold text-emerald-500">{entry.qoqChange}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{entry.thesis}</p>
    </Card>
  );
}

function AnalystCard({ entry }: { entry: AnalystEntry }) {
  return (
    <Card className="p-4 space-y-2 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">{entry.ticker}</span>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
              {entry.buyRatings} Buy{entry.buyRatings !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{entry.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-foreground">Target {entry.avgTarget}</p>
          <p className="text-xs font-semibold text-emerald-500">↑ {entry.upside}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{entry.recentCall}</p>
      <p className="text-[11px] text-muted-foreground/70">Top broker: {entry.topBroker}</p>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[1,2,3,4,5].map((i) => (
        <Card key={i} className="p-4 space-y-3 animate-pulse">
          <div className="flex justify-between">
            <div className="space-y-1.5"><div className="h-4 w-20 rounded bg-muted"/><div className="h-3 w-32 rounded bg-muted"/></div>
            <div className="space-y-1.5 text-right"><div className="h-4 w-16 rounded bg-muted"/><div className="h-3 w-12 rounded bg-muted"/></div>
          </div>
          <div className="h-3 w-full rounded bg-muted"/><div className="h-3 w-5/6 rounded bg-muted"/>
        </Card>
      ))}
    </div>
  );
}

interface PicksPanelProps {
  onNavigateToResearch?: (ticker: string) => void;
}

export function PicksPanel({ onNavigateToResearch }: PicksPanelProps) {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(LS_KEY_API) ?? "");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [activeCapTab, setActiveCapTab] = useState<CapCategory>("largecap");
  const [smartTab, setSmartTab] = useState<SmartMoneyTab>("fiidii");
  const [picksCache, setPicksCache] = useState<Partial<Record<CapCategory, PicksResult>>>({});
  const [smartCache, setSmartCache] = useState<Partial<Record<SmartMoneyTab, PicksResult>>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const handleSaveKey = () => {
    const k = apiKeyInput.trim();
    if (!k) { toast.error("Enter a valid API key"); return; }
    localStorage.setItem(LS_KEY_API, k);
    setApiKey(k);
    toast.success("API key saved!");
  };

  const loadPicks = useCallback(async (category: CapCategory, force = false) => {
    if (!apiKey) { toast.error("Add your Gemini API key first"); return; }
    if (!force && picksCache[category]) return;
    setLoading(category);
    try {
      const stocks = await fetchPicks(apiKey, category);
      setPicksCache(prev => ({ ...prev, [category]: { type: "picks", category, stocks, generatedAt: new Date().toLocaleString("en-IN") } }));
    } catch (err) { toast.error(parseGeminiError(err)); }
    finally { setLoading(null); }
  }, [apiKey, picksCache]);

  const loadSmartMoney = useCallback(async (tab: SmartMoneyTab, force = false) => {
    if (!apiKey) { toast.error("Add your Gemini API key first"); return; }
    if (!force && smartCache[tab]) return;
    setLoading(tab);
    try {
      let result: PicksResult;
      if (tab === "fiidii") {
        result = { type: "fiidii", entries: await fetchFiiDii(apiKey), generatedAt: new Date().toLocaleString("en-IN") };
      } else if (tab === "ace") {
        result = { type: "ace", entries: await fetchAceInvestors(apiKey), generatedAt: new Date().toLocaleString("en-IN") };
      } else {
        result = { type: "analyst", entries: await fetchAnalystPicks(apiKey), generatedAt: new Date().toLocaleString("en-IN") };
      }
      setSmartCache(prev => ({ ...prev, [tab]: result }));
    } catch (err) { toast.error(parseGeminiError(err)); }
    finally { setLoading(null); }
  }, [apiKey, smartCache]);

  const currentPicks = picksCache[activeCapTab];
  const currentSmart = smartCache[smartTab];
  const isLoadingCap = loading === activeCapTab;
  const isLoadingSmart = loading === smartTab;

  if (!apiKey) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Stock Picks</h2>
          <Badge variant="outline" className="text-[10px]">AI-Powered · Live Data</Badge>
        </div>
        <Card className="p-6 space-y-4 border-dashed">
          <div className="flex items-center gap-2"><Key className="h-5 w-5 text-primary"/><h3 className="font-semibold">Gemini API Key Required</h3></div>
          <p className="text-sm text-muted-foreground">Same Gemini key as AI Research. Set it once and it works everywhere.</p>
          <div className="flex gap-2">
            <Input placeholder="Paste your Gemini API key..." value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSaveKey()} type="password" className="font-mono text-xs"/>
            <Button onClick={handleSaveKey} className="shrink-0">Save</Button>
          </div>
        </Card>
      </div>
    );
  }

  const SMART_TABS: { id: SmartMoneyTab; label: string }[] = [
    { id: "fiidii", label: "FII / DII Accumulation" },
    { id: "ace", label: "Ace Investor Buys" },
    { id: "analyst", label: "Analyst Consensus" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Cap-Wise Picks ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Cap-Wise Picks</h2>
          </div>
          <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5"/>Live Data</Badge>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(CAP_CONFIG) as CapCategory[]).map((cat) => {
            const cfg = CAP_CONFIG[cat];
            const Icon = cfg.icon;
            return (
              <button key={cat} onClick={() => { setActiveCapTab(cat); loadPicks(cat); }}
                className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  activeCapTab === cat ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}>
                <Icon className="h-3.5 w-3.5" />{cfg.label}
                {!!picksCache[cat] && activeCapTab !== cat && <span className="h-1.5 w-1.5 rounded-full bg-primary/50"/>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{CAP_CONFIG[activeCapTab].description}</p>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => loadPicks(activeCapTab, true)} disabled={isLoadingCap}>
            <RefreshCw className={cn("h-3 w-3", isLoadingCap && "animate-spin")}/>
            {isLoadingCap ? "Loading..." : currentPicks ? "Refresh" : "Load Picks"}
          </Button>
        </div>
        {isLoadingCap ? <LoadingGrid /> : currentPicks && currentPicks.type === "picks" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {currentPicks.stocks.map((pick) => (
                <StockPickCard key={pick.ticker} pick={pick} onAnalyse={(ticker) => { onNavigateToResearch?.(ticker); toast.info(`Navigate to Research → type ${ticker}`); }}/>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 text-right">Generated {currentPicks.generatedAt} · Not investment advice</p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
            {(() => { const Icon = CAP_CONFIG[activeCapTab].icon; return <Icon className="h-8 w-8 text-muted-foreground/30 mx-auto"/>; })()}
            <p className="text-sm font-medium text-muted-foreground">{CAP_CONFIG[activeCapTab].description}</p>
            <Button size="sm" onClick={() => loadPicks(activeCapTab)} className="gap-1.5"><Sparkles className="h-3.5 w-3.5"/>Generate Picks</Button>
          </div>
        )}
      </section>

      {/* ── Smart Money ── */}
      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary"/>
          <h2 className="font-display text-xl font-bold">Smart Money Tracker</h2>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SMART_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => { setSmartTab(id); loadSmartMoney(id); }}
              className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                smartTab === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}>
              {label}
              {!!smartCache[id] && smartTab !== id && <span className="h-1.5 w-1.5 rounded-full bg-primary/50"/>}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {smartTab === "fiidii" && "Stocks where institutions are actively accumulating"}
            {smartTab === "ace" && "Latest additions by India's ace investors — Kacholia, Kedia, Khanna & more"}
            {smartTab === "analyst" && "Highest buy-rated stocks from Motilal, Kotak, ICICI Direct"}
          </p>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => loadSmartMoney(smartTab, true)} disabled={isLoadingSmart}>
            <RefreshCw className={cn("h-3 w-3", isLoadingSmart && "animate-spin")}/>
            {isLoadingSmart ? "Loading..." : currentSmart ? "Refresh" : "Load"}
          </Button>
        </div>
        {isLoadingSmart ? <LoadingGrid /> : currentSmart ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {currentSmart.type === "fiidii" && currentSmart.entries.map((e, i) => <FiiDiiCard key={i} entry={e}/>)}
              {currentSmart.type === "ace" && currentSmart.entries.map((e, i) => <AceCard key={i} entry={e}/>)}
              {currentSmart.type === "analyst" && currentSmart.entries.map((e, i) => <AnalystCard key={i} entry={e}/>)}
            </div>
            <p className="text-[10px] text-muted-foreground/70 text-right">Generated {currentSmart.generatedAt} · Based on public filings</p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
            <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto"/>
            <p className="text-sm font-medium text-muted-foreground">
              {smartTab === "fiidii" && "FII / DII Accumulation Signals"}
              {smartTab === "ace" && "Ace Investor Portfolio Additions"}
              {smartTab === "analyst" && "Analyst Consensus Buy Calls"}
            </p>
            <Button size="sm" onClick={() => loadSmartMoney(smartTab)} className="gap-1.5"><Sparkles className="h-3.5 w-3.5"/>Load Data</Button>
          </div>
        )}
      </section>

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed border-t border-border pt-4">
        ⚠️ AI-generated using live web search. For educational/research purposes only. Not SEBI-registered investment advice. Always do your own due diligence.
      </p>
    </div>
  );
}
