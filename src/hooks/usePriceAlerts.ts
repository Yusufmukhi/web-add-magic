import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export interface PriceAlert {
  id: string;
  ticker: string;
  target: number;
  direction: "above" | "below";
  triggered: boolean;
  createdAt: string;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function usePriceAlerts() {
  const [alerts, setAlerts, hydrated] = useLocalStorage<PriceAlert[]>("price_alerts", []);

  const add = useCallback(
    (ticker: string, target: number, direction: "above" | "below") => {
      setAlerts((prev) => [
        ...prev,
        {
          id: newId(),
          ticker: ticker.toUpperCase(),
          target,
          direction,
          triggered: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    [setAlerts]
  );

  const remove = useCallback(
    (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id)),
    [setAlerts]
  );

  const markTriggered = useCallback(
    (id: string) =>
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, triggered: true } : a))),
    [setAlerts]
  );

  const reset = useCallback(
    (id: string) =>
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, triggered: false } : a))),
    [setAlerts]
  );

  return { alerts, add, remove, markTriggered, reset, hydrated };
}
