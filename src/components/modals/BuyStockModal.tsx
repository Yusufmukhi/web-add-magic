import { useEffect, useRef, useState } from "react";
import { Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
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
  /** ticker may include .NS / .BO suffix to disambiguate exchange. */
  onConfirm: (ticker: string, price: number, qty: number, buyDate: string) => boolean;
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
  const [qty, setQty] = useState("");
  const [buyDate, setBuyDate] = useState(todayStr());
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(""); setDebounced(""); setResults([]); setShowResults(false);
      setPicked(null); setVerified(null); setVerifying(false);
      setPrice(""); setQty(""); setBuyDate(todayStr()); setErr(null);
    }
  }, [open]);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Run search
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

  // Cross-check + auto-fill price when a result is picked
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

  const total = (parseFloat(price) || 0) * (parseInt(qty) || 0);

  const handle = async () => {
    setErr(null);
    if (!picked || !picked.symbol) return setErr("Please pick a stock from the search results");
    if (!verified) return setErr("Stock not yet verified — please wait");
    const p = parseFloat(price);
    const q = parseInt(qty);
    if (!p || !q || p <= 0 || q <= 0) return setErr("Enter a valid price and quantity");
    if (p * q > cashBalance) return setErr("Insufficient cash balance");

    // Final cross-check right before buying — catches typos in manual price edits
    setSubmitting(true);
    try {
      await fetchQuote(picked.symbol); // throws if delisted / invalid
      if (onConfirm(picked.symbol, p, q, buyDate)) {
        onClose();
      } else {
        setErr("Buy failed");
      }
    } catch (e) {
      setErr(`Stock check failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileSheet open={open} onClose={onClose} title="🟢 Buy Stock">
      <div className="space-y-3 py-2">
        {/* Search field */}
        <div ref={wrapRef} className="space-y-1.5 relative">
          <Label htmlFor="b-search">Search by name or ticker (NSE / BSE)</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="b-search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (picked) { setPicked(null); setVerified(null); setPrice(""); } }}
              onFocus={() => results.length && !picked && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              placeholder="Enter Stock Name"
              autoFocus
              className="pl-10 pr-10"
            />
            {(searching || verifying) && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {showResults && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  type="button"
                  onClick={() => handlePick(r)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">
                        {r.symbol?.replace(/\.(NS|BO)$/, "")}
                      </span>
                      <Badge variant={r.exchange === "NSE" ? "default" : "secondary"} className="h-4 px-1.5 text-[10px]">
                        {r.exchange}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.longname || r.shortname}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showResults && !searching && results.length === 0 && debounced.length >= 2 && (
            <p className="text-xs text-muted-foreground">No matches on NSE / BSE.</p>
          )}

          {picked && (
            <div className="mt-1 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              {verifying ? (
                <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : verified ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-gain" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-loss" />
              )}
              <div className="flex-1">
                <div className="font-mono font-semibold">
                  {picked.symbol} <span className="ml-1 text-[10px] text-muted-foreground">({picked.exchange})</span>
                </div>
                <div className="text-muted-foreground">
                  {verifying ? "Verifying on Yahoo Finance…"
                    : verified ? `${verified.name} · LTP ${formatINR(verified.cmp)}`
                    : "Could not verify"}
                </div>
              </div>
              <button type="button" onClick={clearPick} className="text-xs text-muted-foreground hover:text-foreground">
                Change
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-pr">Price (₹)</Label>
            <Input id="b-pr" type="number" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!picked} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-qty">Quantity</Label>
            <Input id="b-qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} disabled={!picked} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="b-dt">Buy Date</Label>
          <Input id="b-dt" type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
        </div>

        <div className="flex justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono font-semibold">{formatINR(total)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Cash available: <span className="font-mono">{formatINR(cashBalance)}</span>
        </div>
        {err && <p className="text-xs text-loss">{err}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            className="flex-1 bg-gain text-primary-foreground hover:bg-gain/90"
            onClick={handle}
            disabled={!verified || verifying || submitting}
          >
            {submitting ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Buying…</> : "Buy"}
          </Button>
        </div>
      
    </MobileSheet>
  );
}
