import { useContext } from "react";
import { FinanceContext } from "@/context/FinanceContext";
import type { FinanceContextValue } from "@/types/finance.types";

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error("useFinance must be used inside <FinanceProvider>");
  }
  return ctx;
}

// Alias for backward compatibility
export const useFinanceState = useFinance;
