import { useEffect, useMemo, useState } from "react";
import { MobileSheet } from "./MobileSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Holding } from "@/types/portfolio.types";
import { formatINR, formatNumber } from "@/utils/formatters";
import { previewFifoSell } from "@/utils/fifo";

const todayStr = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onClose: () => void;
  portfolio: Holding[];
  prices: Record<string, number>;
  prefillTicker?: string | null;
  onConfirm: (
    ticker: string,
    price: number,
    qty: number,
    sellDate: string,
    charges: number
  ) => boolean;
}

export function SellStockModal({ open, onClose, portfolio, prices, prefillTicker, onConfirm }: Props) {
  const [ticker, setTicker] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [sellDate, setSellDate] = useState(todayStr());
  const [err, setErr] = useState<string | null>(null);
  const [chargesInput, setChargesInput] = useState("0");

  const holding = useMemo(() => portfolio.find((h) => h.ticker === ticker), [portfolio, ticker]);

  useEffect(() => {
    if (!open) return;
    setSellDate(todayStr());
    setErr(null);
    setChargesInput("0");
    const t = prefillTicker ?? portfolio[0]?.ticker ?? "";
    setTicker(t);
    if (t && prices[t]) setPrice(String(prices[t]));
  }, [open, prefillTicker, portfolio, prices]);

  useEffect(() => {
    if (ticker && prices[ticker]) setPrice(String(prices[ticker]));
  }, [ticker, prices]);

  const p = parseFloat(price) || 0;
  const q = parseInt(qty) || 0;
  const gross = p * q;
  const charges = Math.max(0, parseFloat(chargesInput) || 0);
  const netProceeds = gross - charges;

  // FIFO P&L preview — uses actual lot costs, not blended avgPrice
  const fifoPreview = useMemo(() => {
    if (!holding || !p || !q || q > holding.qty) return null;
    const lots = holding.lots ?? [];
    if (!lots.length) return null;
    return previewFifoSell(lots, q, p, sellDate, charges);
  }, [holding, p, q, sellDate, charges]);

  // Oldest lot info for display
  const oldestLot = holding?.lots?.[0];

  const handle = () => {
    if (!ticker || !p || !q) return setErr("Fill all fields");
    if (!holding || q > holding.qty) return setErr("Insufficient shares");
    if (onConfirm(ticker, p, q, sellDate, charges)) {
      setQty(""); setPrice("");
      onClose();
    } else setErr("Sell failed");
  };

  return (
    <MobileSheet open={open} onClose={onClose} title="🔴 Sell Stock">
        <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Stock</Label>
            <Select value={ticker} onValueChange={setTicker}>
              <SelectTrigger><SelectValue placeholder="Select holding" /></SelectTrigger>
              <SelectContent>
                {portfolio.map((h) => (
                  <SelectItem key={h.ticker} value={h.ticker}>
                    {h.ticker} ({h.qty} shares @ {formatINR(h.avgPrice)} avg)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* FIFO lot info banner */}
          {oldestLot && (
            <div className="sm:col-span-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">FIFO Cost Basis</span>
              {" — "}oldest lot: <span className="font-mono">{formatINR(oldestLot.price)}</span> on{" "}
              <span className="font-mono">{oldestLot.date}</span>
              {holding && holding.lots && holding.lots.length > 1 && (
                <span className="ml-1">({holding.lots.length} lots)</span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="s-pr">Price (₹)</Label>
            <Input id="s-pr" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-qty">Quantity</Label>
            <Input id="s-qty" type="number" max={holding?.qty} value={qty} onChange={(e) => setQty(e.target.value)} />
            {holding && (
              <p className="text-xs text-muted-foreground">Available: {holding.qty}</p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="s-dt">Sell Date</Label>
            <Input id="s-dt" type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="s-ch">Charges (₹)</Label>
            <Input
              id="s-ch"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={chargesInput}
              onChange={(e) => setChargesInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter total brokerage + taxes + DP charges (as shown by your broker).
            </p>
          </div>

          {/* P&L summary — FIFO-based */}
          <div className="sm:col-span-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross</span>
              <span className="font-mono">{formatINR(gross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net credit</span>
              <span className="font-mono font-semibold">{formatINR(netProceeds)}</span>
            </div>

            {fifoPreview ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">FIFO cost</span>
                  <span className="font-mono">{formatINR(fifoPreview.fifoAvgCost)}/sh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax type</span>
                  <span className={`font-mono font-semibold ${fifoPreview.dominantTaxType === "LTCG" ? "text-gain" : "text-amber-500"}`}>
                    {fifoPreview.dominantTaxType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross P&amp;L</span>
                  <span className={`font-mono ${fifoPreview.grossProfit >= 0 ? "text-gain" : "text-loss"}`}>
                    {fifoPreview.grossProfit >= 0 ? "+" : ""}{formatNumber(fifoPreview.grossProfit, 2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net P&amp;L</span>
                  <span className={`font-mono font-semibold ${fifoPreview.netProfit >= 0 ? "text-gain" : "text-loss"}`}>
                    {fifoPreview.netProfit >= 0 ? "+" : ""}{formatNumber(fifoPreview.netProfit, 2)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg cost</span>
                  <span className="font-mono">{holding ? formatINR(holding.avgPrice) : "—"}/sh</span>
                </div>
                <div className="col-span-1" />
              </>
            )}
          </div>

          {err && <p className="sm:col-span-2 text-xs text-loss">{err}</p>}
          <div className="sm:col-span-2 flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handle}>Sell</Button>
          </div>
        </div>
    </MobileSheet>
  );
}
