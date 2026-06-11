/**
 * Supabase caching service — 7-day TTL for all AI-generated data.
 *
 * Tables (run this SQL in your Supabase SQL editor to set up):
 * ─────────────────────────────────────────────────────────────
 *
 * create table if not exists stock_research (
 *   ticker       text primary key,
 *   query        text not null,
 *   report       text not null,
 *   updated_at   timestamptz not null default now()
 * );
 *
 * create table if not exists stock_thesis (
 *   ticker       text primary key,
 *   category     text not null,
 *   thesis       text not null,
 *   updated_at   timestamptz not null default now()
 * );
 *
 * create table if not exists smart_money_cache (
 *   tab_type     text primary key,
 *   entries_json text not null,
 *   updated_at   timestamptz not null default now()
 * );
 *
 * create table if not exists theme_deepdives (
 *   theme_id     text primary key,
 *   analysis     text not null,
 *   updated_at   timestamptz not null default now()
 * );
 *
 * -- Enable RLS but allow anon reads/writes (use anon key only)
 * alter table stock_research    enable row level security;
 * alter table stock_thesis      enable row level security;
 * alter table smart_money_cache enable row level security;
 * alter table theme_deepdives   enable row level security;
 *
 * create policy "anon all" on stock_research    for all using (true) with check (true);
 * create policy "anon all" on stock_thesis      for all using (true) with check (true);
 * create policy "anon all" on smart_money_cache for all using (true) with check (true);
 * create policy "anon all" on theme_deepdives   for all using (true) with check (true);
 * ─────────────────────────────────────────────────────────────
 */

const LS_SB_URL = "supabase_url";
const LS_SB_KEY = "supabase_anon_key";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface SupabaseConfig { url: string; anonKey: string; }

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = localStorage.getItem(LS_SB_URL)?.trim();
  const anonKey = localStorage.getItem(LS_SB_KEY)?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(LS_SB_URL, url.trim());
  localStorage.setItem(LS_SB_KEY, anonKey.trim());
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(LS_SB_URL);
  localStorage.removeItem(LS_SB_KEY);
}

export function isStale(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() > SEVEN_DAYS_MS;
}

export function ageLabel(updatedAt: string): string {
  const ms = Date.now() - new Date(updatedAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function sbFetch(
  config: SupabaseConfig,
  path: string,
  opts: RequestInit = {}
): Promise<Response> {
  return fetch(`${config.url}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers ?? {}),
    },
  });
}

// ─── Generic GET (returns first match or null) ────────────────────────────────

export async function dbGet<T extends Record<string, unknown>>(
  table: string,
  match: Record<string, string>
): Promise<T | null> {
  const config = getSupabaseConfig();
  if (!config) return null;
  try {
    const qs = new URLSearchParams({ ...match, select: "*", limit: "1" });
    const res = await sbFetch(config, `/${table}?${qs.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as T[];
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

// ─── Generic UPSERT ───────────────────────────────────────────────────────────

export async function dbUpsert(
  table: string,
  data: Record<string, unknown>
): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;
  try {
    const res = await sbFetch(config, `/${table}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
    });
    return res.ok || res.status === 201 || res.status === 204;
  } catch {
    return false;
  }
}

// ─── Stock research helpers ───────────────────────────────────────────────────

export interface CachedResearch {
  ticker: string;
  query: string;
  report: string;
  updated_at: string;
}

export async function getResearch(ticker: string): Promise<CachedResearch | null> {
  return dbGet<CachedResearch>("stock_research", { ticker: ticker.toUpperCase() });
}

export async function saveResearch(ticker: string, query: string, report: string): Promise<void> {
  await dbUpsert("stock_research", { ticker: ticker.toUpperCase(), query, report });
}

// ─── Stock thesis helpers ─────────────────────────────────────────────────────

export interface CachedThesis {
  ticker: string;
  category: string;
  thesis: string;
  updated_at: string;
}

export async function getThesis(ticker: string): Promise<CachedThesis | null> {
  return dbGet<CachedThesis>("stock_thesis", { ticker: ticker.toUpperCase() });
}

export async function saveThesis(ticker: string, category: string, thesis: string): Promise<void> {
  await dbUpsert("stock_thesis", { ticker: ticker.toUpperCase(), category, thesis });
}

// ─── Smart money cache helpers ────────────────────────────────────────────────

export interface CachedSmartMoney {
  tab_type: string;
  entries_json: string;
  updated_at: string;
}

export async function getSmartMoney(tabType: string): Promise<CachedSmartMoney | null> {
  return dbGet<CachedSmartMoney>("smart_money_cache", { tab_type: tabType });
}

export async function saveSmartMoney(tabType: string, entries: unknown[]): Promise<void> {
  await dbUpsert("smart_money_cache", {
    tab_type: tabType,
    entries_json: JSON.stringify(entries),
  });
}

// ─── Theme deep-dive helpers ──────────────────────────────────────────────────

export interface CachedThemeDeepDive {
  theme_id: string;
  analysis: string;
  updated_at: string;
}

export async function getThemeDeepDive(themeId: string): Promise<CachedThemeDeepDive | null> {
  return dbGet<CachedThemeDeepDive>("theme_deepdives", { theme_id: themeId });
}

export async function saveThemeDeepDive(themeId: string, analysis: string): Promise<void> {
  await dbUpsert("theme_deepdives", { theme_id: themeId, analysis });
}
