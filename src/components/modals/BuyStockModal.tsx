import { useEffect, useRef, useState } from "react";
import { Loader2, Search, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, Info } from "lucide-react";
import { MobileSheet } from "./MobileSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchQuote, searchStocks } from "@/services/api";
import { formatINR } from "@/utils/formatters";
import type { SearchApiResponse } from "@/types/api.types";

type SearchResult = NonNullable<SearchApiResponse["quotes"]>[number];
type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";
type ProductType = "INTRADAY" | "DELIVERY";

const todayStr = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onClose: () => void;
  cashBalance: number;
  onConfirm: (ticker: string, price: number, qty: number, buyDate: string) => boolean;
}

export function BuyStockModal({ open, onClose, cashBalance, onConfirm }: Props) {
  // Search state
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<{ name: string; cmp: number } | null>(null);

  // Order config
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [productType, setProductType] = useState<ProductType>("DELIVERY");
  const [price, setPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [buyDate, setBuyDate] = useState(todayStr());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // UI state
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(""); setDebounced(""); setResults([]); setShowResults(false);
      setPicked(null); setVerified(null); setVerifying(false);
      setPrice(""); setQty("1"); setTriggerPrice(""); setBuyDate(todayStr());
      setErr(null); setStep("form"); setOrderType("MARKET"); setProductType("DELIVERY");
    }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!debounced || debounced.length < 2 || picked) {
      setResults([]); setShowResults(false); return;
    }
    let cancel = false;
    setSearching(true);
    searchStocks(debounced)
      .then((r) => { if (!cancel) { setResults(r ?? []); setShowResults(true); } })
      .catch(() => { if (!cancel) setResults([]); })
      .finally(() => { if (!cancel) setSearching(false); });
    return () => { cancel = true; };
  }, [debounced, picked]);

  const handlePick = async (r: SearchResult) => {
    if (!r.symbol) return;
    setPicked(r);
    setShowResults(false);
    setQuery(`${r.symbol.replace(/\.(NS|BO)$/, "")} · ${r.longname || r.shortname || ""}`);
    setVerifying(true);
    setVerified(null);
    setErr(null);
    try {
      const q = await fetchQuote(r.symbol);
      if (!q.cmp) throw new Error("No live price available");
      setVerified({ name: q.name || r.longname || r.symbol, cmp: q.cmp });
      if (orderType !== "MARKET") setPrice(String(q.cmp));
    } catch (e) {
      setErr(`Could not verify ${r.symbol}: ${(e as Error).message}`);
      setPicked(null);
    } finally {
      setVerifying(false);
    }
  };

  const clearPick = () => {
    setPicked(null); setVerified(null); setPrice(""); setQuery(""); setErr(null);
  };

  const effectivePrice = orderType === "MARKET" ? (verified?.cmp ?? 0) : (parseFloat(price) || 0);
  const qtyNum = parseInt(qty) || 0;
  const total = effectivePrice * qtyNum;
  const isInsufficient = total > cashBalance;

  const handleReview = () => {
    setErr(null);
    if (!picked || !picked.symbol) return setErr("Please pick a stock from the search results");
    if (!verified) return setErr("Stock not yet verified — please wait");
    if (qtyNum <= 0) return setErr("Enter a valid quantity");
    if (orderType !== "MARKET" && (!parseFloat(price) || parseFloat(price) <= 0)) return setErr("Enter a valid limit price");
    if ((orderType === "SL" || orderType === "SL-M") && (!parseFloat(triggerPrice) || parseFloat(triggerPrice) <= 0)) return setErr("Enter a valid trigger price");
    if (isInsufficient) return setErr("Insufficient cash balance");
    setStep("confirm");
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      await fetchQuote(picked!.symbol!);
      if (onConfirm(picked!.symbol!, effectivePrice, qtyNum, buyDate)) {
        setStep("success");
        setTimeout(() => onClose(), 1800);
      } else {
        setErr("Order placement failed");
        setStep("form");
      }
    } catch (e) {
      setErr(`Order failed: ${(e as Error).message}`);
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  };

  const orderTypeTabs: OrderType[] = ["MARKET", "LIMIT", "SL", "SL-M"];

  // ── Success screen ───────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <MobileSheet open={open} onClose={onClose} title="">
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">Order Placed!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {qtyNum} × {picked?.symbol?.replace(/\.(NS|BO)$/, "")} @ {formatINR(effectivePrice)}
            </p>
          </div>
          <Badge className="bg-green-500/15 text-green-600 border-green-500/30 font-semibold">
            {orderType} · {productType}
          </Badge>
        </div>
      </MobileSheet>
    );
  }

  // ── Confirm screen ───────────────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <MobileSheet open={open} onClose={onClose} title="Confirm Order">
        <div className="py-3 space-y-4">
          {/* Order summary card */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-base">{picked?.symbol?.replace(/\.(NS|BO)$/, "")}</p>
                <p className="text-xs text-muted-foreground">{verified?.name}</p>
              </div>
              <div className="text-right">
                <Badge className="bg-green-500/15 text-green-600 border-green-500/30">BUY</Badge>
              </div>
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
                  {orderType === "MARKET" ? "Market Price" : formatINR(parseFloat(price))}
                </p>
              </div>
              {(orderType === "SL" || orderType === "SL-M") && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Trigger</p>
                  <p className="font-mono font-semibold">{formatINR(parseFloat(triggerPrice))}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Date</p>
                <p className="font-semibold">{buyDate}</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Est. Total</p>
              <p className="font-mono text-base font-bold">{formatINR(total)}</p>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Available Margin</span>
              <span className="font-mono">{formatINR(cashBalance)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Review your order carefully. This action cannot be undone once placed.</span>
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setStep("form")} disabled={submitting}>
              Modify
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Placing…</> : "Place Buy Order"}
            </Button>
          </div>
        </div>
      </MobileSheet>
    );
  }

  // ── Main order form ──────────────────────────────────────────────────────
  return (
    <MobileSheet open={open} onClose={onClose} title="">
      {/* Angel One-style green header bar */}
      <div className="-mx-4 -mt-4 mb-4 bg-green-600 px-4 py-3 flex items-center justify-between">
        <div>
          {picked && verified ? (
            <>
              <p className="font-mono text-sm font-bold text-white">{picked.symbol?.replace(/\.(NS|BO)$/, "")}</p>
              <p className="text-xs text-green-100 truncate max-w-[160px]">{verified.name}</p>
            </>
          ) : (
            <p className="text-sm font-bold text-white">Buy Stock</p>
          )}
        </div>
        {verified && (
          <div className="text-right">
            <p className="font-mono text-base font-bold text-white">{formatINR(verified.cmp)}</p>
          </div>
        )}
      </div>

      <div className="space-y-4 py-1">
        {/* Stock search */}
        {!picked && (
          <div ref={wrapRef} className="space-y-1.5 relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length && !picked && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
                placeholder="Search by name or ticker (NSE / BSE)"
                autoFocus
                className="pl-10 pr-10"
              />
              {(searching || verifying) && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {showResults && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl">
                {results.map((r) => (
                  <button
                    key={r.symbol}
                    type="button"
                    onClick={() => handlePick(r)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{r.symbol?.replace(/\.(NS|BO)$/, "")}</span>
                        <Badge variant={r.exchange === "NSE" ? "default" : "secondary"} className="h-4 px-1.5 text-[10px]">
                          {r.exchange}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{r.longname || r.shortname}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showResults && !searching && results.length === 0 && debounced.length >= 2 && (
              <p className="text-xs text-muted-foreground">No matches on NSE / BSE.</p>
            )}
          </div>
        )}

        {/* Picked stock chip */}
        {picked && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
            {verifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : verified ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <div className="flex-1 min-w-0">
              <span className="font-mono font-semibold">{picked.symbol}</span>
              <span className="ml-1.5 text-muted-foreground">
                {verifying ? "Verifying…" : verified ? `LTP ${formatINR(verified.cmp)}` : "Could not verify"}
              </span>
            </div>
            <button type="button" onClick={clearPick} className="text-xs text-muted-foreground hover:text-foreground underline">
              Change
            </button>
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
                  ? "bg-green-600 text-white"
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
                  ? "bg-green-600/15 text-green-600 border border-green-600/40"
                  : "bg-muted/60 text-muted-foreground hover:bg-accent border border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Price fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-qty" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                id="b-qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="text-center px-7 font-mono font-semibold"
                min="1"
              />
              <button
                type="button"
                onClick={() => setQty(String(qtyNum + 1))}
                className="absolute right-2 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-pr" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {orderType === "MARKET" ? "Market Price" : "Limit Price (₹)"}
            </Label>
            <Input
              id="b-pr"
              type="number"
              value={orderType === "MARKET" ? (verified?.cmp ? String(verified.cmp) : "") : price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={orderType === "MARKET"}
              className={`font-mono ${orderType === "MARKET" ? "opacity-60" : ""}`}
              placeholder={orderType === "MARKET" ? "At best" : "Enter price"}
            />
          </div>

          {(orderType === "SL" || orderType === "SL-M") && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="b-trig" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trigger Price (₹)
              </Label>
              <Input
                id="b-trig"
                type="number"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                className="font-mono"
                placeholder="Enter trigger price"
              />
            </div>
          )}
        </div>

        {/* Advanced — date */}
        <button
          type="button"
          onClick={() => setShowAdvanced((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Advanced Options
        </button>
        {showAdvanced && (
          <div className="space-y-1.5">
            <Label htmlFor="b-dt" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Buy Date
            </Label>
            <Input id="b-dt" type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
          </div>
        )}

        {/* Order summary bar */}
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Est. Amount</p>
              <p className={`font-mono text-base font-bold ${isInsufficient ? "text-destructive" : "text-foreground"}`}>
                {formatINR(total)}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Available</p>
              <p className={`font-mono text-sm font-semibold ${isInsufficient ? "text-destructive" : "text-green-600"}`}>
                {formatINR(cashBalance)}
              </p>
            </div>
          </div>
          {isInsufficient && (
            <p className="mt-2 text-xs text-destructive font-medium">Insufficient funds for this order</p>
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
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
            onClick={handleReview}
            disabled={!verified || verifying || isInsufficient}
          >
            Buy
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
