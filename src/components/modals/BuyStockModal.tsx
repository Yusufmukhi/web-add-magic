import { useEffect, useRef, useState } from "react";
import { Loader2, Search, CheckCircle2, AlertCircle, Plus, Minus, Info } from "lucide-react";
import { MobileSheet } from "./MobileSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchQuote, searchStocks } from "@/services/api";
import { formatINR } from "@/utils/formatters";
import type { SearchApiResponse } from "@/types/api.types";

type SearchResult = NonNullable<SearchApiResponse["quotes"]>[number];

const todayStr = () => new Date().toISOString().slice(0, 10);

// Angel One flat brokerage default (₹5 per order on delivery)
const DEFAULT_BROKERAGE = 5;

interface Props {
  open: boolean;
  onClose: () => void;
  cashBalance: number;
  onConfirm: (ticker: string, price: number, qty: number, buyDate: string, chargesPerShare: number) => boolean;
}

export function BuyStockModal({ open, onClose, cashBalance, onConfirm }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<{ name: string; cmp: number } | null>(null);

  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [buyDate, setBuyDate] = useState(todayStr());
  // Separate brokerage and other charges (matching Angel One breakdown)
  const [brokerage, setBrokerage] = useState(String(DEFAULT_BROKERAGE));
  const [otherCharges, setOtherCharges] = useState("0");

  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(""); setDebounced(""); setResults([]); setShowResults(false);
      setPicked(null); setVerified(null); setVerifying(false);
      setPrice(""); setQty("1"); setBuyDate(todayStr());
      setBrokerage(String(DEFAULT_BROKERAGE)); setOtherCharges("0");
      setErr(null); setStep("form");
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
      setPrice(String(q.cmp));
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

  const priceNum = parseFloat(price) || 0;
  const qtyNum = Math.max(0, parseInt(qty) || 0);
  const brokerageNum = Math.max(0, parseFloat(brokerage) || 0);
  const otherChargesNum = Math.max(0, parseFloat(otherCharges) || 0);
  // Total charges for the whole order (not per share)
  const totalCharges = brokerageNum + otherChargesNum;
  // Charges per share = total charges / qty (passed to portfolio logic)
  const chargesPerShareCalc = qtyNum > 0 ? totalCharges / qtyNum : 0;
  const orderValue = priceNum * qtyNum;
  const totalInvested = orderValue + totalCharges;
  // Avg buy price includes charges spread per share
  const avgBuyPrice = qtyNum > 0 ? totalInvested / qtyNum : 0;
  const isInsufficient = totalInvested > cashBalance;

  const handleConfirm = async () => {
    setErr(null);
    if (!picked || !picked.symbol) return setErr("Please pick a stock from the search results");
    if (!verified) return setErr("Stock not yet verified — please wait");
    if (qtyNum <= 0) return setErr("Enter a valid quantity");
    if (priceNum <= 0) return setErr("Enter a valid price");
    if (isInsufficient) return setErr("Insufficient cash balance");
    setSubmitting(true);
    try {
      if (onConfirm(picked!.symbol!, priceNum, qtyNum, buyDate, chargesPerShareCalc)) {
        setStep("success");
        setTimeout(() => onClose(), 1800);
      } else {
        setErr("Order placement failed");
      }
    } catch (e) {
      setErr(`Order failed: ${(e as Error).message}`);
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
            <p className="text-lg font-bold text-foreground">Bought Successfully!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {qtyNum} × {picked?.symbol?.replace(/\.(NS|BO)$/, "")} @ {formatINR(priceNum)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 w-full max-w-xs space-y-2 text-sm">
            {/* Angel One style breakdown */}
            <div className="flex justify-between text-muted-foreground">
              <span>Order Value</span>
              <span className="font-mono">{formatINR(orderValue)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Brokerage</span>
              <span className="font-mono">{formatINR(brokerageNum)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Charges (STT + GST…)</span>
              <span className="font-mono">{formatINR(otherChargesNum)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-muted-foreground">
              <span className="font-semibold text-foreground">Total Invested</span>
              <span className="font-mono font-bold text-foreground">{formatINR(totalInvested)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-xs font-semibold">
              <span>Avg Buy Price (incl. charges)</span>
              <span className="font-mono">{formatINR(avgBuyPrice)}/sh</span>
            </div>
          </div>
        </div>
      </MobileSheet>
    );
  }

  // ── Main order form ───────────────────────────────────────────────────────
  return (
    <MobileSheet open={open} onClose={onClose} title="Buy Stock">
      <div className="space-y-4 pt-1">

        {/* Stock search */}
        {!picked && (
          <div ref={wrapRef} className="space-y-1.5 relative">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symbol</Label>
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
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
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

        {/* Price */}
        <div className="space-y-1.5">
          <Label htmlFor="b-price" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Buy Price (₹)
          </Label>
          <Input
            id="b-price"
            type="number"
            min="0"
            step="0.05"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="font-mono font-semibold text-base"
            placeholder={verified ? String(verified.cmp) : "Enter price"}
          />
        </div>

        {/* Qty + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-qty" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                id="b-qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="text-center px-8 font-mono font-bold text-base"
                min="1"
              />
              <button
                type="button"
                onClick={() => setQty(String(qtyNum + 1))}
                className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-muted hover:bg-accent transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Buy Date
            </Label>
            <Input
              id="b-date"
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        {/* Charges section — Angel One style: Brokerage + Other Charges */}
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transaction Charges</p>
            <Info className="h-3 w-3 text-muted-foreground/60" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Brokerage */}
            <div className="space-y-1.5">
              <Label htmlFor="b-brokerage" className="text-xs text-muted-foreground">
                Brokerage (₹)
              </Label>
              <Input
                id="b-brokerage"
                type="number"
                min="0"
                step="0.01"
                value={brokerage}
                onChange={(e) => setBrokerage(e.target.value)}
                className="font-mono text-sm"
                placeholder="5.00"
              />
            </div>

            {/* STT + GST + others */}
            <div className="space-y-1.5">
              <Label htmlFor="b-other-charges" className="text-xs text-muted-foreground">
                Charges (STT+GST…)
              </Label>
              <Input
                id="b-other-charges"
                type="number"
                min="0"
                step="0.01"
                value={otherCharges}
                onChange={(e) => setOtherCharges(e.target.value)}
                className="font-mono text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Total charges line */}
          {totalCharges > 0 && (
            <div className="flex justify-between text-xs pt-0.5 border-t border-border">
              <span className="text-muted-foreground">Total Charges</span>
              <span className="font-mono font-semibold">{formatINR(totalCharges)}</span>
            </div>
          )}
        </div>

        {/* Angel One-style order summary */}
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Order Value</span>
              <span className="font-mono">{formatINR(orderValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Brokerage</span>
              <span className="font-mono">{formatINR(brokerageNum)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Charges (STT + GST…)</span>
              <span className="font-mono">{formatINR(otherChargesNum)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between font-semibold">
              <span>Total Invested</span>
              <span className={`font-mono text-base ${isInsufficient ? "text-destructive" : "text-foreground"}`}>
                {formatINR(totalInvested)}
              </span>
            </div>
            {priceNum > 0 && qtyNum > 0 && (
              <>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Avg Buy Price (incl. charges)</span>
                  <span className="font-mono">{formatINR(avgBuyPrice)}/sh</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Available Balance</span>
              <span className={`font-mono font-semibold ${isInsufficient ? "text-destructive" : "text-foreground"}`}>
                {formatINR(cashBalance)}
              </span>
            </div>
          </div>
          {isInsufficient && (
            <p className="text-xs text-destructive font-medium">Short by {formatINR(totalInvested - cashBalance)}</p>
          )}
        </div>

        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {err}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 border-border" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-foreground text-background hover:bg-foreground/90 font-bold"
            onClick={handleConfirm}
            disabled={!verified || verifying || isInsufficient || qtyNum <= 0 || priceNum <= 0 || submitting}
          >
            {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Placing…</> : "Buy"}
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
