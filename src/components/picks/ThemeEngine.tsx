/**
 * ThemeEngine — "If X rises, who benefits?"
 *
 * Real-world macro/sector events mapped to beneficiary stock baskets.
 * Each theme has:
 * - A trigger (what event / macro move causes this)
 * - Direct beneficiaries (first order — obvious plays)
 * - Indirect beneficiaries (second order — less obvious, higher alpha)
 * - Stocks to AVOID when this theme plays out
 * - Historical precedent from Indian markets
 * - Real NSE tickers in each bucket
 */

import { useState, useCallback } from "react";
import {
  Zap, TrendingUp, TrendingDown, Building2, Globe,
  Sun, Shield, Cpu, Train, Droplets, Factory,
  ArrowRight, ChevronDown, ChevronUp, Sparkles,
  AlertTriangle, Info, RefreshCw, ArrowUpRight,
} from "lucide-react";import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getSupabaseConfig, isStale, ageLabel,
  getThemeDeepDive, saveThemeDeepDive,
} from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImpactLevel = "direct" | "indirect" | "avoid";

interface ThemeTicker {
  ticker: string;
  reason: string;           // why this specific stock benefits
  impactLevel: ImpactLevel;
}

interface Theme {
  id: string;
  category: string;         // "Macro" | "Sector" | "Policy" | "Global"
  trigger: string;          // "Crude oil falls below $70"
  icon: React.ElementType;
  color: string;
  headline: string;         // short label
  description: string;      // what this event means for India
  directBeneficiaries: ThemeTicker[];
  indirectBeneficiaries: ThemeTicker[];
  avoid: ThemeTicker[];
  historicalNote: string;   // "When crude fell 40% in 2014-15, paints sector rallied 60%"
  magnitude: "High" | "Medium" | "Low";  // expected market impact
  timeframe: string;        // "Immediate (days)" | "Medium term (months)" | "Long term (1-2Y)"
}

// ─── Theme database ───────────────────────────────────────────────────────────

