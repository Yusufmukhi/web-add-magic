import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Search, Copy, AlertTriangle, BarChart2,
  Key, X, ChevronRight, TrendingUp, Users, BookOpen,
  MessageSquare, Building2, Newspaper, Send, Target,
  DollarSign, ShieldAlert, TrendingDown, FileText,
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
  | "financial_deep"
  | "agm_concall"
  | "promoter_governance"
  | "peers_industry"
  | "valuation"
  | "risk_assessment"
  | "exit_strategy"
  | "annual_report"
  | "news"
  | "custom";

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY_API  = "gemini_api_key";
const LS_KEY_HIST = "research_history";
const MAX_HIST    = 10;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
const GEMINI_STREAM_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;

// ─── Main system prompt ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Aurum — an elite institutional equity research analyst and portfolio manager specializing exclusively in Indian equities (NSE and BSE listed companies). You combine the rigor of a top broking house (Motilal Oswal, Kotak, Nuvama) with the directness of a seasoned fund manager who is investing their own money.

You have deep expertise in:
- Indian accounting standards (Ind AS) and spotting accounting red flags
- SEBI regulations, insider trading patterns, corporate governance
- Sectoral dynamics of the Indian economy — manufacturing, IT, pharma, defence, FMCG, financials
- Behavioral patterns of Indian retail vs institutional investors
- Reading AGM transcripts, concall recordings, and annual report fine print
- Identifying multibagger setups vs value traps

WHEN ASKED TO ANALYSE A STOCK, produce a complete institutional-quality research report in this exact structure:

---

## 1. 📋 Executive Summary
- What does this company actually do? (in plain English, not copy-paste from AR)
- Why is the market interested in it right now?
- **5 key investment takeaways** as bullet points — specific, data-backed, not generic

## 2. 🏢 Business Analysis
- Business model — how does it make money?
- Revenue segments with approximate % contribution (latest year)
- Geographic presence — domestic vs export mix
- Competitive advantages / moats (pricing power, switching costs, brand, tech)
- Market share and position — leader, challenger, niche?
- Key growth drivers for next 3 years
- Business-specific risks (customer concentration, input costs, etc.)

## 3. 📊 Financial Analysis (5-10 Year View)
Use Google Search to find the last 5-10 years of data. Present key metrics in a markdown table where possible.
- Revenue CAGR (3Y, 5Y, 10Y where available)
- EBITDA margin trend — improving, stable, or deteriorating?
- PAT CAGR and PAT margin trend
- EPS growth trend
- ROE and ROCE — consistently above 15%? Or declining?
- Free Cash Flow generation — is profit backed by real cash?
- Cash conversion cycle trend
- Debt-to-Equity trend — is the company leveraging up or deleveraging?
- Interest coverage ratio
- Working capital efficiency (debtor days, inventory days, payable days)
- **Red flags**: any revenue recognition issues, related party transactions, receivables ballooning, auditor qualifications?

## 4. 📣 AGM & Management Commentary
From the most recent AGM and earnings concall:
- **Management outlook** — what did MD/CEO say about next 1-2 years?
- **Specific guidance** — revenue, margin, volume targets given
- **Order book / pipeline** — size, conversion timeline
- **Capex plans** — amount, purpose, commissioning timeline
- **Key analyst questions and management responses** — what were the hard questions? Did management answer directly or dodge?
- **Management tone assessment** — confident and data-backed OR defensive and vague?
- Quote the most significant statement from recent concall/AGM

## 5. 📁 Annual Report Deep Dive
- Chairman's letter — strategic vision vs reality check
- Key points from Management Discussion & Analysis
- Risk section — what risks does management acknowledge?
- **Auditor observations** — any qualifications or emphasis of matter?
- Related-party transactions — are they arm's length?
- Contingent liabilities — anything material?
- Notes to accounts — any unusual items investors may miss?

## 6. 🏭 Industry & Competition Analysis
- Peer comparison table: Company | Mkt Cap | Revenue Growth | EBITDA Margin | ROCE | PE | Debt/Equity
- Competitive position vs top 3-4 peers
- Market opportunity size (TAM) and growth outlook
- Export opportunities (if applicable)
- Regulatory / policy tailwinds or headwinds
- Who is gaining share and who is losing?

## 7. 👤 Management & Corporate Governance
- Promoter background and credibility (first-gen entrepreneur? track record?)
- Current promoter holding % and QoQ trend (4 quarters)
- Any promoter pledging? What %?
- Capital allocation history — dividends, buybacks, capex discipline
- SEBI orders, fraud allegations, or governance red flags
- Insider buying or selling pattern (last 6-12 months)
- **Governance Score: X/10** — explain the score
- Management has delivered on past guidance: Yes / Partially / No

