import { useCallback } from "react";
import type { Holding, Transaction } from "@/types/portfolio.types";
import { useLocalStorage } from "./useLocalStorage";

const todayStr = () => new Date().toISOString().slice(0, 10);
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function usePortfolioState() {
  const [portfolio, setPortfolio] = useLocalStorage<Holding[]>("portfolio", []);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>(
    "transactions",
    []
  );
  const [cashBalance, setCashBalance] = useLocalStorage<number>("cash_balance", 0);

  const addFunds = useCallback(
    (amount: number) => {
      setCashBalance((c) => c + amount);
      setTransactions((prev) => [
        {
          id: newId(),
          date: todayStr(),
          action: "DEPOSIT",
          amount,
          cashAfter: 0,
          meta: { type: "Fund Deposit" },
        },
        ...prev,
      ]);
    },
    [setCashBalance, setTransactions]
  );

  const withdrawFunds = useCallback(
    (amount: number): boolean => {
      let ok = false;
      setCashBalance((c) => {
        if (amount > c) return c;
        ok = true;
        return c - amount;
      });
      if (ok) {
        setTransactions((prev) => [
          {
            id: newId(),
            date: todayStr(),
            action: "WITHDRAW",
            amount,
            cashAfter: 0,
            meta: { type: "Withdrawal" },
          },
          ...prev,
        ]);
      }
      return ok;
    },
    [setCashBalance, setTransactions]
  );

  const buy = useCallback(
    (ticker: string, price: number, qty: number, buyDate: string): boolean => {
      const total = price * qty;
      if (total > cashBalance) return false;
      setCashBalance((c) => c - total);
      let newAvg = price;
      setPortfolio((prev) => {
        const existing = prev.find((h) => h.ticker === ticker);
        if (existing) {
          const nq = existing.qty + qty;
          const na = (existing.avgPrice * existing.qty + price * qty) / nq;
          newAvg = na;
          return prev.map((h) =>
            h.ticker === ticker
              ? { ...h, qty: nq, avgPrice: na, buyDate: h.buyDate || buyDate }
              : h
          );
        }
        return [...prev, { ticker, qty, avgPrice: price, buyDate }];
      });
      setTransactions((prev) => [
        {
          id: newId(),
          date: buyDate,
          action: "BUY",
          stock: ticker,
          qty,
          price,
          amount: total,
          cashAfter: 0,
          meta: { type: "Market Buy", avgCost: newAvg, buyDate },
        },
        ...prev,
      ]);
      return true;
    },
    [cashBalance, setCashBalance, setPortfolio, setTransactions]
  );

  const sell = useCallback(
    (ticker: string, price: number, qty: number, sellDate: string): boolean => {
      const h = portfolio.find((p) => p.ticker === ticker);
      if (!h || qty > h.qty) return false;
      const total = price * qty;
      const profit = (price - h.avgPrice) * qty;
      const profitPct = h.avgPrice > 0 ? ((price - h.avgPrice) / h.avgPrice) * 100 : 0;
      const buyDateStr = h.buyDate || sellDate;
      const holdingDays = Math.max(
        0,
        Math.floor((Date.parse(sellDate) - Date.parse(buyDateStr)) / 86400000)
      );
      setCashBalance((c) => c + total);
      setPortfolio((prev) =>
        prev
          .map((p) => (p.ticker === ticker ? { ...p, qty: p.qty - qty } : p))
          .filter((p) => p.qty > 0)
      );
      setTransactions((prev) => [
        {
          id: newId(),
          date: sellDate,
          action: "SELL",
          stock: ticker,
          qty,
          price,
          amount: total,
          cashAfter: 0,
          meta: {
            profit,
            profitPct,
            holdingDays,
            type: holdingDays >= 365 ? "LTCG" : "STCG",
            avgCost: h.avgPrice,
            buyDate: buyDateStr,
            sellDate,
          },
        },
        ...prev,
      ]);
      return true;
    },
    [portfolio, setCashBalance, setPortfolio, setTransactions]
  );

  return {
    portfolio,
    transactions,
    cashBalance,
    addFunds,
    withdrawFunds,
    buy,
    sell,
  };
}
