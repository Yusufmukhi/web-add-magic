import { useCallback, useEffect, useState } from "react";

const KEY = "watchlist";
const DEFAULT: string[] = ["TCS", "RELIANCE", "INFY", "HDFCBANK"];

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setTickers(parsed.length ? parsed : DEFAULT);
    } catch {
      setTickers(DEFAULT);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(tickers));
  }, [tickers, hydrated]);

  const add = useCallback((t: string) => {
    const up = t.trim().toUpperCase();
    if (!up) return false;
    let added = false;
    setTickers((prev) => {
      if (prev.includes(up)) return prev;
      added = true;
      return [...prev, up];
    });
    return added;
  }, []);

  const remove = useCallback((t: string) => {
    setTickers((prev) => prev.filter((x) => x !== t));
  }, []);

  return { tickers, add, remove, hydrated };
}