## 8. 💰 Valuation Analysis
- Current market price and market cap
- TTM PE, Forward PE (estimate), PEG ratio
- EV/EBITDA, Price-to-Book, Price-to-Sales
- Historical valuation range (last 3-5 years: PE band, mean, +1SD, -1SD)
- Peer valuation comparison table
- DCF or earnings-based fair value estimate (show assumptions)
- **Verdict: Undervalued / Fairly Valued / Overvalued** with reasoning
- Margin of safety at current price

## 9. 🎯 Investment Thesis
**Top 5 Reasons to BUY** — each with specific data, not generic statements
**Top 5 Reasons to AVOID** — honest counterarguments, not superficial

## 10. ⚠️ Risk Assessment
Rate each risk as Low / Medium / High:
- Industry risk
- Regulatory risk  
- Currency risk (for exporters)
- Execution risk (on expansion plans)
- Management/Governance risk
- Financial risk (leverage, liquidity)
- Valuation risk (priced for perfection?)
- Competitive risk

## 11. 📈 Expected Returns
**1-Year, 3-Year, 5-Year CAGR estimates:**
| Scenario | 1Y | 3Y | 5Y | Assumptions |
|----------|----|----|-----|-------------|
| Bull Case | | | | |
| Base Case | | | | |
| Bear Case | | | | |

## 12. 🚪 Exit Strategy
- Recommended holding period
- Valuation level where profit booking should start (specific PE or price target)
- Fundamental triggers that would justify exiting immediately
- Warning signs to monitor every quarter

## 13. 🏆 Final Fund Manager Verdict
Assume you are investing ₹10 lakh of your own capital:
- **Would you buy today?** — Yes / No / Wait for better entry
- **Portfolio allocation** — What % of your portfolio? (be specific: 2%, 5%, 10%)
- **Expected upside** — in ₹ and %
- **Downside risk** — in ₹ and %
- **Ideal holding period**
- **Probability of market-beating returns**: X%

**Final Recommendation:**
**[STRONG BUY / BUY / ACCUMULATE ON DIPS / HOLD / AVOID]**
**Target Price (12M): ₹___ | Current Price: ₹___ | Upside: ___%**
**Stop Loss: ₹___ | Confidence Level: X%**

*One paragraph in plain English explaining the verdict to a friend who asks "should I buy this?"*

---

CRITICAL RULES:
- Use Google Search to fetch the ABSOLUTE LATEST data — current price, latest quarterly results, latest concall, shareholding pattern
- All figures in Indian format (₹ Crores, ₹ Lakhs where appropriate)
- NEVER fabricate numbers — if data is unavailable for obscure stocks, say so clearly
- If promoter pledge > 20%, flag it prominently with ⚠️
- If auditor has qualified the accounts, flag it prominently with 🚨
- If FII/DII have been consistently buying for 3+ quarters, call it a strong signal
- Give a REAL directional opinion — never hedge with "may go up or down"
- If this is a BSE SME or recently listed stock (<3 years), add extra caution and note limited data
- The report should read like a Motilal Oswal initiation report, not a Wikipedia summary`;

// ─── Dig Deeper prompts ───────────────────────────────────────────────────────

const DIG_DEEPER_BUTTONS: {
  type: FollowUpType;
  label: string;
  loadingLabel: string;
  icon: React.ElementType;
  iconClass: string;
  prompt: (stock: string) => string;
}[] = [
  {
    type: "financial_deep",
    label: "10-Year Financials",
    loadingLabel: "Fetching...",
    icon: BarChart2,
    iconClass: "text-primary",
    prompt: (s) => `Do a deep financial analysis of the Indian listed company ${s} for the last 10 years (or maximum available). Search for historical financial data.

Present these in well-formatted markdown tables:

**Table 1 — P&L Trend (FY15 to FY25 where available)**
| Year | Revenue (₹Cr) | Revenue Growth% | EBITDA (₹Cr) | EBITDA Margin% | PAT (₹Cr) | PAT Margin% | EPS (₹) | EPS Growth% |

**Table 2 — Balance Sheet Health**
| Year | Total Debt (₹Cr) | D/E Ratio | Cash & Equiv (₹Cr) | Book Value/Share | ROCE% | ROE% |

**Table 3 — Cash Flow Quality**
| Year | CFO (₹Cr) | CFO/PAT% | Capex (₹Cr) | Free Cash Flow (₹Cr) | FCF Yield% |

**Table 4 — Working Capital Efficiency**
| Year | Debtor Days | Inventory Days | Payable Days | Cash Conversion Cycle |

After tables, provide:
1. **Trend Summary** — is the business getting stronger or weaker financially?
2. **Red Flags** — any receivables ballooning, cash flow not matching profits, rising debt despite good margins?
3. **Quality of Earnings** — is PAT growth backed by operating cash flow or accounting adjustments?
4. **Key Financial Ratios today** — current P/E, P/B, EV/EBITDA, Dividend Yield
All figures in ₹ Crores. Use Google Search for the latest data.`,
  },
  {
    type: "agm_concall",
    label: "AGM / Concall",
    loadingLabel: "Loading...",
    icon: BookOpen,
    iconClass: "text-purple-500",
    prompt: (s) => `Find and summarize the most recent earnings concall AND AGM for the Indian company ${s}. Search for the latest available transcript or recording summary.