export const THEMES: Theme[] = [
  {
    id: "crude_fall",
    category: "Macro",
    trigger: "Crude oil price falls significantly (below $70/barrel)",
    icon: Droplets,
    color: "text-emerald-500",
    headline: "Crude Oil Falls",
    description: "India imports ~85% of its crude. Every $10 fall in crude saves India ~$15B annually, reduces inflation, improves CAD, and directly cuts input costs for paint, tyre, aviation, and chemical companies.",
    directBeneficiaries: [
      { ticker: "ASIANPAINT", reason: "Crude-based raw materials (TiO2, monomers) are 40-50% of COGS — direct margin expansion", impactLevel: "direct" },
      { ticker: "BERGERPAINTS", reason: "Same input cost dynamic as Asian Paints — smaller base means bigger % impact", impactLevel: "direct" },
      { ticker: "MRF", reason: "Natural rubber + crude derivatives = 60%+ of RM costs — every $10 crude fall = 150-200bps margin boost", impactLevel: "direct" },
      { ticker: "APOLLOTYRE", reason: "Carbon black and synthetic rubber directly tied to crude — significant margin lever", impactLevel: "direct" },
      { ticker: "INDIGO", reason: "ATF (Aviation Turbine Fuel) is ~35% of operating cost — direct P&L benefit", impactLevel: "direct" },
      { ticker: "SPICEJET", reason: "Higher ATF cost sensitivity than IndiGo — larger % benefit but higher base risk", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "PIDILITIND", reason: "Vinyl acetate monomer (VAM) derived from crude — Fevicol margins improve", impactLevel: "indirect" },
      { ticker: "SUPREMEIND", reason: "PVC pipes — PVC is a crude derivative. Lower crude = lower PVC prices = margin expansion", impactLevel: "indirect" },
      { ticker: "ASTRAL", reason: "Similar to Supreme Industries — CPVC/PVC pipe business", impactLevel: "indirect" },
      { ticker: "FINOLEXIND", reason: "PVC pipes and fittings — direct input cost reduction", impactLevel: "indirect" },
      { ticker: "SRF", reason: "Specialty chemicals — crude-linked feedstock reduction improves margins", impactLevel: "indirect" },
      { ticker: "AARTIIND", reason: "Benzene-based specialty chemicals — crude fall = feedstock cost reduction", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "ONGC", reason: "Upstream oil producer — revenue directly falls with crude prices", impactLevel: "avoid" },
      { ticker: "OIL", reason: "Same upstream exposure as ONGC — earnings directly correlated to crude", impactLevel: "avoid" },
      { ticker: "RELIANCE", reason: "Refining margins compress in low crude environment — GRM impact", impactLevel: "avoid" },
      { ticker: "BPCL", reason: "Inventory losses on falling crude — marketing margins also compress", impactLevel: "avoid" },
    ],
    historicalNote: "In 2014-15 when crude fell from $110 to $45, Asian Paints rallied 80%, MRF doubled. Aviation stocks tripled. ONGC fell 40%.",
    magnitude: "High",
    timeframe: "Immediate to medium term (weeks to months)",
  },
  {
    id: "crude_rise",
    category: "Macro",
    trigger: "Crude oil spikes above $100/barrel (geopolitical shock, OPEC cut)",
    icon: Droplets,
    color: "text-red-500",
    headline: "Crude Oil Spikes",
    description: "Crude spike = inflation, CAD widening, INR pressure, input cost surge for downstream industries. Bad for India macro but creates specific winners.",
    directBeneficiaries: [
      { ticker: "ONGC", reason: "Every $10 rise in crude = ~₹3,000 Cr extra annual profit for ONGC", impactLevel: "direct" },
      { ticker: "OIL", reason: "Direct upstream beneficiary — E&P revenues surge", impactLevel: "direct" },
      { ticker: "CAIRN", reason: "Pure upstream play — highest operating leverage to crude prices", impactLevel: "direct" },
      { ticker: "GAIL", reason: "Gas transmission volumes and marketing margins improve in high energy price environment", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "DEEPAKNTR", reason: "Crude-linked chemical intermediates — inventory gains on rising input prices", impactLevel: "indirect" },
      { ticker: "GSPL", reason: "Gas infrastructure — increased demand for gas as crude substitute", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "INDIGO", reason: "ATF cost surge kills margins — 1% crude rise = ~₹200 Cr cost increase for IndiGo", impactLevel: "avoid" },
      { ticker: "ASIANPAINT", reason: "RM cost inflation hits margins — stock typically falls 10-15% in crude spike cycles", impactLevel: "avoid" },
      { ticker: "MRF", reason: "Input cost pressure — margins compress significantly", impactLevel: "avoid" },
      { ticker: "SUPREMEIND", reason: "PVC prices spike with crude — either margin compression or volume loss", impactLevel: "avoid" },
    ],
    historicalNote: "Russia-Ukraine 2022: Crude went to $130. ONGC hit ATH. IndiGo fell 35%. Paint stocks lost 20-25%.",
    magnitude: "High",
    timeframe: "Immediate (days to weeks)",
  },
  {
    id: "defence_budget",
    category: "Policy",
    trigger: "India increases defence budget / large defence order announcement",
    icon: Shield,
    color: "text-blue-500",
    headline: "Defence Budget Up",
    description: "India's defence indigenisation push (Atmanirbhar Bharat) is creating a domestic defence industrial complex. Budget hikes and indigenisation mandates directly benefit listed defence companies.",
    directBeneficiaries: [
      { ticker: "HAL", reason: "Primary aircraft manufacturer — direct recipient of IAF and Navy orders", impactLevel: "direct" },
      { ticker: "BEL", reason: "Electronics and radar systems — 80%+ revenue from defence MOD orders", impactLevel: "direct" },
      { ticker: "BEML", reason: "Heavy vehicles, metro, mining — defence + railway dual beneficiary", impactLevel: "direct" },
      { ticker: "APOLLOMICRO", reason: "Embedded defence electronics — niche high-margin supplier to DRDO/HAL/BEL", impactLevel: "direct" },
      { ticker: "PARAS", reason: "Defence aerostructures and precision parts — direct supply chain", impactLevel: "direct" },
      { ticker: "IDEAFORGE", reason: "Drones for defence — indigenisation mandate directly benefits drone makers", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "KAYNES", reason: "EMS for defence electronics — indirect beneficiary of defence electronics indigenisation", impactLevel: "indirect" },
      { ticker: "SYRMA", reason: "PCB and electronics manufacturing for defence sector supply chain", impactLevel: "indirect" },
      { ticker: "MTAR", reason: "Precision engineering for rockets, missiles, nuclear — ISRO and defence", impactLevel: "indirect" },
      { ticker: "DATAPATTERNSIND", reason: "Defence avionics and electronics — niche supplier benefiting from indigenisation", impactLevel: "indirect" },
      { ticker: "ELCOMPONTS", reason: "Electronic components supply chain to defence OEMs", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "CONCORD", reason: "Budget reallocation from infrastructure to defence may delay some contracts", impactLevel: "avoid" },
    ],
    historicalNote: "FY24 defence budget was ₹5.94L Cr — highest ever. HAL went from ₹1,400 to ₹4,800 in 18 months. BEL doubled.",
    magnitude: "High",
    timeframe: "Medium term (6-18 months for order execution to reflect in earnings)",
  },
  {
    id: "railway_budget",
    category: "Policy",
    trigger: "Railway capex budget increase / new rail project announcements",
    icon: Train,
    color: "text-purple-500",
    headline: "Railway Capex Surge",
    description: "India's railway modernisation is a decade-long structural theme. Each budget capex hike creates a multi-year order book for rolling stock, signalling, electrification, and track companies.",
    directBeneficiaries: [
      { ticker: "RVNL", reason: "Rail Vikas Nigam — directly executes government railway projects", impactLevel: "direct" },
      { ticker: "IRFC", reason: "Finances all rolling stock procurement — interest income grows with capex", impactLevel: "direct" },
      { ticker: "TITAGARH", reason: "Freight wagons and metro coaches — direct order beneficiary", impactLevel: "direct" },
      { ticker: "TEXRAIL", reason: "Track components and railway fasteners — direct capex beneficiary", impactLevel: "direct" },
      { ticker: "IRCON", reason: "Railway construction and international projects", impactLevel: "direct" },
      { ticker: "RAILTEL", reason: "Railway telecom and IT infrastructure", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "KECL", reason: "Overhead electrification — every rail electrification project needs KEC's systems", impactLevel: "indirect" },
      { ticker: "KALPATPOWR", reason: "EPC for railway electrification and power infrastructure", impactLevel: "indirect" },
      { ticker: "ELECON", reason: "Gearboxes for locos and industrial equipment for railways", impactLevel: "indirect" },
      { ticker: "JSWINFRA", reason: "Logistics infrastructure benefits from improved freight rail connectivity", impactLevel: "indirect" },
      { ticker: "CONCOR", reason: "Container logistics — better rail network = more CONCOR volume", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "NHAI", reason: "Rail spending sometimes comes at cost of highway budget allocation", impactLevel: "avoid" },
    ],
    historicalNote: "Railway capex went from ₹1.6L Cr (FY22) to ₹2.5L Cr (FY25). RVNL 6x, IRFC 4x in 3 years.",
    magnitude: "High",
    timeframe: "Medium to long term (1-3 years for order book to execute)",
  },
  {
    id: "solar_renewable",
    category: "Sector",
    trigger: "Solar/Renewable energy targets raised, PLI for solar announced",
    icon: Sun,
    color: "text-yellow-500",
    headline: "Renewable Energy Push",
    description: "India's 500GW renewable target by 2030 requires ₹20L Cr+ investment. Government PLI schemes and state-level auctions create massive order pipelines for the entire solar-wind value chain.",
    directBeneficiaries: [
      { ticker: "SUZLON", reason: "Wind turbine manufacturer — direct beneficiary of wind capacity additions", impactLevel: "direct" },
      { ticker: "INOXWIND", reason: "Wind energy EPC — order book directly tied to wind auction outcomes", impactLevel: "direct" },
      { ticker: "WAAREE", reason: "India's largest solar panel manufacturer — PLI beneficiary, massive export opportunity", impactLevel: "direct" },
      { ticker: "PREMIER", reason: "Solar EPC and module manufacturing", impactLevel: "direct" },
      { ticker: "ADANIGREEN", reason: "Largest renewable energy developer — capacity addition accelerates", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "POLYCAB", reason: "Cables and wires — every solar/wind installation needs POLYCAB cables", impactLevel: "indirect" },
      { ticker: "KEI", reason: "Power cables — renewable energy infra requires massive cable deployment", impactLevel: "indirect" },
      { ticker: "APLAPOLLO", reason: "Structural steel for solar mounting — structural steel demand surge", impactLevel: "indirect" },
      { ticker: "NTPC", reason: "NTPC Renewable subsidiary adding capacity aggressively", impactLevel: "indirect" },
      { ticker: "POWERGRID", reason: "Evacuation infrastructure — renewable power needs transmission upgrades", impactLevel: "indirect" },
      { ticker: "CLEAN", reason: "Clean energy solutions — rooftop solar beneficiary", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "COALINDIA", reason: "Renewable growth directly displaces coal-based generation over time", impactLevel: "avoid" },
      { ticker: "NTPC", reason: "Thermal division faces stranded asset risk long-term (though renewable arm is positive)", impactLevel: "avoid" },
    ],
    historicalNote: "Solar PLI announcement 2022: Waaree 8x in 18 months. Polycab and KEI both doubled. Suzlon 5x.",
    magnitude: "High",
    timeframe: "Long term (2-5 years) but stock moves happen on announcements",
  },
  {
    id: "semiconductor_chips",
    category: "Sector",
    trigger: "India semiconductor fab / chip design push — new fab announcement",
    icon: Cpu,
    color: "text-violet-500",
    headline: "Semiconductor Push",
    description: "India's ₹76,000 Cr semiconductor PLI scheme is creating a domestic chip ecosystem. Micron, Tata, and CG Power have announced fabs. This creates a supply chain opportunity for Indian component manufacturers.",
    directBeneficiaries: [
      { ticker: "CGPOWER", reason: "Joint venture with Renesas for semiconductor OSAT facility in Sanand — direct fab play", impactLevel: "direct" },
      { ticker: "KAYNES", reason: "EMS for semiconductor packaging and testing — major order pipeline from fabs", impactLevel: "direct" },
      { ticker: "SYRMA", reason: "PCB manufacturing and electronics — semiconductor supply chain beneficiary", impactLevel: "direct" },
      { ticker: "VEDL", reason: "Foxconn JV for semiconductor fab in Gujarat — Vedanta's chip ambition", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "DIXON", reason: "Electronics manufacturing — domestic chip availability reduces import dependence", impactLevel: "indirect" },
      { ticker: "AMBER", reason: "AC and electronics EMS — domestic components reduce BOM cost over time", impactLevel: "indirect" },
      { ticker: "ELCOMPONTS", reason: "Electronic components distribution — semiconductor ecosystem growth", impactLevel: "indirect" },
      { ticker: "ASTRA", reason: "Defence electronics — domestic chip supply chain reduces import risk", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "INFOSYS", reason: "IT services companies don't directly benefit from hardware semiconductor push", impactLevel: "avoid" },
    ],
    historicalNote: "CG Power surged 3x in 6 months after Renesas JV announcement. Kaynes 4x in 18 months on semiconductor EMS news.",
    magnitude: "High",
    timeframe: "Long term (3-7 years) — fabs take years to build but stocks move on milestones",
  },
  {
    id: "rate_cut_rbi",
    category: "Macro",
    trigger: "RBI cuts interest rates / signals rate cutting cycle",
    icon: TrendingDown,
    color: "text-emerald-500",
    headline: "RBI Rate Cut",
    description: "Rate cuts reduce cost of capital, boost real estate demand (lower EMIs), benefit NBFCs and housing finance, and re-rate high-PE growth stocks as discount rate falls.",
    directBeneficiaries: [
      { ticker: "LICHSGFIN", reason: "Housing finance — NIM expansion as deposits reprice faster than loan book", impactLevel: "direct" },
      { ticker: "AAVAS", reason: "Affordable housing finance — lower rates expand addressable market", impactLevel: "direct" },
      { ticker: "PNBHOUSING", reason: "HFC — cost of funds falls, loan book growth accelerates", impactLevel: "direct" },
      { ticker: "CANFINHOME", reason: "Conservative HFC — direct beneficiary of falling rates", impactLevel: "direct" },
      { ticker: "BAJFINANCE", reason: "NBFC — lower cost of borrowing directly improves spread and NIM", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "DLF", reason: "Real estate — lower EMIs drive housing demand, especially premium segment", impactLevel: "indirect" },
      { ticker: "GODREJPROP", reason: "Premium residential real estate — volume uptick on lower mortgage rates", impactLevel: "indirect" },
      { ticker: "OBEROIRLTY", reason: "Luxury real estate — interest rate-sensitive buyer segment re-enters market", impactLevel: "indirect" },
      { ticker: "TATAMOTORS", reason: "Vehicle financing becomes cheaper — CV and PV volume boost", impactLevel: "indirect" },
      { ticker: "MARUTI", reason: "Car loan EMIs fall — entry-level and mid-segment demand improves", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "HDFCBANK", reason: "NIM compression near term as loan book reprices — though long-term neutral", impactLevel: "avoid" },
      { ticker: "SBIN", reason: "PSU banks face NIM pressure in early rate cut cycles", impactLevel: "avoid" },
    ],
    historicalNote: "2019 rate cut cycle: Housing finance stocks up 40-60% in 6 months. DLF and Godrej Properties doubled.",
    magnitude: "High",
    timeframe: "Immediate to medium term (weeks to 6 months)",
  },
  {
    id: "china_plus_one",
    category: "Global",
    trigger: "US/Europe accelerates China+1 sourcing — new tariffs on China",
    icon: Globe,
    color: "text-blue-400",
    headline: "China+1 Acceleration",
    description: "Every time US-China trade tension escalates or supply chain diversification accelerates, Indian manufacturers in chemicals, textiles, electronics, pharma APIs benefit from order migration.",
    directBeneficiaries: [
      { ticker: "AARTIIND", reason: "Benzene-based specialty chemicals — direct China substitute for European buyers", impactLevel: "direct" },
      { ticker: "DEEPAKNTR", reason: "Phenol and acetone chemistry — filling Chinese supply gap in global markets", impactLevel: "direct" },
      { ticker: "LALPATHLAB", reason: "API pharma ingredients — China+1 in pharma APIs benefits Indian manufacturers", impactLevel: "direct" },
      { ticker: "DIXON", reason: "Electronics EMS — Apple and Samsung shifting from China to India", impactLevel: "direct" },
      { ticker: "KAYNES", reason: "EMS manufacturing — direct beneficiary of electronics supply chain shift", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "AMBER", reason: "AC components EMS — supply chain diversification from China", impactLevel: "indirect" },
      { ticker: "SYRMA", reason: "PCB and electronics — China+1 supply chain builds Indian capacity", impactLevel: "indirect" },
      { ticker: "GUJALKALI", reason: "Chlor-alkali chemicals — filling Chinese chemical export gaps", impactLevel: "indirect" },
      { ticker: "NAVINFLUOR", reason: "Fluorochemicals — China was dominant, India filling gap", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "TATACONSUM", reason: "Relies on global supply chains that benefit from China stability", impactLevel: "avoid" },
    ],
    historicalNote: "2018 US-China tariffs: Dixon 10x in 4 years. Aarti Industries 4x. Indian specialty chemicals sector re-rated significantly.",
    magnitude: "High",
    timeframe: "Medium to long term (1-3 years for order books to shift)",
  },
  {
    id: "infra_budget",
    category: "Policy",
    trigger: "Union Budget announces large infrastructure capex boost",
    icon: Building2,
    color: "text-orange-500",
    headline: "Infrastructure Capex Boost",
    description: "Government infrastructure spending is the most powerful domestic demand driver. Roads, ports, airports, water, housing — each announcement creates visible multi-year order books.",
    directBeneficiaries: [
      { ticker: "LARSEN", reason: "Largest EPC player — infrastructure capex directly fills L&T's order book", impactLevel: "direct" },
      { ticker: "KNR", reason: "Road construction specialist — NH and state highway capex beneficiary", impactLevel: "direct" },
      { ticker: "HGINFRA", reason: "Road and water EPC — direct order beneficiary", impactLevel: "direct" },
      { ticker: "GPIL", reason: "Sponge iron and steel — infrastructure steel demand surge", impactLevel: "direct" },
      { ticker: "MANINFRA", reason: "Urban infrastructure — metro, roads, water projects", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "ULTRACEMCO", reason: "Cement demand driven by infrastructure construction boom", impactLevel: "indirect" },
      { ticker: "SHREECEM", reason: "Same cement demand dynamics — infrastructure is 40% of cement demand", impactLevel: "indirect" },
      { ticker: "JKCEMENT", reason: "Regional cement player — state infrastructure projects boost volume", impactLevel: "indirect" },
      { ticker: "JSWSTEEL", reason: "Steel for bridges, roads, railways — infrastructure steel demand", impactLevel: "indirect" },
      { ticker: "POLYCAB", reason: "Cables for infrastructure electrification — smart cities, highways", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "HDFCBANK", reason: "No direct benefit — infrastructure capex doesn't boost retail bank earnings", impactLevel: "avoid" },
    ],
    historicalNote: "FY24 capex ₹10L Cr: L&T order book hit ATH. KNR, HG Infra doubled. Cement stocks up 40%.",
    magnitude: "High",
    timeframe: "Immediate (announcement effect) + medium term (execution)",
  },
  {
    id: "inr_depreciation",
    category: "Macro",
    trigger: "INR depreciates significantly against USD (₹85+ per dollar)",
    icon: TrendingDown,
    color: "text-amber-500",
    headline: "INR Weakens vs USD",
    description: "INR depreciation is a double-edged sword. Exporters gain as dollar revenues translate to more rupees. Importers and forex borrowers lose. Net effect depends on the business model.",
    directBeneficiaries: [
      { ticker: "TCS", reason: "90%+ revenue in USD — every 1% INR fall = ~0.7% EPS boost, no hedging lag", impactLevel: "direct" },
      { ticker: "INFY", reason: "Similar USD revenue exposure — direct INR translation benefit", impactLevel: "direct" },
      { ticker: "HCLTECH", reason: "IT services — major USD earner", impactLevel: "direct" },
      { ticker: "SUNPHARMA", reason: "US generics = 30%+ revenue — INR fall directly boosts revenue in ₹ terms", impactLevel: "direct" },
      { ticker: "DRREDDY", reason: "US/Europe pharma exports — INR weakness boosts reported margins", impactLevel: "direct" },
      { ticker: "SHARDACROP", reason: "Agrochemical exporter — INR fall = direct margin expansion on global sales", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "TATAELXSI", reason: "Tech services — USD revenue base benefits from INR weakness", impactLevel: "indirect" },
      { ticker: "PERSISTENT", reason: "IT services — dollar revenue exposure gives INR depreciation tailwind", impactLevel: "indirect" },
      { ticker: "NAVINFLUOR", reason: "Fluorochemicals export — global pricing + INR benefit", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "INDIGO", reason: "Lease payments and ATF partially in USD — INR fall increases cost base", impactLevel: "avoid" },
      { ticker: "ASIANPAINT", reason: "Imported RM — TiO2 mostly imported, INR fall raises costs", impactLevel: "avoid" },
      { ticker: "TATASTEEL", reason: "Forex debt — INR depreciation raises debt servicing cost", impactLevel: "avoid" },
    ],
    historicalNote: "2022 INR fell from ₹75 to ₹83: TCS, Infy, HCL outperformed Nifty by 15-20%. IndiGo fell 25%.",
    magnitude: "Medium",
    timeframe: "Immediate (within days of currency move)",
  },
  {
    id: "fmcg_rural",
    category: "Sector",
    trigger: "Good monsoon / rural income boost / MSP hike",
    icon: TrendingUp,
    color: "text-green-500",
    headline: "Rural Demand Recovery",
    description: "70% of India lives in rural areas. A good monsoon, high MSP for crops, or government rural spending directly boosts rural incomes and drives FMCG, two-wheeler, and agri-input demand.",
    directBeneficiaries: [
      { ticker: "HINDUNILVR", reason: "50%+ revenue from rural markets — rural recovery is direct volume catalyst", impactLevel: "direct" },
      { ticker: "DABUR", reason: "Highest rural exposure among large FMCG — healthcare and naturals index to rural", impactLevel: "direct" },
      { ticker: "BAJAJ-AUTO", reason: "Motorcycle sales predominantly rural — 60%+ volume from small towns and villages", impactLevel: "direct" },
      { ticker: "HEROMOTOCO", reason: "Splendor and HF Deluxe — mass market bikes, highest rural exposure in 2W", impactLevel: "direct" },
      { ticker: "MARICO", reason: "Parachute coconut oil and rural FMCG — strong rural distribution", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "ESCORTS", reason: "Tractors — rural income directly drives tractor demand", impactLevel: "indirect" },
      { ticker: "MAHINDRA", reason: "Tractors and Bolero — rural mobility and agri segment", impactLevel: "indirect" },
      { ticker: "PIIND", reason: "Pesticides — good monsoon = more crop sowing = more pesticide demand", impactLevel: "indirect" },
      { ticker: "SHARDACROP", reason: "Agrochemicals — crop protection demand rises with rural activity", impactLevel: "indirect" },
      { ticker: "TATACHEM", reason: "Urea and agri inputs — rural farm income drives fertiliser demand", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "DMART", reason: "Urban-skewed retail format — rural recovery doesn't directly boost D-Mart volumes", impactLevel: "avoid" },
    ],
    historicalNote: "Good monsoon 2020: HUL, Dabur, Hero MotoCorp all beat Nifty by 15-25% in next 2 quarters.",
    magnitude: "Medium",
    timeframe: "Medium term (2-4 quarters post monsoon data)",
  },
  {
    id: "us_recession",
    category: "Global",
    trigger: "US recession fears / US GDP growth slows sharply",
    icon: Globe,
    color: "text-red-400",
    headline: "US Recession Risk",
    description: "US slowdown hits Indian IT exports hardest (BFSI and retail discretionary spending cut), but creates opportunities in defensives and domestic-facing sectors.",
    directBeneficiaries: [
      { ticker: "ITC", reason: "Domestic defensive — cigarettes and FMCG not correlated to US slowdown", impactLevel: "direct" },
      { ticker: "HINDUNILVR", reason: "Pure domestic consumption — immune to US recession", impactLevel: "direct" },
      { ticker: "NESTLEIND", reason: "Domestic food — recession-proof in India", impactLevel: "direct" },
      { ticker: "NTPC", reason: "Regulated utility — earnings completely insulated from global slowdown", impactLevel: "direct" },
    ],
    indirectBeneficiaries: [
      { ticker: "COALINDIA", reason: "Domestic energy — power demand continues regardless of US slowdown", impactLevel: "indirect" },
      { ticker: "POWERGRID", reason: "Regulated transmission — zero exposure to global macro", impactLevel: "indirect" },
    ],
    avoid: [
      { ticker: "TCS", reason: "US BFSI is 30%+ of TCS revenue — US recession = discretionary IT spend cut first", impactLevel: "avoid" },
      { ticker: "INFY", reason: "Same US exposure — guidance cuts likely in US recession environment", impactLevel: "avoid" },
      { ticker: "WIPRO", reason: "US and Europe revenue = 80%+ — cyclical IT spend most vulnerable", impactLevel: "avoid" },
      { ticker: "TATAMOTORS", reason: "Jaguar Land Rover sales crash in US/Europe recession", impactLevel: "avoid" },
    ],
    historicalNote: "2023 US slowdown fears: TCS, Infy underperformed Nifty by 20%+ for 12 months. ITC, HUL outperformed.",
    magnitude: "High",
    timeframe: "Medium term (2-4 quarters to reflect in earnings)",
  },
];

