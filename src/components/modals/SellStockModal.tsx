import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, Plus, Minus, Info, CheckCircle2, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { MobileSheet } from "./MobileSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [showLotDetail, setShowLotDetail] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [submitting, setSubmitting] = useState(false);

  const holding = useMemo(() => portfolio.find((h) => h.ticker === ticker), [portfolio, ticker]);

  useEffect(() => {
    if (!open) return;
    setSellDate(todayStr()); setErr(null); setCharges("0");
    setStep("form"); setShowLotDetail(false);
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

  // Full FIFO preview with per-lot details
  const fifoResult = useMemo(() => {
    if (!holding || !priceNum || !qtyNum || qtyNum > holding.qty) return null;
    const lots = holding.lots ?? [];
    if (!lots.length) return null;
    return fifoSell(lots, qtyNum, priceNum, sellDate, chargesNum);
  }, [holding, priceNum, qtyNum, sellDate, chargesNum]);

  const plColor = fifoResult
    ? fifoResult.netProfit >= 0 ? "text-green-600" : "text-destructive"
    : "";

  const handleReview = () => {
    setErr(null);
    if (!ticker) return setErr("Select a stock to sell");
    if (!holding || qtyNum <= 0) return setErr("Enter a valid quantity");
    if (qtyNum > maxQty) return setErr(`Only ${maxQty} shares available`);
    if (priceNum <= 0) return setErr("Enter a valid price");
    setStep("confirm");
  };

  const handleConfirm = () => {
    setSubmitting(true);
    setErr(null);
    try {
      if (onConfirm(ticker, priceNum, qtyNum, sellDate, chargesNum)) {
        setStep("success");
        setTimeout(() => onClose(), 2000);
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

  // â”€â”€ Success screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === "success") {
    return (
      <MobileSheet open={open} onClose={onClose} title="">
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
            <CheckCircle2 className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">Sell Order Placed!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {qtyNum} Ã— {ticker} @ {formatINR(priceNum)}
            </p>
          </div>
          {fifoResult && (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Proceeds</span>
                <span className="font-mono font-bold">{formatINR(netProceeds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Realised P&L</span>
                <span className={`font-mono font-bold ${plColor}`}>
                  {fifoResult.netProfit >= 0 ? "+" : ""}{formatINR(fifoResult.netProfit)}
                </span>
              </div>
              <Badge
                className={`w-full justify-center ${
                  fifoResult.dominantTaxType === "LTCG"
                    ? "bg-green-500/15 text-green-600 border-green-500/30"
                    : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                } font-semibold`}
              >
                {fifoResult.dominantTaxType} Â· {fifoResult.dominantTaxType === "LTCG" ? "Long-term" : "Short-term"} Capital Gain
              </Badge>
            </div>
          )}
        </div>
      </MobileSheet>
    );
  }

  // â”€â”€ Confirm screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === "confirm") {
    return (
      <MobileSheet open={open} onClose={onClose} title="Confirm Sell Order">
        <div className="py-3 space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-base">{ticker}</p>
                <p className="text-xs text-muted-foreground">{holding ? `${holding.qty} shares held Â· Avg ${formatINR(holding.avgPrice)}` : ""}</p>
              </div>
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-bold">SELL</Badge>
            </div>

            <div className="h-px bg-border" />

            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Price / Share</p>
                <p className="font-mono font-semibold">{formatINR(priceNum)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Quantity</p>
                <p className="font-mono font-semibold">{qtyNum} shares</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Sell Date</p>
                <p className="font-semibold">{sellDate}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Charges</p>
                <p className="font-mono font-semibold">{formatINR(chargesNum)}</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Proceeds breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gross Proceeds</span>
                <span className="font-mono">{formatINR(gross)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Less: Charges</span>
                <span className="font-mono text-destructive">âˆ’ {formatINR(chargesNum)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between font-semibold">
                <span>Net Proceeds</span>
                <span className="font-mono text-base">{formatINR(netProceeds)}</span>
              </div>
            </div>

            {/* FIFO P&L summary */}
            {fifoResult && (
              <>
                <div className="h-px bg-border" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">FIFO Avg Cost</span>
                    <span className="font-mono">{formatINR(fifoResult.fifoAvgCost)}/sh</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gross Realised P&L</span>
                    <span className={`font-mono font-semibold ${fifoResult.grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {fifoResult.grossProfit >= 0 ? "+" : ""}{formatINR(fifoResult.grossProfit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Net Realised P&L</span>
                    <span className={`font-mono ${plColor}`}>
                      {fifoResult.netProfit >= 0 ? "+" : ""}{formatINR(fifoResult.netProfit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Tax Classification</span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-bold ${
                        fifoResult.dominantTaxType === "LTCG"
                          ? "border-green-500/40 text-green-600"
                          : "border-amber-500/40 text-amber-600"
                      }`}
                    >
                      {fifoResult.dominantTaxType}
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* FIFO lot detail */}
          {fifoResult && fifoResult.lotDetails.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowLotDetail((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent transition-colors"
              >
                <span>FIFO Lot Breakdown ({fifoResult.lotDetails.length} lot{fifoResult.lotDetails.length > 1 ? "s" : ""})</span>
                {showLotDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showLotDetail && (
                <div className="divide-y divide-border">
                  {fifoResult.lotDetails.map((lot, i) => (
                    <div key={lot.lotId} className="px-4 py-2.5 text-xs grid grid-cols-3 gap-1">
                      <div>
                        <p className="text-muted-foreground">Lot {i + 1} Â· {lot.lotDate}</p>
                        <p className="font-mono font-semibold">{lot.qtySold} sh @ {formatINR(lot.lotPrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">{lot.holdingDays}d held</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-1.5 ${
                            lot.taxType === "LTCG"
                              ? "border-green-500/40 text-green-600"
                              : "border-amber-500/40 text-amber-600"
                          }`}
                        >
                          {lot.taxType}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Net P&L</p>
                        <p className={`font-mono font-bold ${lot.lotProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                          {lot.lotProfit >= 0 ? "+" : ""}{formatINR(lot.lotProfit)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Lots consumed oldest-first (FIFO). Sold shares will be removed from your portfolio immediately.</span>
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
              {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Placingâ€¦</> : "Confirm Sell"}
            </Button>
          </div>
        </div>
      </MobileSheet>
    );
  }

  // â”€â”€ Main order form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <MobileSheet open={open} onClose={onClose} title="">
      {/* Red header */}
      <div className="-mx-4 -mt-4 mb-5 bg-destructive px-4 py-3 flex items-center justify-between">
        <div>
          {ticker ? (
            <>
              <p className="font-mono text-sm font-bold text-white">{ticker}</p>
              <p className="text-xs text-red-100">
                {holding ? `${holding.qty} shares held Â· Avg ${formatINR(holding.avgPrice)}` : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4" /> Sell Stock
              </p>
              <p className="text-xs text-red-100">Select from your holdings</p>
            </>
          )}
        </div>
        {ticker && prices[ticker] && (
          <div className="text-right">
            <p className="font-mono text-base font-bold text-white">{formatINR(prices[ticker])}</p>
            <p className="text-[10px] text-red-100">LTP</p>
          </div>
        )}
      </div>

      <div className="space-y-4">

        {/* â”€â”€ Stock selector â”€â”€ */}
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
                    {h.qty} sh Â· Avg {formatINR(h.avgPrice)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* FIFO cost basis info */}
        {holding && holding.lots && holding.lots.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs space-y-1">
            <p className="font-semibold text-foreground uppercase tracking-wide text-[11px]">FIFO Cost Basis</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
              <span>
                Oldest lot: <span className="font-mono text-foreground font-semibold">{formatINR(holding.lots[0].price)}</span> on{" "}
                <span className="font-mono">{holding.lots[0].date}</span>
              </span>
              {holding.lots.length > 1 && (
                <span>{holding.lots.length} lots total</span>
              )}
              <span>
                Avg cost: <span className="font-mono text-foreground font-semibold">{formatINR(holding.avgPrice)}</span>
              </span>
            </div>
          </div>
        )}

        {/* â”€â”€ Price field â”€â”€ */}
        <div className="space-y-1.5">
          <Label htmlFor="s-price" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sell Price per Share (â‚¹)
          </Label>
          <Input
            id="s-price"
            type="number"
            min="0"
            step="0.05"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="font-mono font-semibold text-base"
            placeholder={ticker && prices[ticker] ? String(prices[ticker]) : "Enter price"}
          />
          {ticker && prices[ticker] && priceNum !== prices[ticker] && priceNum > 0 && (
            <p className="text-[11px] text-muted-foreground">
              LTP: {formatINR(prices[ticker])} Â· diff {priceNum > prices[ticker] ? "+" : ""}{((priceNum - prices[ticker]) / prices[ticker] * 100).toFixed(2)}%
            </p>
          )}
        </div>

        {/* â”€â”€ Qty + Date row â”€â”€ */}
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
                <button
                  type="button"
                  onClick={() => setQty(String(maxQty))}
                  className="text-destructive font-semibold hover:underline"
                >
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

        {/* â”€â”€ Charges â”€â”€ */}
        <div className="space-y-1.5">
          <Label htmlFor="s-charges" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total Charges (â‚¹)
            <span className="ml-1.5 normal-case font-normal text-muted-foreground">(brokerage + STT + GST + DP etc.)</span>
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

        {/* â”€â”€ Live P&L Preview (FIFO) â”€â”€ */}
        {fifoResult && qtyNum > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">P&L Preview (FIFO)</p>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">FIFO Avg Cost</span>
                <span className="font-mono">{formatINR(fifoResult.fifoAvgCost)}/sh</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gross P&L</span>
                <span className={`font-mono font-semibold ${fifoResult.grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {fifoResult.grossProfit >= 0 ? "+" : ""}{formatINR(fifoResult.grossProfit)}
                </span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Net Realised P&L</span>
                <span className={`font-mono text-base ${plColor}`}>
                  {fifoResult.netProfit >= 0 ? "+" : ""}{formatINR(fifoResult.netProfit)}
                  <span className="text-xs font-normal ml-1 opacity-70">
                    ({fifoResult.netProfit >= 0 ? "+" : ""}{((fifoResult.netProfit / (fifoResult.fifoAvgCost * qtyNum || 1)) * 100).toFixed(2)}%)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Tax Classification</span>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-bold ${
                    fifoResult.dominantTaxType === "LTCG"
                      ? "border-green-500/40 text-green-600"
                      : "border-amber-500/40 text-amber-600"
                  }`}
                >
                  {fifoResult.dominantTaxType}
                </Badge>
              </div>

              {/* Expandable lot breakdown */}
              {fifoResult.lotDetails.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowLotDetail((o) => !o)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1"
                  >
                    {showLotDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showLotDetail ? "Hide" : "Show"} lot breakdown ({fifoResult.lotDetails.length} lot{fifoResult.lotDetails.length > 1 ? "s" : ""})
                  </button>

                  {showLotDetail && (
                    <div className="mt-1 space-y-1.5 border-t border-border pt-2">
                      {fifoResult.lotDetails.map((lot, i) => (
                        <div key={lot.lotId} className="flex items-center justify-between text-xs rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <div>
                            <p className="font-mono font-semibold">Lot {i + 1} Â· {lot.qtySold} sh</p>
                            <p className="text-muted-foreground">Bought {lot.lotDate} @ {formatINR(lot.lotPrice)}</p>
                            <p className="text-muted-foreground">{lot.holdingDays}d held</p>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold mb-1 ${
                                lot.taxType === "LTCG"
                                  ? "border-green-500/40 text-green-600"
                                  : "border-amber-500/40 text-amber-600"
                              }`}
                            >
                              {lot.taxType}
                            </Badge>
                            <p className={`font-mono font-bold ${lot.lotProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                              {lot.lotProfit >= 0 ? "+" : ""}{formatINR(lot.lotProfit)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* â”€â”€ Total Price summary bar â”€â”€ */}
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Order Details</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gross Proceeds</span>
              <span className="font-mono">{formatINR(gross)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Less: Charges</span>
              <span className="font-mono text-destructive">âˆ’ {formatINR(chargesNum)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between font-semibold">
              <span>Total Price (Net Proceeds)</span>
              <span className="font-mono text-base">{formatINR(netProceeds)}</span>
            </div>
          </div>
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
            disabled={!ticker || !holding || qtyNum <= 0 || qtyNum > maxQty || priceNum <= 0}
          >
            Review Order
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