Cover:
1. **Date and Context** — which quarter/year concall, how did stock react after?
2. **Management Opening Commentary** — what were the key highlights management chose to lead with?
3. **Specific Guidance Given**
   - Revenue guidance for next FY (exact numbers or range if given)
   - Margin guidance (EBITDA margin target)
   - Volume/capacity targets
   - Any segment-specific guidance
4. **Order Book / Pipeline** — total order book value, L1 position, expected execution timeline
5. **Capex Plans** — amount planned, purpose (expansion/maintenance), commissioning timeline, funding source
6. **Key Analyst Questions** — list the 5 most important questions asked by analysts and exactly how management answered. Were the answers direct with data, or evasive?
7. **Management Tone Assessment** — rate as: Confident & Data-backed / Cautiously Optimistic / Defensive / Evasive
8. **Most Significant Quote** — the single most important statement from the entire concall
9. **AGM Highlights** — any important shareholder questions, resolutions passed, dividend announced
10. **What to Watch Next Quarter** — based on their guidance, what specific metrics should investors track?
Be specific. Quote actual statements where possible.`,
  },
  {
    type: "promoter_governance",
    label: "Promoter & Governance",
    loadingLabel: "Loading...",
    icon: Users,
    iconClass: "text-amber-500",
    prompt: (s) => `Give me an exhaustive promoter and corporate governance analysis for the Indian listed company ${s}.

1. **Promoter Profile**
   - Full name(s) of key promoters and their background
   - First-generation entrepreneur or business family? Other businesses?
   - Founder story — how did they build this company?
   - Promoter's stated vision and long-term goals

2. **Promoter Holding Trend (Last 8 Quarters)**
   Present as table: Quarter | Promoter% | FII% | DII% | Public%
   Has promoter been increasing or decreasing stake? Is this a signal?

3. **Promoter Pledge Analysis**
   - Current pledged shares % (if any)
   - Trend — increasing or decreasing pledge?
   - Risk assessment: >20% pledge is HIGH RISK — explain why
   - Any margin calls or pledge invocation in recent history?

4. **Capital Allocation Track Record**
   - Dividend history — consistent, growing, or erratic?
   - Buyback history — have they bought back at good prices?
   - Acquisition track record — value-accretive or value-destructive?
   - Capex discipline — do they overspend on pet projects?
   - ROIC trend — are they investing in high-return opportunities?

5. **Governance Red Flags (search thoroughly)**
   - Any SEBI orders, show-cause notices, or regulatory actions?
   - Any court cases or legal disputes material to the business?
   - Related party transactions — are they arm's length and disclosed?
   - Auditor changes in last 5 years? If yes, why?
   - Any auditor qualifications or emphasis of matter?

6. **Management Team Quality**
   - CEO/MD — tenure, background, compensation vs performance
   - CFO — tenure, background
   - Key hires or exits in last 12 months
   - Board composition — independent directors quality
   - Any key-man risk?

7. **Insider Activity**
   - Any SAST/SEBI disclosures of insider buying/selling in last 12 months?
   - Promoter open market purchases (very bullish signal) or sales?

8. **Governance Score: X/10**
   Score out of 10 with clear reasoning. What would make it higher?

9. **Final Verdict on Management**
   Would you trust this management with your money? Why or why not? Be direct.`,
  },
  {
    type: "peers_industry",
    label: "Peers & Industry",
    loadingLabel: "Comparing...",
    icon: Building2,
    iconClass: "text-blue-500",
    prompt: (s) => `Do a comprehensive peer comparison and industry analysis for the Indian listed company ${s}.

**Part 1: Peer Comparison Table**
Identify the top 4-5 closest listed Indian peers. Present as markdown table:
| Company | CMP (₹) | Mkt Cap (₹Cr) | Rev Growth (YoY%) | EBITDA Margin% | PAT Margin% | ROCE% | ROE% | PE (TTM) | EV/EBITDA | D/E | Div Yield% |

**Part 2: Competitive Position Analysis**
For each peer, in 2-3 sentences: What is their key differentiator vs ${s}? Where does ${s} win and where does it lose?

**Part 3: Market Share & Positioning**
- What is ${s}'s estimated market share in its primary segment?
- Is it gaining or losing share? Evidence?
- Who is the biggest competitive threat?

**Part 4: Industry Analysis**
- Industry TAM (Total Addressable Market) in India and globally if relevant
- Industry growth rate CAGR (last 5 years vs next 5 years estimate)
- Industry cycles — where are we in the current cycle?
- Key industry tailwinds for next 3-5 years
- Key industry headwinds or structural risks