// ─── Gemini deep-dive ─────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

type GeminiPart = { text?: string; thought?: boolean };
function extractText(data: unknown): string {
  const parts = (data as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> })
    ?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string).join("");
}

async function geminiThemeDeepDive(apiKey: string, theme: Theme): Promise<string> {
  const prompt = `A macro/sector event is playing out in Indian markets: "${theme.trigger}"

Use Google Search to find the current state of this theme as of today. Then answer:

1. **Is this theme currently active?** — Is crude actually at these levels? Has this policy been announced? Use real data.
2. **Latest developments** — What happened most recently related to this theme?
3. **Which specific stocks are moving RIGHT NOW because of this?** — Search for recent price action and analyst commentary.
4. **Best entry point** — For the top 2-3 beneficiary stocks, what is the current setup? Are they already priced in or still opportunity?
5. **What could go wrong?** — Specific risks that could reverse this theme.
6. **Timeline** — How long does this theme typically last? Historical precedent?

Be specific with current prices, recent news, and analyst targets. All ₹ in Crores.`;

  const res = await fetch(GEMINI_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return extractText(data);
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: Theme;
  apiKey: string;
  onAnalyse: (ticker: string) => void;
}

function ThemeCard({ theme, apiKey, onAnalyse }: ThemeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deepDive, setDeepDive] = useState<string | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const Icon = theme.icon;

  const handleDeepDive = async () => {
    if (!apiKey) { toast.error("Add Gemini API key in Research tab first"); return; }

    // 1. Check Supabase cache
    const hasSB = !!getSupabaseConfig();
    if (hasSB) {
      const cached = await getThemeDeepDive(theme.id);
      if (cached && !isStale(cached.updated_at)) {
        setDeepDive(cached.analysis + `\n\n*📦 Cached ${ageLabel(cached.updated_at)} — click "Refresh" to get today's data*`);
        return;
      }
    }

    setDeepDiveLoading(true);
    try {
      const result = await geminiThemeDeepDive(apiKey, theme);

      // 2. Store in Supabase
      if (hasSB) await saveThemeDeepDive(theme.id, result);

      setDeepDive(result);
    } catch {
      toast.error("Deep dive failed — check your API key");
    } finally {
      setDeepDiveLoading(false);
    }
  };

  const impactBadge = {
    High: "bg-red-500/15 text-red-600 dark:text-red-400",
    Medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Low: "bg-muted text-muted-foreground",
  }[theme.magnitude];

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors">
      {/* Header */}
      <button
        className="w-full p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn("mt-0.5 shrink-0 rounded-lg p-2 bg-muted/60")}>
              <Icon className={cn("h-4 w-4", theme.color)} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">{theme.headline}</span>
                <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{theme.category}</span>
                <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5", impactBadge)}>
                  {theme.magnitude} Impact
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{theme.trigger}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">
              {theme.directBeneficiaries.length + theme.indirectBeneficiaries.length} stocks
            </span>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed pt-3">{theme.description}</p>

          {/* Timeframe */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">⏱ Timeline:</span>
            <span className="text-foreground font-medium">{theme.timeframe}</span>
          </div>

          {/* Three columns: Direct | Indirect | Avoid */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Direct beneficiaries */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Direct Beneficiaries</span>
              </div>
              {theme.directBeneficiaries.map((s) => (
                <div key={s.ticker} className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{s.ticker}</span>
                    <button onClick={() => onAnalyse(s.ticker)}
                      className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                      Report <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{s.reason}</p>
                </div>
              ))}
            </div>

            {/* Indirect beneficiaries */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Indirect / 2nd Order</span>
              </div>
              {theme.indirectBeneficiaries.map((s) => (
                <div key={s.ticker} className="rounded-lg bg-blue-500/5 border border-blue-500/15 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{s.ticker}</span>
                    <button onClick={() => onAnalyse(s.ticker)}
                      className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                      Report <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{s.reason}</p>
                </div>
              ))}
            </div>

            {/* Avoid */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Avoid / Hurt By This</span>
              </div>
              {theme.avoid.map((s) => (
                <div key={s.ticker} className="rounded-lg bg-red-500/5 border border-red-500/15 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-red-600 dark:text-red-400">{s.ticker}</span>
                    <button onClick={() => onAnalyse(s.ticker)}
                      className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                      Report <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{s.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Historical note */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Historical precedent:</strong> {theme.historicalNote}
            </p>
          </div>

          {/* Gemini deep dive */}
          <div className="pt-1">
            {!deepDive && !deepDiveLoading && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 w-full"
                onClick={handleDeepDive} disabled={!apiKey}>
                <Sparkles className="h-3.5 w-3.5" />
                {apiKey ? "Live Deep Dive — Is this theme active right now?" : "Add Gemini API key to get live analysis"}
              </Button>
            )}

            {deepDiveLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/40 rounded-lg animate-pulse">
                <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Searching live data for current state of this theme...
              </div>
            )}

            {deepDive && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Live Analysis
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setDeepDive(null); setTimeout(handleDeepDive, 50); }}
                      className="text-[10px] text-primary hover:underline transition-colors">
                      Refresh
                    </button>
                    <button onClick={() => setDeepDive(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs text-muted-foreground leading-relaxed space-y-1.5">
                  {deepDive.split("\n").filter((l) => l.trim()).map((line, i) => (
                    <p key={i} dangerouslySetInnerHTML={{
                      __html: line.replace(/\*\*(.+?)\*\*/g, "<strong class='text-foreground'>$1</strong>")
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Live AI Theme Generator ──────────────────────────────────────────────────

interface LiveTheme {
  headline: string;
  category: string;
  trigger: string;
  magnitude: "High" | "Medium" | "Low";
  directBeneficiaries: { ticker: string; reason: string }[];
  indirectBeneficiaries: { ticker: string; reason: string }[];
  avoid: { ticker: string; reason: string }[];
  historicalNote: string;
  timeframe: string;
}

async function generateLiveThemes(apiKey: string): Promise<LiveTheme[]> {
  const prompt = `Today is ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. 
  
Use Google Search to find the TOP 4 macro/sector events currently happening in Indian markets RIGHT NOW that will have the biggest stock impact in the next 1-6 months. Look for: RBI decisions, government policy announcements, global commodity moves, FII flows, sector-specific news, budget updates, PLI scheme launches, geopolitical triggers.

For each event, identify which NSE-listed Indian stocks benefit directly, benefit indirectly, and should be avoided.

Return ONLY a valid JSON array (no markdown, no backticks):
[
  {
    "headline": "Short title",
    "category": "Macro|Policy|Sector|Global",
    "trigger": "Specific event description with data/numbers",
    "magnitude": "High|Medium|Low",
    "timeframe": "Immediate (days)|Medium term (3-6 months)|Long term (1-2Y)",
    "directBeneficiaries": [
      {"ticker": "NSE_TICKER", "reason": "Specific reason why this stock benefits with data"}
    ],
    "indirectBeneficiaries": [
      {"ticker": "NSE_TICKER", "reason": "Second-order benefit reason"}
    ],
    "avoid": [
      {"ticker": "NSE_TICKER", "reason": "Why this stock gets hurt"}
    ],
    "historicalNote": "Historical precedent from Indian markets"
  }
]

Rules:
- Each event must be ACTUALLY HAPPENING today — not hypothetical
- Give 3-4 direct beneficiaries, 3-4 indirect, 2-3 to avoid per theme
- All tickers must be valid NSE tickers
- Use real current data (crude price, RBI rate, etc.)`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 3000, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> })
    ?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string).join("");
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = clean.indexOf("["); const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array in response");
  return JSON.parse(clean.slice(start, end + 1)) as LiveTheme[];
}

// ─── Live Theme Card ───────────────────────────────────────────────────────────

function LiveThemeCard({ theme, onAnalyse }: { theme: LiveTheme; onAnalyse: (ticker: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const impactBadge = {
    High: "bg-red-500/15 text-red-600 dark:text-red-400",
    Medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Low: "bg-muted text-muted-foreground",
  }[theme.magnitude];

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors border-primary/20">
      <button className="w-full p-4 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0 rounded-lg p-2 bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">{theme.headline}</span>
                <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{theme.category}</span>
                <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5", impactBadge)}>{theme.magnitude} Impact</span>
                <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">🔴 LIVE</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{theme.trigger}</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs pt-3">
            <span className="text-muted-foreground">⏱ Timeline:</span>
            <span className="text-foreground font-medium">{theme.timeframe}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Direct Beneficiaries</span>
              </div>
              {theme.directBeneficiaries.map((s) => (
                <div key={s.ticker} className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{s.ticker}</span>
                    <button onClick={() => onAnalyse(s.ticker)} className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                      Report <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{s.reason}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Indirect / 2nd Order</span>
              </div>
              {theme.indirectBeneficiaries.map((s) => (
                <div key={s.ticker} className="rounded-lg bg-blue-500/5 border border-blue-500/15 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{s.ticker}</span>
                    <button onClick={() => onAnalyse(s.ticker)} className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                      Report <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{s.reason}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Avoid / Hurt By This</span>
              </div>
              {theme.avoid.map((s) => (
                <div key={s.ticker} className="rounded-lg bg-red-500/5 border border-red-500/15 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-red-600 dark:text-red-400">{s.ticker}</span>
                    <button onClick={() => onAnalyse(s.ticker)} className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                      Report <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{s.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {theme.historicalNote && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Historical precedent:</strong> {theme.historicalNote}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main ThemeEngine component ───────────────────────────────────────────────

type CategoryFilter = "All" | "Live AI" | "Macro" | "Sector" | "Policy" | "Global";

interface ThemeEngineProps {
  apiKey: string;
  onNavigateToResearch: (ticker: string) => void;
}

export function ThemeEngine({ apiKey, onNavigateToResearch }: ThemeEngineProps) {
  const [filter, setFilter] = useState<CategoryFilter>("All");
  const [search, setSearch] = useState("");

  // Live AI themes state
  const [liveThemes, setLiveThemes] = useState<LiveTheme[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveTime, setLiveTime] = useState<string | null>(null);

  const handleGenerateLiveThemes = async (force = false) => {
    if (!apiKey) { toast.error("Add Gemini API key to generate live themes"); return; }
    if (!force && liveThemes.length > 0) { setFilter("Live AI"); return; }
    setLiveLoading(true);
    setFilter("Live AI");
    try {
      const themes = await generateLiveThemes(apiKey);
      setLiveThemes(themes);
      setLiveTime(new Date().toLocaleTimeString("en-IN"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate live themes");
    } finally {
      setLiveLoading(false);
    }
  };

  const filtered = THEMES.filter((t) => {
    if (filter === "Live AI") return false;
    const matchCat = filter === "All" || t.category === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.headline.toLowerCase().includes(q) ||
      t.trigger.toLowerCase().includes(q) ||
      t.directBeneficiaries.some((s) => s.ticker.toLowerCase().includes(q)) ||
      t.indirectBeneficiaries.some((s) => s.ticker.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const categories: CategoryFilter[] = ["All", "Live AI", "Macro", "Policy", "Sector", "Global"];

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Theme Impact Engine</h2>
        </div>
        <Badge variant="outline" className="text-[10px]">{THEMES.length} curated + AI live</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        If a macro event or sector trigger fires — see exactly who benefits (direct & 2nd order) and who gets hurt. Use <strong className="text-foreground">Live AI Themes</strong> to get Gemini-generated themes based on what's actually happening in markets today.
      </p>

      {/* Filters + Live button */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {categories.map((cat) => (
            <button key={cat}
              onClick={() => cat === "Live AI" ? handleGenerateLiveThemes() : setFilter(cat)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-all",
                filter === cat
                  ? cat === "Live AI"
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-primary bg-primary/10 text-primary"
                  : cat === "Live AI"
                    ? "border-primary/40 text-primary hover:bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30")}>
              {cat === "Live AI" ? (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Live AI Themes
                </span>
              ) : cat}
            </button>
          ))}
        </div>
        {filter !== "Live AI" && (
          <input
            placeholder="Search theme or ticker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[140px] rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
          />
        )}
      </div>

      {/* Live AI Themes section */}
      {filter === "Live AI" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-foreground">
                AI-generated themes based on today's market events
              </span>
            </div>
            <div className="flex items-center gap-2">
              {liveTime && <span className="text-[10px] text-muted-foreground">{liveTime}</span>}
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                onClick={() => handleGenerateLiveThemes(true)} disabled={liveLoading || !apiKey}>
                <RefreshCw className={cn("h-3 w-3", liveLoading && "animate-spin")} />
                {liveLoading ? "Searching markets..." : "Refresh"}
              </Button>
            </div>
          </div>

          {!apiKey && (
            <Card className="p-4 border-dashed text-center space-y-1">
              <p className="text-sm text-muted-foreground">Add Gemini API key in Research tab to generate live themes</p>
            </Card>
          )}

          {liveLoading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Gemini is searching today's market news to identify active themes...
              </div>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 animate-pulse space-y-2">
                  <div className="h-4 w-48 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                </Card>
              ))}
            </div>
          )}

          {!liveLoading && liveThemes.length > 0 && (
            <div className="space-y-2">
              {liveThemes.map((t, i) => (
                <LiveThemeCard key={i} theme={t} onAnalyse={onNavigateToResearch} />
              ))}
              <p className="text-[10px] text-muted-foreground/60">
                Gemini-generated using live Google Search · Refresh to get the latest · {liveTime}
              </p>
            </div>
          )}

          {!liveLoading && liveThemes.length === 0 && apiKey && (
            <div className="rounded-2xl border border-dashed border-primary/30 p-10 text-center space-y-3">
              <Zap className="h-8 w-8 text-primary/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Generate AI themes based on today's market events</p>
              <Button size="sm" onClick={() => handleGenerateLiveThemes(true)} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Generate Live Themes
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Static theme cards */}
      {filter !== "Live AI" && (
        <div className="space-y-2">
          {filtered.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              apiKey={apiKey}
              onAnalyse={onNavigateToResearch}
            />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No themes match "{search}"</p>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/50">
        Static themes based on historical Indian market behavior. Live AI themes use Gemini + Google Search for today's market events. Deep dives cached in Supabase for 7 days. Not investment advice. Always verify before acting.
      </p>
    </section>
  );
}
