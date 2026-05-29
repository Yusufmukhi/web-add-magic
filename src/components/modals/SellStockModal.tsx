import { useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, Minus, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { MobileSheet } from "./MobileSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Holding } from "@/types/portfolio.types";
import { formatINR } from "@/utils/formatters";
import { fifoSell } from "@/utils/fifo";

const todayStr = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onClose: () => void;
  portfolio: Holding[];
  prices: Record<string, number>;
  prefillTicker?: string | null;
  onConfirm: (ticker: string, price: number, qty: number, sellDate: string, charges: number) => boolean;
}

export function SellStockModal({ open, onClose, portfolio, prices, prefillTicker, onConfirm }: Props) {
  const [ticker, setTicker] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [sellDate, setSellDate] = useState(todayStr());
  const [charges, setCharges] = useState("0");
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "success">("form");
  const [submitting, setSubmitting] = useState(false);

  const holding = useMemo(() => portfolio.find((h) => h.ticker === ticker), [portfolio, ticker]);

  useEffect(() => {
    if (!open) return;
    setSellDate(todayStr()); setErr(null); setCharges("0");
    setStep("form");
    const t = prefillTicker ?? portfolio[0]?.ticker ?? "";
    setTicker(t);
    if (t && prices[t]) setPrice(String(prices[t]));
    setQty("1");
  }, [open, prefillTicker, portfolio, prices]);

  useEffect(() => {
    if (ticker && prices[ticker]) setPrice(String(prices[ticker]));
  }, [ticker, prices]);

  const priceNum = parseFloat(price) || 0;
  const qtyNum = Math.max(0, parseInt(qty) || 0);
  const chargesNum = Math.max(0, parseFloat(charges) || 0);
  const gross = priceNum * qtyNum;
  const netProceeds = gross - chargesNum;
  const maxQty = holding?.qty ?? 0;

  const fifoResult = useMemo(() => {
    if (!holding || !priceNum || !qtyNum || qtyNum > holding.qty) return null;
    const lots = holding.lots ?? [];
    if (!lots.length) return null;
    return fifoSell(lots, qtyNum, priceNum, sellDate, chargesNum);
  }, [holding, priceNum, qtyNum, sellDate, chargesNum]);

  // Build FIFO lot breakdown string for display: "200@10 + 400@5"
  const fifoBreakdown = useMemo(() => {
    if (!fifoResult) return null;
    return fifoResult.lotDetails.map((d) => `${d.qtySold}@${formatINR(d.lotPrice)}`).join(" + ");
  }, [fifoResult]);

  const handleConfirm = () => {
    setErr(null);
    if (!ticker) return setErr("Select a stock to sell");
    if (!holding || qtyNum <= 0) return setErr("Enter a valid quantity");
    if (qtyNum > maxQty) return setErr(`Only ${maxQty} shares available`);
    if (priceNum <= 0) return setErr("Enter a valid price");
    setSubmitting(true);
    try {
      if (onConfirm(ticker, priceNum, qtyNum, sellDate, chargesNum)) {
        setStep("success");
        setTimeout(() => onClose(), 2000);
      } else {
        setErr("Sell failed");
      }
    } catch (e) {
      setErr(`Sell failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <MobileSheet open={open} onClose={onClose} title="">
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
            <CheckCircle2 className="h-8 w-8 text-foreground" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">Sold Successfully!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {qtyNum} × {ticker} @ {formatINR(priceNum)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Amount</span>
              <span className="font-mono font-bold">{formatINR(gross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Charges</span>
              <span className="font-mono">−{formatINR(chargesNum)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between">
              <span className="font-semibold">Net Proceeds</span>
              <span className="font-mono font-bold">{formatINR(netProceeds)}</span>
            </div>
            {fifoResult && (
              <>
                <div className="h-px bg-border" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">FIFO Avg Buy</span>
                  <span className="font-mono">{formatINR(fifoResult.fifoAvgCost)}/sh</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span>Net P&L</span>
                  <span className={`font-mono ${fifoResult.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {fifoResult.netProfit >= 0 ? "+" : ""}{formatINR(fifoResult.netProfit)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </MobileSheet>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <MobileSheet open={open} onClose={onClose} title="Sell Stock">
      <div className="space-y-4 pt-1">

        {/* Symbol */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symbol</Label>
          <Select value={ticker} onValueChange={setTicker}>
            <SelectTrigger className="font-mono font-semibold">
              <SelectValue placeholder="Select holding to sell" />
            </SelectTrigger>
            <SelectContent>
              {portfolio.map((h) => (
                <SelectItem key={h.ticker} value={h.ticker}>
                  <span className="font-mono font-semibold">{h.ticker}</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {h.qty} sh · Avg {formatINR(h.avgPrice)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {holding && (
            <p className="text-[11px] text-muted-foreground">
              {holding.qty} shares held · {holding.lots?.length ?? 1} lot{(holding.lots?.length ?? 1) !== 1 ? "s" : ""} · Avg buy {formatINR(holding.avgPrice)}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="space-y-1.5">
          <Label htmlFor="s-price" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sell Price (₹)
          </Label>
          <Input
            id="s-price"
            type="number"
            min="0"
            step="0.05"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="font-mono font-semibold text-base"
            placeholder="Enter price"
          />
        </div>

        {/* Qty + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-qty" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quantity
            </Label>
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                className="absolute left-2 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-muted hover:bg-accent transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <Input
                id="s-qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="text-center px-8 font-mono font-bold text-base"
                min="1"
                max={maxQty}
              />
              <button
                type="button"
                onClick={() => setQty(String(Math.min(maxQty, qtyNum + 1)))}
                className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-muted hover:bg-accent transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {holding && (
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Available: {maxQty}</span>
                <button type="button" onClick={() => setQty(String(maxQty))} className="font-semibold hover:underline">
                  MAX
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sell Date
            </Label>
            <Input
              id="s-date"
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        {/* Charges */}
        <div className="space-y-1.5">
          <Label htmlFor="s-charges" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Charges (₹)
          </Label>
          <Input
            id="s-charges"
            type="number"
            min="0"
            step="0.01"
            value={charges}
            onChange={(e) => setCharges(e.target.value)}
            className="font-mono"
            placeholder="0"
          />
        </div>

        {/* FIFO Lot Breakdown — shown when lots are available */}
        {fifoResult && fifoResult.lotDetails.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              FIFO Lot Breakdown
            </p>
            <div className="space-y-1.5">
              {fifoResult.lotDetails.map((d, i) => (
                <div key={d.lotId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="font-mono">
                      <span className="font-semibold">{d.qtySold}</span>
                      <span className="text-muted-foreground"> sh @ </span>
                      <span className="font-semibold">{formatINR(d.lotPrice)}</span>
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      {d.taxType} · {d.holdingDays}d
                    </Badge>
                  </div>
                  <span className={`font-mono font-semibold ${d.lotProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {d.lotProfit >= 0 ? "+" : ""}{formatINR(d.lotProfit)}
                  </span>
                </div>
              ))}
            </div>
            {fifoBreakdown && (
              <div className="mt-1 pt-1.5 border-t border-border text-[11px] text-muted-foreground">
                Buy lots consumed: <span className="font-mono font-semibold text-foreground">{fifoBreakdown}</span>
              </div>
            )}
            <div className="pt-0.5 border-t border-border flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">FIFO Avg Buy Price</span>
              <span className="font-mono">{formatINR(fifoResult.fifoAvgCost)}/sh</span>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gross Amount</span>
              <span className="font-mono">{formatINR(gross)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Charges</span>
              <span className="font-mono">−{formatINR(chargesNum)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between font-semibold">
              <span>Net Proceeds</span>
              <span className="font-mono text-base">{formatINR(netProceeds)}</span>
            </div>
            {fifoResult && (
              <>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">FIFO Avg Buy</span>
                  <span className="font-mono">{formatINR(fifoResult.fifoAvgCost)}/sh</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1">
                    Net Realised P&L
                    {fifoResult.netProfit >= 0
                      ? <TrendingUp className="h-3 w-3 text-green-600" />
                      : <TrendingDown className="h-3 w-3 text-destructive" />}
                  </span>
                  <span className={`font-mono ${fifoResult.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {fifoResult.netProfit >= 0 ? "+" : ""}{formatINR(fifoResult.netProfit)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {err && <p className="text-xs text-destructive">{err}</p>}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-foreground text-background hover:bg-foreground/90 font-bold"
            onClick={handleConfirm}
            disabled={submitting || !ticker || !holding || qtyNum <= 0 || qtyNum > maxQty || priceNum <= 0}
          >
            {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Selling…</> : "Sell"}
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