**Part 5: Regulatory & Policy Environment**
- Any government policies benefiting this sector (PLI, import duties, Make in India)?
- Any regulatory risks (SEBI, sector regulator, environmental, etc.)?
- Export opportunities — which countries, what demand?

**Part 6: Sector Verdict**
- Is this a good sector to be in right now?
- Within the sector, is ${s} the best pick, second-best, or avoid?
- Which peer would you buy instead if not ${s}? Why?`,
  },
  {
    type: "valuation",
    label: "Valuation Deep Dive",
    loadingLabel: "Calculating...",
    icon: DollarSign,
    iconClass: "text-emerald-500",
    prompt: (s) => `Do an exhaustive valuation analysis of the Indian listed company ${s}.

1. **Current Valuation Snapshot**
   - Current Market Price: ₹___
   - Market Cap: ₹___ Cr (Large/Mid/Small cap)
   - Enterprise Value: ₹___ Cr
   - TTM PE, Forward PE (FY25E, FY26E estimates)
   - EV/EBITDA (TTM and forward)
   - Price-to-Book Value
   - Price-to-Sales
   - PEG Ratio (PE / EPS Growth Rate)
   - Dividend Yield %

2. **Historical Valuation Band (Last 5 Years)**
   Present as table: Metric | Current | 1Y Avg | 3Y Avg | 5Y Avg | 5Y High | 5Y Low
   Is the stock trading at a premium or discount to its own history?

3. **Peer Valuation Comparison**
   | Company | PE | EV/EBITDA | P/B | Growth Rate | PEG |
   Is ${s} expensive or cheap vs peers on each metric? Why?

4. **Earnings-Based Fair Value**
   - FY26E EPS estimate: ₹___
   - Fair PE multiple for this business quality and growth rate: ___ x
   - Fair Value = EPS × PE: ₹___
   - Upside/Downside from current price: ___%
   Justify your PE multiple choice — why does this business deserve that multiple?

5. **DCF Valuation (simplified)**
   Assumptions: Revenue CAGR %, EBITDA margin %, Terminal growth rate %, Discount rate %
   - DCF Intrinsic Value: ₹___
   - Margin of Safety at current price: ___%

6. **Scenario Analysis**
   | Scenario | FY26E EPS | Applied PE | Target Price | Return% |
   |----------|-----------|-----------|--------------|---------|
   | Bull Case | | | | |
   | Base Case | | | | |
   | Bear Case | | | | |

7. **Valuation Verdict**
   - Is the stock: UNDERVALUED / FAIRLY VALUED / OVERVALUED?
   - What is the right entry price range for a new investor?
   - At what price does the risk-reward stop making sense?
   - Margin of safety: adequate / tight / none

All figures in ₹ Crores. Use Google Search for current price and estimates.`,
  },
  {
    type: "risk_assessment",
    label: "Full Risk Report",
    loadingLabel: "Assessing...",
    icon: ShieldAlert,
    iconClass: "text-red-500",
    prompt: (s) => `Do a comprehensive risk assessment for the Indian listed company ${s}. For each risk, rate it Low / Medium / High and explain specifically why.

1. **Industry Risk** [Low/Medium/High]
   - Cyclicality of the industry
   - Threat of disruption (technology, new entrants, imports)
   - Commodity or input cost exposure
   - Demand visibility (order-backed vs spot demand)

2. **Regulatory Risk** [Low/Medium/High]
   - SEBI, sector regulator, environmental compliance risk
   - Any pending regulatory actions?
   - Policy reversal risk (PLI, subsidies, import duties)
   - International regulatory risk (for exporters — US FDA, EU regulations)

3. **Currency Risk** [Low/Medium/High]
   - Export revenue as % of total (higher = more risk)
   - Natural hedge available?
   - Historical impact of INR movement on margins

4. **Execution Risk** [Low/Medium/High]
   - Are expansion plans on track or delayed?
   - History of project execution — on time and budget?
   - Integration risk if recent acquisitions made

5. **Management & Governance Risk** [Low/Medium/High]
   - Promoter pledge situation
   - Key-man dependency
   - Corporate governance track record
   - Any ongoing SEBI/legal matters

6. **Financial Risk** [Low/Medium/High]
   - Debt levels and repayment schedule
   - Interest coverage ratio
   - Liquidity — current ratio, quick ratio
   - Any covenant risks on existing debt?
   - Working capital stress risk

7. **Valuation Risk** [Low/Medium/High]
   - Is the stock priced for perfection?
   - What earnings miss would cause severe derating?
   - PE multiple compression risk if growth slows

8. **Competitive Risk** [Low/Medium/High]
   - New entrants entering the space?
   - Pricing pressure from incumbents?
   - Customer concentration risk?
   - Technology obsolescence risk?

9. **Macro Risk** [Low/Medium/High]
   - Interest rate sensitivity
   - GDP slowdown impact
   - Global recession exposure
   - China+1 or supply chain risk

