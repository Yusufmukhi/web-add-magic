import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export type SIPFrequency = "monthly" | "weekly" | "quarterly";

export interface SIP {
  id: string;
  ticker: string;
  amount: number;
  frequency: SIPFrequency;
  startDate: string;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useSIP() {
  const [sips, setSips, hydrated] = useLocalStorage<SIP[]>("sip_list", []);

  const addSIP = useCallback(
    (data: Omit<SIP, "id">) => setSips((prev) => [{ id: newId(), ...data }, ...prev]),
    [setSips]
  );
  const removeSIP = useCallback((id: string) => setSips((prev) => prev.filter((s) => s.id !== id)), [setSips]);

  return { sips, addSIP, removeSIP, hydrated };
}

/** Installments elapsed since startDate based on frequency. */
export function installmentsElapsed(startDate: string, frequency: SIPFrequency): number {
  const start = Date.parse(startDate);
  if (isNaN(start)) return 0;
  const days = Math.floor((Date.now() - start) / 86400000);
  if (days < 0) return 0;
  if (frequency === "weekly") return Math.floor(days / 7) + 1;
  if (frequency === "quarterly") return Math.floor(days / 90) + 1;
  return Math.floor(days / 30) + 1; // monthly
}
