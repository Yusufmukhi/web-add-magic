import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, ChevronUp, ChevronDown, Info, CheckCircle2 } from "lucide-react";
import { MobileSheet } from "./MobileSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Holding } from "@/types/portfolio.types";
import { formatINR, formatNumber } from "@/utils/formatters";
import { previewFifoSell } from "@/utils/fifo";

type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";
type ProductType = "INTRADAY" | "DELIVERY";

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
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [productType, setProductType] = useState<ProductType>("DELIVERY");
  const [price, setPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [sellDate, setSellDate] = useState(todayStr());
  const [chargesInput, setChargesInput] = useState("0");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [submitting, setSubmitting] = useState(false);

  const holding = useMemo(() => portfolio.find((h) => h.ticker === ticker), [portfolio, ticker]);

  useEffect(() => {
    if (!open) return;
    setSellDate(todayStr()); setErr(null); setChargesInput("0");
    setOrderType("MARKET"); setProductType("DELIVERY"); setStep("form");
    setTriggerPrice(""); setShowAdvanced(false);
    const t = prefillTicker ?? portfolio[0]?.ticker ?? "";
    setTicker(t);
    if (t && prices[t]) setPrice(String(prices[t]));
    setQty("1");
  }, [open, prefillTicker, portfolio, prices]);

  useEffect(() => {
    if (ticker && prices[ticker]) setPrice(String(prices[ticker]));
  }, [ticker, prices]);

  const p = parseFloat(price) || 0;
  const qtyNum = parseInt(qty) || 0;
  const charges = Math.max(0, parseFloat(chargesInput) || 0);
  const gross = p * qtyNum;
  const netProceeds = gross - charges;
  const maxQty = holding?.qty ?? 0;
  const effectivePrice = orderType === "MARKET" ? (prices[ticker] ?? p) : p;

  const fifoPreview = useMemo(() => {
    if (!holding || !effectivePrice || !qtyNum || qtyNum > holding.qty) return null;
    const lots = holding.lots ?? [];
    if (!lots.length) return null;
    return previewFifoSell(lots, qtyNum, effectivePrice, sellDate, charges);
  }, [holding, effectivePrice, qtyNum, sellDate, charges]);

  const oldestLot = holding?.lots?.[0];

  const handleReview = () => {
    setErr(null);
    if (!ticker) return setErr("Select a stock to sell");
    if (!holding || qtyNum <= 0) return setErr("Enter a valid quantity");
    if (qtyNum > maxQty) return setErr(`Only ${maxQty} shares available`);
    if (orderType !== "MARKET" && (!p || p <= 0)) return setErr("Enter a valid limit price");
    if ((orderType === "SL" || orderType === "SL-M") && (!parseFloat(triggerPrice) || parseFloat(triggerPrice) <= 0)) return setErr("Enter a valid trigger price");
    setStep("confirm");
  };

  const handleConfirm = () => {
    setSubmitting(true);
    setErr(null);
    try {
      if (onConfirm(ticker, effectivePrice, qtyNum, sellDate, charges)) {
        setStep("success");
        setTimeout(() => onClose(), 1800);
      } else {
        setErr("Sell failed");
        setStep("form");
      }
    } catch (e) {
      setErr(`Sell failed: ${(e as Error).message}`);
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  };

  const plColor = fifoPreview
    ? fifoPreview.netProfit >= 0 ? "text-green-600" : "text-destructive"
    : "";

  const orderTypeTabs: OrderType[] = ["MARKET", "LIMIT", "SL", "SL-M"];

  // ── Success screen ───────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <MobileSheet open={open} onClose={onClose} title="">
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
            <CheckCircle2 className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">Order Placed!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {qtyNum} × {ticker} sold @ {formatINR(effectivePrice)}
            </p>
          </div>
          {fifoPreview && (
            <Badge className={`${fifoPreview.netProfit >= 0 ? "bg-green-500/15 text-green-600 border-green-500/30" : "bg-destructive/15 text-destructive border-destructive/30"} font-semibold`}>
              {fifoPreview.netProfit >= 0 ? "+" : ""}{formatNumber(fifoPreview.netProfit, 2)} P&L · {fifoPreview.dominantTaxType}
            </Badge>
          )}
        </div>
      </MobileSheet>
    );
  }

  // ── Confirm screen ───────────────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <MobileSheet open={open} onClose={onClose} title="Confirm Order">
        <div className="py-3 space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-base">{ticker}</p>
                <p className="text-xs text-muted-foreground">{holding ? `${holding.qty} shares held` : ""}</p>
              </div>
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">SELL</Badge>
            </div>

            <div className="h-px bg-border" />

            <div className="grid grid-cols-2 gap-y-2.5 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Order Type</p>
                <p className="font-semibold">{orderType}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Product</p>
                <p className="font-semibold">{productType}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Quantity</p>
                <p className="font-mono font-semibold">{qtyNum} shares</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Price</p>
                <p className="font-mono font-semibold">
                  {orderType === "MARKET" ? "Market Price" : formatINR(p)}
                </p>
              </div>
              {(orderType === "SL" || orderType === "SL-M") && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Trigger</p>
                  <p className="font-mono font-semibold">{formatINR(parseFloat(triggerPrice))}</p>
                </div>
              )}
              {charges > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Charges</p>
                  <p className="font-mono font-semibold">{formatINR(charges)}</p>
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* FIFO P&L summary */}
            {fifoPreview && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gross proceeds</span>
                  <span className="font-mono font-semibold">{formatINR(gross)}</span>
                </div>
                {charges > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Net proceeds</span>
                    <span className="font-mono font-semibold">{formatINR(netProceeds)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">FIFO Avg Cost</span>
                  <span className="font-mono">{formatINR(fifoPreview.fifoAvgCost)}/sh</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Realised P&L</span>
                  <span className={`font-mono font-bold ${plColor}`}>
                    {fifoPreview.grossProfit >= 0 ? "+" : ""}{formatINR(fifoPreview.grossProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net Realised P&L</span>
                  <span className={`font-mono font-bold ${plColor}`}>
                    {fifoPreview.netProfit >= 0 ? "+" : ""}{formatINR(fifoPreview.netProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax classification</span>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-bold ${
                      fifoPreview.dominantTaxType === "LTCG"
                        ? "border-green-500/40 text-green-600"
                        : "border-amber-500/40 text-amber-600"
                    }`}
                  >
                    {fifoPreview.dominantTaxType}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Review carefully. Sold shares will be deducted from your portfolio immediately.</span>
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setStep("form")} disabled={submitting}>
              Modify
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-bold"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Placing…</> : "Place Sell Order"}
            </Button>
          </div>
        </div>
      </MobileSheet>
    );
  }

  // ── Main order form ──────────────────────────────────────────────────────
  return (
    <MobileSheet open={open} onClose={onClose} title="">
      {/* Angel One-style red header */}
      <div className="-mx-4 -mt-4 mb-4 bg-destructive px-4 py-3 flex items-center justify-between">
        <div>
          {ticker ? (
            <>
              <p className="font-mono text-sm font-bold text-white">{ticker}</p>
              <p className="text-xs text-red-100">{holding ? `${holding.qty} shares held · Avg ${formatINR(holding.avgPrice)}` : ""}</p>
            </>
          ) : (
            <p className="text-sm font-bold text-white">Sell Stock</p>
          )}
        </div>
        {ticker && prices[ticker] && (
          <div className="text-right">
            <p className="font-mono text-base font-bold text-white">{formatINR(prices[ticker])}</p>
          </div>
        )}
      </div>

      <div className="space-y-4 py-1">
        {/* Stock selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock</Label>
          <Select value={ticker} onValueChange={setTicker}>
            <SelectTrigger className="font-mono font-semibold">
              <SelectValue placeholder="Select holding" />
            </SelectTrigger>
            <SelectContent>
              {portfolio.map((h) => (
                <SelectItem key={h.ticker} value={h.ticker}>
                  <span className="font-mono font-semibold">{h.ticker}</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {h.qty} shares @ {formatINR(h.avgPrice)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* FIFO cost basis banner */}
        {oldestLot && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">FIFO Cost Basis</span>
            {" — "}oldest lot:{" "}
            <span className="font-mono text-foreground font-semibold">{formatINR(oldestLot.price)}</span>{" "}
            on <span className="font-mono">{oldestLot.date}</span>
            {holding && holding.lots && holding.lots.length > 1 && (
              <span className="ml-1 text-foreground">({holding.lots.length} lots)</span>
            )}
          </div>
        )}

        {/* Product type toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["DELIVERY", "INTRADAY"] as ProductType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setProductType(t)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                productType === t
                  ? "bg-destructive text-white"
                  : "bg-muted/40 text-muted-foreground hover:bg-accent"
              }`}
            >
              {t === "DELIVERY" ? "CNC (Delivery)" : "MIS (Intraday)"}
            </button>
          ))}
        </div>

        {/* Order type tabs */}
        <div className="flex gap-1">
          {orderTypeTabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setOrderType(t); if (t === "MARKET") setPrice(""); }}
              className={`flex-1 rounded-md py-1.5 text-[11px] font-bold transition-colors ${
                orderType === t
                  ? "bg-destructive/15 text-destructive border border-destructive/40"
                  : "bg-muted/60 text-muted-foreground hover:bg-accent border border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Quantity + Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quantity
            </Label>
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                className="absolute left-2 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="text-center px-7 font-mono font-semibold"
                min="1"
                max={maxQty}
              />
              <button
                type="button"
                onClick={() => setQty(String(Math.min(maxQty, qtyNum + 1)))}
                className="absolute right-2 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>
            {holding && (
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Available</span>
                <button
                  type="button"
                  onClick={() => setQty(String(maxQty))}
                  className="text-destructive font-semibold hover:underline"
                >
                  MAX ({maxQty})
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {orderType === "MARKET" ? "Market Price" : "Limit Price (₹)"}
            </Label>
            <Input
              type="number"
              value={orderType === "MARKET" ? (prices[ticker] ? String(prices[ticker]) : "") : price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={orderType === "MARKET"}
              className={`font-mono ${orderType === "MARKET" ? "opacity-60" : ""}`}
              placeholder={orderType === "MARKET" ? "At best" : "Enter price"}
            />
          </div>

          {(orderType === "SL" || orderType === "SL-M") && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trigger Price (₹)
              </Label>
              <Input
                type="number"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                className="font-mono"
                placeholder="Enter trigger price"
              />
            </div>
          )}
        </div>

        {/* Advanced: charges + date */}
        <button
          type="button"
          onClick={() => setShowAdvanced((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Advanced Options
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sell Date
              </Label>
              <Input type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Charges (₹)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={chargesInput}
                onChange={(e) => setChargesInput(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
        )}

        {/* P&L preview */}
        {fifoPreview && qtyNum > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">P&L Preview (FIFO)</p>
            <div className="grid grid-cols-2 gap-y-1.5 text-sm">
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Net Realised P&L</span>
                <span className={`font-mono font-bold ${plColor}`}>
                  {fifoPreview.netProfit >= 0 ? "+" : ""}{formatINR(fifoPreview.netProfit)}
                  <span className="text-xs font-normal ml-1 opacity-70">
                    ({fifoPreview.netProfit >= 0 ? "+" : ""}{((fifoPreview.netProfit / (fifoPreview.fifoAvgCost * qtyNum || 1)) * 100).toFixed(2)}%)
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">FIFO cost</span>
                <span className="font-mono text-xs">{formatINR(fifoPreview.fifoAvgCost)}/sh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Tax type</span>
                <span className={`font-mono text-xs font-semibold ${fifoPreview.dominantTaxType === "LTCG" ? "text-green-600" : "text-amber-500"}`}>
                  {fifoPreview.dominantTaxType}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Net proceeds bar */}
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Net Proceeds</p>
            <p className="font-mono text-base font-bold">{formatINR(netProceeds)}</p>
          </div>
          {charges > 0 && (
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">After charges</p>
              <p className="font-mono text-xs text-muted-foreground">– {formatINR(charges)}</p>
            </div>
          )}
        </div>

        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {err}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            className="flex-1 font-bold"
            onClick={handleReview}
            disabled={!ticker || !holding || qtyNum <= 0 || qtyNum > maxQty}
          >
            Sell
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