10. **Black Swan / Tail Risks**
    - What is the single worst-case scenario that could destroy value permanently?
    - What is the probability of that scenario? Low/Medium/High
    - Is there any asymmetric downside risk investors are ignoring?

**Overall Risk Rating: LOW / MEDIUM / HIGH**
**Risk-Adjusted Investment Verdict**: Given these risks, is the current valuation adequately compensating investors?`,
  },
  {
    type: "exit_strategy",
    label: "Exit & Returns",
    loadingLabel: "Loading...",
    icon: TrendingDown,
    iconClass: "text-orange-500",
    prompt: (s) => `Provide a detailed exit strategy and return analysis for the Indian listed company ${s}.

1. **Expected Return Analysis**
   Present as table:
   | Scenario | 1-Year Target | 1Y CAGR | 3-Year Target | 3Y CAGR | 5-Year Target | 5Y CAGR | Key Assumptions |
   |----------|--------------|---------|--------------|---------|--------------|---------|-----------------|
   | Bull Case | | | | | | | |
   | Base Case | | | | | | | |
   | Bear Case | | | | | | | |

   For each case, state the key assumption that makes or breaks it.

2. **Ideal Entry Range**
   - Best price to enter for maximum risk-reward: ₹___ to ₹___
   - Why this range? (specific PE, EV/EBITDA, or fundamental trigger)
   - What % below current price would be an "obvious buy"?

3. **Profit Booking Strategy**
   - At what valuation/price should you book 25% profits? ₹___ (what PE?)
   - At what valuation/price should you book 50% profits? ₹___
   - At what valuation/price would you fully exit? ₹___
   - Time-based: If no thesis progress in X months, reduce position

4. **Mandatory Exit Triggers** (sell immediately regardless of price)
   List 5 specific fundamental triggers that would make you exit immediately:
   - e.g., Promoter pledge crosses X%, auditor qualification, key client loss, etc.

5. **Quarterly Monitoring Checklist**
   List the 8 most important metrics/events to check every quarter:
   - Revenue growth vs guidance
   - Margin trend
   - Order book additions
   - Promoter shareholding change
   - FII/DII activity
   - Working capital changes
   - Management commentary tone
   - Any regulatory developments

6. **Holding Period Recommendation**
   - Minimum recommended holding: ___ months/years for thesis to play out
   - Optimal holding for base case returns: ___ years
   - What happens if you hold 10 years? (compounding power)

7. **Portfolio Sizing Recommendation**
   - Conservative investor (low risk tolerance): ___% allocation
   - Moderate investor: ___% allocation
   - Aggressive investor: ___% allocation
   - Maximum allocation any investor should take: ___%
   Explain reasoning for each.

8. **Final Fund Manager Call**
   You are investing ₹10 lakh of your own money today.
   Decision: BUY / ACCUMULATE / WAIT / AVOID
   Amount you'd invest: ₹___ lakh (___%)
   Expected return: ₹___ in ___ years
   Confidence level: __%`,
  },
  {
    type: "annual_report",
    label: "Annual Report Dive",
    loadingLabel: "Analysing...",
    icon: FileText,
    iconClass: "text-teal-500",
    prompt: (s) => `Do a deep dive into the most recent Annual Report of the Indian listed company ${s} (latest available — FY24 or FY25). Search for the annual report details online.

1. **Chairman's Message Analysis**
   - What was the key message? Vision vs reality check
   - Did the chairman acknowledge challenges honestly or only talk positives?
   - What strategic direction did they signal for next 3-5 years?
   - Any specific commitments made?

2. **Management Discussion & Analysis (MD&A) Key Points**
   - Industry overview as presented by management
   - Company performance narrative — is it honest or spin?
   - Segment-wise performance highlights
   - Key operational achievements

3. **Risk Section Analysis**
   - What are the top 5 risks management themselves acknowledge?
   - Are these real risks or boilerplate copy-paste?
   - Any new risks added vs previous year AR?
   - What risks did they NOT mention that you think are real?

4. **Auditor's Report Deep Dive** ⚠️ CRITICAL
   - Who is the auditor (Big 4 or mid-tier)?
   - Any qualifications in the audit report? [Flag with 🚨 if yes]
   - Any Emphasis of Matter paragraphs? What do they say?
   - Key Audit Matters (KAM) — what did auditors focus on? Why?
   - Has the auditor changed in last 5 years? If yes, flag it.

5. **Related Party Transactions** ⚠️
   - Total value of RPTs in the year
   - Nature of transactions — are they arm's length?
   - Any transactions with promoter entities that seem unusual?
   - Any loans to related parties?

6. **Notes to Accounts — Hidden Insights**
   - Contingent liabilities — material lawsuits or claims?
   - Off-balance sheet items — any operating lease or guarantee exposure?
   - Inventory valuation method changes?
   - Revenue recognition policy — any aggressive accounting?
   - Employee stock option expense — how much?

