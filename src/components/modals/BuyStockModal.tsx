import { useEffect, useRef, useState } from "react";
import { Loader2, Search, CheckCircle2, AlertCircle, Plus, Minus, Info, TrendingUp } from "lucide-react";
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

interface Props {
  open: boolean;
  onClose: () => void;
  cashBalance: number;
  onConfirm: (ticker: string, price: number, qty: number, buyDate: string, chargesPerShare: number) => boolean;
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

  // Order fields
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [buyDate, setBuyDate] = useState(todayStr());
  const [chargesPerShare, setChargesPerShare] = useState("0");

  // UI state
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(""); setDebounced(""); setResults([]); setShowResults(false);
      setPicked(null); setVerified(null); setVerifying(false);
      setPrice(""); setQty("1"); setBuyDate(todayStr());
      setChargesPerShare("0"); setErr(null); setStep("form");
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
  const chargesNum = Math.max(0, parseFloat(chargesPerShare) || 0);
  const gross = priceNum * qtyNum;
  const totalCharges = chargesNum * qtyNum;
  const totalInvested = gross + totalCharges;
  const isInsufficient = totalInvested > cashBalance;

  const handleReview = () => {
    setErr(null);
    if (!picked || !picked.symbol) return setErr("Please pick a stock from the search results");
    if (!verified) return setErr("Stock not yet verified — please wait");
    if (qtyNum <= 0) return setErr("Enter a valid quantity");
    if (priceNum <= 0) return setErr("Enter a valid price");
    if (isInsufficient) return setErr("Insufficient cash balance");
    setStep("confirm");
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      if (onConfirm(picked!.symbol!, priceNum, qtyNum, buyDate, chargesNum)) {
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

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <MobileSheet open={open} onClose={onClose} title="">
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">Buy Order Placed!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {qtyNum} × {picked?.symbol?.replace(/\.(NS|BO)$/, "")} @ {formatINR(priceNum)}
            </p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/8 px-4 py-2 text-sm space-y-1 w-full max-w-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Total Invested</span>
              <span className="font-mono font-bold text-foreground">{formatINR(totalInvested)}</span>
            </div>
            {totalCharges > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>incl. charges</span>
                <span className="font-mono">{formatINR(totalCharges)}</span>
              </div>
            )}
          </div>
        </div>
      </MobileSheet>
    );
  }

  // ── Confirm screen ────────────────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <MobileSheet open={open} onClose={onClose} title="Confirm Buy Order">
        <div className="py-3 space-y-4">
          {/* Stock header */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-base">{picked?.symbol?.replace(/\.(NS|BO)$/, "")}</p>
                <p className="text-xs text-muted-foreground">{verified?.name}</p>
              </div>
              <Badge className="bg-green-500/15 text-green-600 border-green-500/30 font-bold">BUY</Badge>
            </div>

            <div className="h-px bg-border" />

            {/* Order summary grid */}
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
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Buy Date</p>
                <p className="font-semibold">{buyDate}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Charges / Share</p>
                <p className="font-mono font-semibold">{formatINR(chargesNum)}</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Cost breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gross Amount</span>
                <span className="font-mono">{formatINR(gross)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Charges</span>
                <span className="font-mono">{formatINR(totalCharges)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between font-semibold">
                <span>Total Invested</span>
                <span className="font-mono text-base">{formatINR(totalInvested)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Balance After</span>
                <span className="font-mono text-green-600">{formatINR(Math.max(0, cashBalance - totalInvested))}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Review carefully. This will deduct {formatINR(totalInvested)} from your cash balance.</span>
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
              {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Placing…</> : "Confirm Buy"}
            </Button>
          </div>
        </div>
      </MobileSheet>
    );
  }

  // ── Main order form ───────────────────────────────────────────────────────
  return (
    <MobileSheet open={open} onClose={onClose} title="">
      {/* Green header */}
      <div className="-mx-4 -mt-4 mb-5 bg-green-600 px-4 py-3 flex items-center justify-between">
        <div>
          {picked && verified ? (
            <>
              <p className="font-mono text-sm font-bold text-white">{picked.symbol?.replace(/\.(NS|BO)$/, "")}</p>
              <p className="text-xs text-green-100 truncate max-w-[180px]">{verified.name}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Buy Stock
              </p>
              <p className="text-xs text-green-100">Search and add to portfolio</p>
            </>
          )}
        </div>
        {verified && (
          <div className="text-right">
            <p className="font-mono text-base font-bold text-white">{formatINR(verified.cmp)}</p>
            <p className="text-[10px] text-green-100">LTP</p>
          </div>
        )}
      </div>

      <div className="space-y-4">

        {/* ── Stock search ── */}
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

        {/* ── Price field ── */}
        <div className="space-y-1.5">
          <Label htmlFor="b-price" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Price per Share (₹)
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
          {verified && priceNum !== verified.cmp && priceNum > 0 && (
            <p className="text-[11px] text-muted-foreground">
              LTP: {formatINR(verified.cmp)} · diff {priceNum > verified.cmp ? "+" : ""}{((priceNum - verified.cmp) / verified.cmp * 100).toFixed(2)}%
            </p>
          )}
        </div>

        {/* ── Qty + Date row ── */}
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

        {/* ── Charges per share ── */}
        <div className="space-y-1.5">
          <Label htmlFor="b-charges" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Charges per Share (₹)
            <span className="ml-1.5 normal-case font-normal text-muted-foreground">(brokerage + STT + GST etc.)</span>
          </Label>
          <Input
            id="b-charges"
            type="number"
            min="0"
            step="0.01"
            value={chargesPerShare}
            onChange={(e) => setChargesPerShare(e.target.value)}
            className="font-mono"
            placeholder="0"
          />
        </div>

        {/* ── Details / Cost breakdown ── */}
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Order Details</p>

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gross Amount</span>
              <span className="font-mono">{formatINR(gross)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Total Charges
                {qtyNum > 0 && chargesNum > 0 && (
                  <span className="text-[11px] ml-1 opacity-70">({qtyNum} × {formatINR(chargesNum)})</span>
                )}
              </span>
              <span className="font-mono">{formatINR(totalCharges)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between font-semibold">
              <span>Total Invested</span>
              <span className={`font-mono text-base ${isInsufficient ? "text-destructive" : "text-foreground"}`}>
                {formatINR(totalInvested)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Available Balance</span>
              <span className={`font-mono font-semibold ${isInsufficient ? "text-destructive" : "text-green-600"}`}>
                {formatINR(cashBalance)}
              </span>
            </div>
          </div>

          {isInsufficient && (
            <p className="text-xs text-destructive font-medium">
              Short by {formatINR(totalInvested - cashBalance)}
            </p>
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
            disabled={!verified || verifying || isInsufficient || qtyNum <= 0 || priceNum <= 0}
          >
            Review Order
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
