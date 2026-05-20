import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export interface Dividend {
  id: string;
  ticker: string;
  date: string;
  perShare: number;
  shares: number;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useDividends() {
  const [dividends, setDividends, hydrated] = useLocalStorage<Dividend[]>("dividend_list", []);

  const addDividend = useCallback(
    (data: Omit<Dividend, "id">) => setDividends((prev) => [{ id: newId(), ...data }, ...prev]),
    [setDividends]
  );
  const removeDividend = useCallback((id: string) => setDividends((prev) => prev.filter((d) => d.id !== id)), [setDividends]);

  return { dividends, addDividend, removeDividend, hydrated };
}