7. **Things Investors Usually Miss**
   List 5 specific items from this annual report that most retail investors would overlook but are important for understanding business quality or risk.

8. **Annual Report Verdict**
   Grade the annual report: A / B / C / D
   - Transparency score: X/10
   - Management credibility from this report: X/10
   - Any concerns raised vs previous year's AR?`,
  },
  {
    type: "news",
    label: "Latest News",
    loadingLabel: "Searching...",
    icon: Newspaper,
    iconClass: "text-green-500",
    prompt: (s) => `Search for all important recent news and developments for the Indian listed company ${s} in the last 60 days. Be comprehensive.

1. **Order Wins & Business Developments**
   - Any new contracts, order wins, or LOIs announced? Mention value and client.
   - New partnerships, JVs, or collaborations?
   - Product launches or capacity additions?
   - Export deals or new market entries?

2. **Financial Results**
   - Latest quarterly results — revenue, EBITDA, PAT vs estimates and YoY
   - How did the stock react on results day? Why?
   - Key positive or negative surprise in numbers?

3. **Regulatory & Legal News**
   - Any SEBI notices, court orders, or government actions?
   - Any compliance issues or penalties?
   - Any environmental or labor law matters?

4. **Management Changes**
   - Any CEO, CFO, or board member changes?
   - Key hires (positive) or exits (potential red flag)?
   - Any MD/promoter statements in media?

5. **Shareholding Changes (Latest Quarter)**
   - FII holding change
   - DII/MF buying or selling
   - Any new ace investor entry or exit?
   - Promoter buying or selling?

6. **Sector News Affecting This Company**
   - Any PLI announcements or policy changes?
   - Competitor wins or losses affecting market dynamics?
   - Commodity price moves affecting margins?
   - Global events relevant to this company?

7. **Stock Price Analysis**
   - 1M, 3M, 6M, 1Y performance vs Nifty 50
   - 52-week high/low and current position
   - Any significant block deals or bulk deals?
   - Technical levels — near support or resistance?

8. **Upcoming Catalysts to Watch**
   - Next results date
   - Any AGM or investor day scheduled?
   - Order announcements expected?
   - Regulatory milestones pending?

9. **Analyst Activity**
   - Any new research reports published? What's the target?
   - Rating upgrades or downgrades in last 30 days?
   - Consensus target price and % of analysts with Buy rating?

Present with specific dates and sources where possible.`,
  },
];

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
  if (msg.includes("429") || msg.toLowerCase().includes("quota"))
    return "Rate limit hit — free tier allows 10 req/min. Wait ~15 seconds and retry.";
  if (msg.includes("400"))
    return "Bad request. Ensure your API key has Gemini 2.5 Flash access at aistudio.google.com.";
  if (msg.includes("401") || msg.includes("403"))
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

// ─── Markdown renderer ────────────────────────────────────────────────────────

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
      if (/^[\|\-\s]+$/.test(nextLine)) {
        rawElements.push(
          <tr key={key++} data-header="1" className="bg-muted/60">
            {cells.map((c, j) => (
              <th key={j} className="px-3 py-2 text-left text-xs font-semibold text-foreground border border-border whitespace-nowrap">{c}</th>
            ))}
          </tr>
        );
      } else if (/^[\|\-\s]+$/.test(line)) {
        // skip separator row
      } else {
        rawElements.push(
          <tr key={key++} className="even:bg-muted/20 hover:bg-muted/30 transition-colors">
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
      rawElements.push(
        <div key={key++} className="flex gap-2.5 text-sm text-muted-foreground my-1">
          <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mt-0.5">{num}</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^\d+\.\s/, "")) }} />
        </div>
      );
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      rawElements.push(
        <p key={key++} className="text-sm font-semibold text-foreground my-0.5">{line.slice(2, -2)}</p>
      );
    } else if (line.trim() === "") {
      rawElements.push(<div key={key++} className="h-1" />);
    } else {
      rawElements.push(
        <p key={key++} className="text-sm text-muted-foreground my-0.5"
          dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    }
  }

  // wrap <tr> groups in <table>
  const final: React.ReactNode[] = [];
  let rows: React.ReactNode[] = [];
  const flush = () => {
    if (rows.length) {
      final.push(
        <div key={`tbl-${final.length}`} className="overflow-x-auto my-3 rounded-md border border-border">
          <table className="w-full border-collapse text-sm">{rows}</table>
        </div>
      );
      rows = [];
    }
  };
  for (const el of rawElements) {
    if ((el as React.ReactElement)?.type === "tr") rows.push(el);
    else { flush(); final.push(el); }
  }
  flush();

  return <div className="py-1">{final}</div>;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-muted px-1 rounded text-xs font-mono'>$1</code>");
}

