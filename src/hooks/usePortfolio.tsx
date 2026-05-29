import { useCallback } from "react";
import type { Holding, Transaction } from "@/types/portfolio.types";
import { useLocalStorage } from "./useLocalStorage";
import { makeLot, fifoSell, recomputeHoldingMeta } from "@/utils/fifo";

const todayStr = () => new Date().toISOString().slice(0, 10);
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Migrate a legacy holding (no lots array) to FIFO format.
 * Creates a single synthetic lot using avgPrice and buyDate.
 */
function migrateLegacyHolding(h: Holding): Holding {
  if (h.lots && h.lots.length > 0) return h;
  return {
    ...h,
    lots: [
      {
        id: newId(),
        date: h.buyDate || todayStr(),
        price: h.avgPrice,
        qty: h.qty,
      },
    ],
  };
}

export function usePortfolioState() {
  const [rawPortfolio, setPortfolio] = useLocalStorage<Holding[]>("portfolio", []);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>(
    "transactions",
    []
  );
  const [cashBalance, setCashBalance] = useLocalStorage<number>("cash_balance", 0);

  // Always return migrated holdings so legacy data works transparently
  const portfolio: Holding[] = rawPortfolio.map(migrateLegacyHolding);

  // ─── Funds ───────────────────────────────────────────────────────────────

  const addFunds = useCallback(
    (amount: number, note?: string) => {
      setCashBalance((c) => c + amount);
      setTransactions((prev) => [
        {
          id: newId(),
          date: todayStr(),
          action: "DEPOSIT",
          amount,
          cashAfter: 0,
          meta: { type: "Fund Deposit", note: note?.trim() || undefined },
        },
        ...prev,
      ]);
    },
    [setCashBalance, setTransactions]
  );

  const withdrawFunds = useCallback(
    (amount: number, note?: string): boolean => {
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
            meta: { type: "Withdrawal", note: note?.trim() || undefined },
          },
          ...prev,
        ]);
      }
      return ok;
    },
    [setCashBalance, setTransactions]
  );

  // ─── BUY — creates a new FIFO lot ────────────────────────────────────────

  const buy = useCallback(
    (ticker: string, price: number, qty: number, buyDate: string, chargesPerShare: number = 0): boolean => {
      const gross = price * qty;
      const totalCharges = Math.max(0, chargesPerShare) * qty;
      const total = gross + totalCharges;
      if (total > cashBalance) return false;

      setCashBalance((c) => c - total);

      // Lot price = trading price only (charges are tracked separately, not baked into cost basis)
      const newLot = makeLot(buyDate, price, qty);

      setPortfolio((prev) => {
        // Migrate all existing holdings first
        const migrated = prev.map(migrateLegacyHolding);
        const existing = migrated.find((h) => h.ticker === ticker);

        if (existing) {
          // Append new lot (oldest first order maintained by insertion)
          const updatedLots = [...existing.lots, newLot];
          const { avgPrice, buyDate: newBuyDate } = recomputeHoldingMeta(updatedLots);
          return migrated.map((h) =>
            h.ticker === ticker
              ? {
                  ...h,
                  qty: h.qty + qty,
                  avgPrice,
                  buyDate: newBuyDate,
                  lots: updatedLots,
                }
              : h
          );
        }

        return [
          ...migrated,
          {
            ticker,
            qty,
            avgPrice: price,
            buyDate,
            lots: [newLot],
          },
        ];
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
          meta: {
            type: "Market Buy",
            tradingPrice: price,
            chargesPerShare: Math.max(0, chargesPerShare),
            avgCost: price, // avg traded price (charges tracked separately)
            buyDate,
            charges: totalCharges,
            grossAmount: gross,
          },
        },
        ...prev,
      ]);

      return true;
    },
    [cashBalance, setCashBalance, setPortfolio, setTransactions]
  );

  // ─── SELL — consumes lots FIFO (oldest first) ─────────────────────────────

  const sell = useCallback(
    (
      ticker: string,
      price: number,
      qty: number,
      sellDate: string,
      charges: number = 0
    ): boolean => {
      // Work on migrated portfolio snapshot
      const migrated = rawPortfolio.map(migrateLegacyHolding);
      const holding = migrated.find((h) => h.ticker === ticker);
      if (!holding || qty > holding.qty) return false;

      const ch = Math.max(0, charges);
      const fifoResult = fifoSell(holding.lots, qty, price, sellDate, ch);
      if (!fifoResult) return false;

      const gross = price * qty;
      const netProceeds = gross - ch;

      setCashBalance((c) => c + netProceeds);

      setPortfolio((prev) => {
        const m = prev.map(migrateLegacyHolding);
        return m
          .map((h) => {
            if (h.ticker !== ticker) return h;
            const newLots = fifoResult.remainingLots;
            if (!newLots.length) return null; // will be filtered
            const { avgPrice, buyDate } = recomputeHoldingMeta(newLots);
            return {
              ...h,
              qty: h.qty - qty,
              avgPrice,
              buyDate,
              lots: newLots,
            };
          })
          .filter(Boolean) as Holding[];
      });

      setTransactions((prev) => [
        {
          id: newId(),
          date: sellDate,
          action: "SELL",
          stock: ticker,
          qty,
          price,
          amount: netProceeds,
          cashAfter: 0,
          meta: {
            // netProfit = grossProfit - charges (Angel One "Net Realised P&L")
            profit: fifoResult.netProfit,
            // grossProfit = before charges (Angel One "Realised P&L")
            grossProfit: fifoResult.grossProfit,
            profitPct:
              fifoResult.fifoAvgCost > 0
                ? (fifoResult.netProfit / (fifoResult.fifoAvgCost * qty)) * 100
                : 0,
            holdingDays: fifoResult.oldestLotHoldingDays,
            type: fifoResult.dominantTaxType,
            avgCost: fifoResult.fifoAvgCost,
            buyDate: fifoResult.oldestLotDate,
            sellDate,
            charges: ch,
            grossAmount: gross,
            fifoLots: fifoResult.lotDetails,
            fifoAvgCost: fifoResult.fifoAvgCost,
          },
        },
        ...prev,
      ]);

      return true;
    },
    [rawPortfolio, setCashBalance, setPortfolio, setTransactions]
  );

  // ─── Edit holding — patches qty/avgPrice/buyDate AND rebuilds lots ────────

  const editHolding = useCallback(
    (
      ticker: string,
      patch: { qty?: number; avgPrice?: number; buyDate?: string }
    ): boolean => {
      let ok = false;
      setPortfolio((prev) =>
        prev.map((h) => {
          if (h.ticker !== ticker) return h;
          const newQty = patch.qty != null && patch.qty > 0 ? patch.qty : h.qty;
          const newAvg =
            patch.avgPrice != null && patch.avgPrice > 0 ? patch.avgPrice : h.avgPrice;
          const newDate = patch.buyDate || h.buyDate;
          // Rebuild as a single synthetic lot (edit replaces lot history)
          ok = true;
          return {
            ...h,
            qty: newQty,
            avgPrice: newAvg,
            buyDate: newDate,
            lots: [{ id: newId(), date: newDate, price: newAvg, qty: newQty }],
          };
        })
      );
      return ok;
    },
    [setPortfolio]
  );

  /** Delete a single holding entirely. Does NOT refund cash. */
  const deleteHolding = useCallback(
    (ticker: string) => {
      setPortfolio((prev) => prev.filter((h) => h.ticker !== ticker));
    },
    [setPortfolio]
  );

  /** Wipe portfolio + transactions + cash. */
  const resetPortfolio = useCallback(() => {
    setPortfolio([]);
    setTransactions([]);
    setCashBalance(0);
  }, [setPortfolio, setTransactions, setCashBalance]);

  /** Replace full state (used by Import backup). */
  const replaceState = useCallback(
    (state: {
      portfolio: Holding[];
      transactions: Transaction[];
      cashBalance: number;
    }) => {
      setPortfolio(Array.isArray(state.portfolio) ? state.portfolio : []);
      setTransactions(Array.isArray(state.transactions) ? state.transactions : []);
      setCashBalance(typeof state.cashBalance === "number" ? state.cashBalance : 0);
    },
    [setPortfolio, setTransactions, setCashBalance]
  );

  return {
    portfolio,
    transactions,
    cashBalance,
    addFunds,
    withdrawFunds,
    buy,
    sell,
    editHolding,
    deleteHolding,
    resetPortfolio,
    replaceState,
  };
}
