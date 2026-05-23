import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { Holding } from "@/types/portfolio.types";
import { formatINR, formatNumber } from "@/utils/formatters";
import { computeSellCharges, DEFAULT_SELL_RATES } from "@/utils/finance";

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
  const [brokerage, setBrokerage] = useState(String(DEFAULT_SELL_RATES.brokerage));
  const [dp, setDp] = useState(String(DEFAULT_SELL_RATES.dpCharges));
  const [chargesOpen, setChargesOpen] = useState(false);

  const holding = useMemo(() => portfolio.find((h) => h.ticker === ticker), [portfolio, ticker]);

  useEffect(() => {
    if (!open) return;
    setSellDate(todayStr());
    setErr(null);
    setBrokerage(String(DEFAULT_SELL_RATES.brokerage));
    setDp(String(DEFAULT_SELL_RATES.dpCharges));
    setChargesOpen(false);
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
  const charges = useMemo(
    () =>
      computeSellCharges(gross, {
        brokerage: parseFloat(brokerage) || 0,
        dpCharges: parseFloat(dp) || 0,
      }),
    [gross, brokerage, dp]
  );
  const netProceeds = gross - charges.total;
  const grossProfit = holding ? (p - holding.avgPrice) * q : 0;
  const netProfit = grossProfit - charges.total;

  const handle = () => {
    if (!ticker || !p || !q) return setErr("Fill all fields");
    if (!holding || q > holding.qty) return setErr("Insufficient shares");
    if (onConfirm(ticker, p, q, sellDate, charges.total)) {
      setQty(""); setPrice("");
      onClose();
    } else setErr("Sell failed");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">🔴 Sell Stock</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Stock</Label>
            <Select value={ticker} onValueChange={setTicker}>
              <SelectTrigger><SelectValue placeholder="Select holding" /></SelectTrigger>
              <SelectContent>
                {portfolio.map((h) => (
                  <SelectItem key={h.ticker} value={h.ticker}>
                    {h.ticker} ({h.qty} shares @ {formatINR(h.avgPrice)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

          <Collapsible
            open={chargesOpen}
            onOpenChange={setChargesOpen}
            className="sm:col-span-2 rounded-lg border border-border bg-muted/30"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm">
              <span className="font-medium">
                Charges (NSE delivery):{" "}
                <span className="font-mono text-loss">−{formatINR(charges.total)}</span>
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${chargesOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 border-t border-border px-3 py-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="s-brk" className="text-xs">Brokerage (₹)</Label>
                  <Input id="s-brk" type="number" min="0" step="0.01" value={brokerage}
                    onChange={(e) => setBrokerage(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-dp" className="text-xs">DP charges (₹)</Label>
                  <Input id="s-dp" type="number" min="0" step="0.01" value={dp}
                    onChange={(e) => setDp(e.target.value)} className="h-8" />
                </div>
              </div>
              <ul className="space-y-0.5 text-xs font-mono text-muted-foreground">
                <li className="flex justify-between"><span>Brokerage</span><span>{formatINR(charges.brokerage)}</span></li>
                <li className="flex justify-between"><span>STT (0.10%)</span><span>{formatINR(charges.stt)}</span></li>
                <li className="flex justify-between"><span>Exchange txn</span><span>{formatINR(charges.exchTxn)}</span></li>
                <li className="flex justify-between"><span>SEBI</span><span>{formatINR(charges.sebi)}</span></li>
                <li className="flex justify-between"><span>GST (18%)</span><span>{formatINR(charges.gst)}</span></li>
                <li className="flex justify-between"><span>DP charges</span><span>{formatINR(charges.dpCharges)}</span></li>
                <li className="flex justify-between border-t border-border pt-1 font-semibold text-foreground">
                  <span>Total charges</span><span>{formatINR(charges.total)}</span>
                </li>
              </ul>
            </CollapsibleContent>
          </Collapsible>

          <div className="sm:col-span-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="font-mono">{formatINR(gross)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Net credit</span><span className="font-mono font-semibold">{formatINR(netProceeds)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Gross P&amp;L</span><span className={`font-mono ${grossProfit >= 0 ? "text-gain" : "text-loss"}`}>{grossProfit >= 0 ? "+" : ""}{formatNumber(grossProfit, 2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Net P&amp;L</span><span className={`font-mono font-semibold ${netProfit >= 0 ? "text-gain" : "text-loss"}`}>{netProfit >= 0 ? "+" : ""}{formatNumber(netProfit, 2)}</span></div>
          </div>
          {err && <p className="sm:col-span-2 text-xs text-loss">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handle}>Sell</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