// ─── Streaming call ───────────────────────────────────────────────────────────

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
      contents: [{ parts: [{ text: `Analyse this Indian stock and produce a complete institutional research report: ${userQuery}` }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let fullText = "", buffer = "";

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
        const chunk = extractText(parsed?.candidates?.[0]?.content?.parts);
        if (chunk) { fullText += chunk; onChunk(fullText); }
      } catch { /* partial json */ }
    }
  }

  if (!fullText) throw new Error("Empty response from Gemini.");
  return fullText;
}

// ─── Non-streaming follow-up ──────────────────────────────────────────────────

async function callGeminiFollowUp(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 6000, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
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
      {[2/3, 1, 5/6, 4/5, 0, 1/2, 1, 3/4, 0, 2/3, 1, 5/6].map((w, i) => (
        <div key={i} className={cn("h-3 rounded bg-muted", w === 0 ? "h-4" : "")} style={{ width: w === 0 ? "40%" : `${w * 100}%` }} />
      ))}
    </div>
  );
}

// ─── API Key Setup ────────────────────────────────────────────────────────────

function ApiKeySetup({ onSave }: { onSave: (key: string) => void }) {
  const [val, setVal] = useState("");
  const handleSave = () => {
    const k = val.trim();
    if (!k) { toast.error("Enter a valid API key"); return; }
    localStorage.setItem(LS_KEY_API, k);
    onSave(k);
    toast.success("API key saved!");
  };
  return (
    <Card className="p-6 space-y-4 border-dashed">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Setup Gemini API Key</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        AI Research uses <strong>Gemini 2.5 Flash</strong> with live Google Search — free tier: 1,500 req/day. Get your key at{" "}
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">aistudio.google.com</a>
      </p>
      <div className="flex gap-2">
        <Input placeholder="Paste your Gemini API key..." value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} type="password" className="font-mono text-xs" />
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
  const [apiKey, setApiKey]         = useState<string>(() => localStorage.getItem(LS_KEY_API) ?? "");
  const [query, setQuery]           = useState("");
  const [report, setReport]         = useState<string | null>(null);
  const [currentStock, setCurrentStock] = useState("");
  const [loading, setLoading]       = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const [followUpText, setFollowUpText]   = useState<string | null>(null);
  const [followUpType, setFollowUpType]   = useState<FollowUpType | null>(null);
  const [followUpLabel, setFollowUpLabel] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [customQuery, setCustomQuery]     = useState("");

  const [history, setHistory] = useState<ResearchEntry[]>(loadHistory);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveHistory(history); }, [history]);

  useEffect(() => {
    if (prefillTicker?.trim()) {
      setQuery(prefillTicker.trim());
      onPrefillConsumed?.();
      if (apiKey) setTimeout(() => handleAnalyse(prefillTicker.trim()), 100);
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
      const result = await callGeminiStream(apiKey, q, setStreamingText);
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
      const result = await callGeminiFollowUp(apiKey, prompt);
      setFollowUpText(result);
    } catch (err) {
      toast.error(parseGeminiError(err));
    } finally {
      setFollowUpLoading(false);
    }
  }, [apiKey, currentStock]);

  const handleCustomQuery = () => {
    const q = customQuery.trim();
    if (!q) { toast.error("Type your question first"); return; }
    const prompt = `For the NSE/BSE listed company ${currentStock}: ${q}\n\nUse live web search for the latest available data. Be specific, factual, and use Indian number formatting (₹ Crores). Structure your answer clearly.`;
    handleFollowUp("custom", prompt, q);
    setCustomQuery("");
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(`AURUM RESEARCH — ${currentStock}\n${"─".repeat(60)}\n\n${report}`)
      .then(() => toast.success("Full report copied!"));
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
          <Badge variant="outline" className="text-[10px]">Institutional Grade</Badge>
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
          <Badge variant="outline" className="text-[10px]">Gemini 2.5 Flash · Institutional Grade · Live</Badge>
        </div>
        <button onClick={() => { localStorage.removeItem(LS_KEY_API); setApiKey(""); toast("API key removed"); }}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Key className="h-3 w-3" /> Change Key
        </button>
      </div>

      {/* Search bar */}
      <Card className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input className="pl-9 font-medium" placeholder="APOLLOMICRO, Sharda Cropchem, IRFC, Zomato..."
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleAnalyse()} disabled={loading} />
          </div>
          <Button onClick={() => handleAnalyse()} disabled={loading || !query.trim()} className="gap-1.5 shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Analysing..." : "Analyse"}
          </Button>
        </div>

        {/* What the report includes */}
        <div className="flex flex-wrap gap-1">
          {["Executive Summary", "10Y Financials", "AGM/Concall", "Promoter Quality", "Industry", "Valuation", "Risk Matrix", "Exit Strategy", "Fund Manager Verdict"].map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>
          ))}
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] text-muted-foreground self-center">Recent:</span>
            {history.map((h) => (
              <button key={h.timestamp} onClick={() => handleLoadHistory(h)}
                className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-accent",
                  currentStock === h.query ? "border-primary text-primary bg-accent" : "border-border text-muted-foreground")}>
                {h.query}
                <span className="text-[10px] opacity-60">{timeAgo(h.timestamp)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Skeleton before first streaming chunk */}
      {loading && !isStreaming && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Generating full institutional report for <span className="font-semibold text-foreground">{currentStock}</span>...
            </span>
          </div>
          <ReportSkeleton />
        </Card>
      )}

      {/* Main report card */}
      {displayText && (
        <Card className="p-5" ref={reportRef}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-lg">{currentStock}</h3>
              <Badge variant="outline" className="text-[10px]">Aurum Institutional Report</Badge>
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
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => { setReport(null); setStreamingText(""); setFollowUpText(null); setCurrentStock(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <ReportRenderer text={displayText} />

          {/* ── Dig Deeper ── */}
          {!loading && (
            <div className="mt-6 pt-4 border-t border-border space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Dig Deeper</p>
                <span className="text-[10px] text-muted-foreground">— each section is a full institutional deep-dive</span>
              </div>

              {/* Preset buttons in 2 rows */}
              <div className="flex flex-wrap gap-2">
                {DIG_DEEPER_BUTTONS.map((btn) => {
                  const Icon = btn.icon;
                  const isActive = followUpType === btn.type;
                  const isThisLoading = followUpLoading && followUpType === btn.type;
                  return (
                    <Button key={btn.type}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => handleFollowUp(btn.type, btn.prompt(currentStock), btn.label)}
                      disabled={followUpLoading}>
                      <Icon className={cn("h-3.5 w-3.5", !isActive && btn.iconClass)} />
                      {isThisLoading ? btn.loadingLabel : btn.label}
                    </Button>
                  );
                })}
              </div>

              {/* Custom question */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-9 text-xs h-9"
                      placeholder={`Ask anything about ${currentStock || "this stock"} — debt schedule, SEBI history, export mix...`}
                      value={customQuery}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !followUpLoading && handleCustomQuery()}
                      disabled={followUpLoading} />
                  </div>
                  <Button size="sm" variant="outline" className="h-9 gap-1 text-xs shrink-0"
                    onClick={handleCustomQuery} disabled={followUpLoading || !customQuery.trim()}>
                    <Send className="h-3 w-3" />
                    Ask
                  </Button>
                </div>

                {/* Quick chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Debt repayment schedule?",
                    "Any SEBI actions against management?",
                    "Export revenue % and key markets?",
                    "Promoter interview or recent media statement?",
                    "Working capital cycle trend?",
                    "Order book execution timeline?",
                    "Dividend history last 10 years?",
                    "What triggered the last major price fall?",
                  ].map((s) => (
                    <button key={s} onClick={() => setCustomQuery(s)} disabled={followUpLoading}
                      className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Follow-up loading */}
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

      {/* Follow-up result */}
      {followUpText && !followUpLoading && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {(() => {
                const btn = DIG_DEEPER_BUTTONS.find((b) => b.type === followUpType);
                const Icon = btn?.icon ?? MessageSquare;
                return (
                  <>
                    <Icon className={cn("h-4 w-4", btn?.iconClass ?? "text-primary")} />
                    <h3 className="font-semibold text-sm">
                      {followUpType === "custom" ? followUpLabel : `${btn?.label ?? "Analysis"} — ${currentStock}`}
                    </h3>
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

          {/* Follow-up on follow-up */}
          <div className="mt-4 pt-3 border-t border-border flex gap-2">
            <div className="relative flex-1">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input className="pl-9 text-xs h-8" placeholder="Ask a follow-up question..."
                value={customQuery} onChange={(e) => setCustomQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !followUpLoading && handleCustomQuery()}
                disabled={followUpLoading} />
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
        <>
          <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Institutional-grade report in one click</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                13-section report covering financials, AGM, promoter, valuation, risks, exit strategy &amp; fund manager verdict
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {["APOLLOMICRO", "SHARDACROP", "IRFC", "DIXON", "KAYNES"].map((s) => (
                <button key={s} onClick={() => { setQuery(s); handleAnalyse(s); }}
                  className="inline-flex items-center gap-0.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  {s} <ChevronRight className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>

          <Card className="p-4 border-dashed border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">What Aurum covers</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                "Executive Summary + 5 key takeaways",
                "10-year P&L, Balance Sheet, Cash Flow",
                "AGM concall with exact management quotes",
                "Annual report auditor & notes deep dive",
                "Promoter profile + governance score /10",
                "FII/DII shareholding trend (4 quarters)",
                "Peer comparison + industry positioning",
                "Valuation — DCF + scenario analysis",
                "Full risk matrix — 9 risk categories",
                "Bull/Base/Bear return estimates (5Y)",
                "Exit strategy + profit booking levels",
                "Fund manager verdict with % allocation",
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
