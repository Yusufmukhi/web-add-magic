import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export function useSectorOverrides() {
  const [overrides, setOverrides] = useLocalStorage<Record<string, string>>(
    "sector_overrides",
    {}
  );

  const setSector = useCallback(
    (ticker: string, sector: string) => {
      setOverrides((prev) => {
        const next = { ...prev };
        const clean = sector.trim();
        if (!clean) delete next[ticker];
        else next[ticker] = clean;
        return next;
      });
    },
    [setOverrides]
  );

  const resolve = useCallback(
    (ticker: string, fallback: string): string =>
      overrides[ticker] ?? fallback,
    [overrides]
  );

  return { overrides, setSector, resolve };
}
