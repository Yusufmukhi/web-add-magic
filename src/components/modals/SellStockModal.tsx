import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Holding } from "@/types/portfolio.types";
import { formatINR, formatNumber } from "@/utils/formatters";

const todayStr = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onClose: () => void;
  portfolio: Holding[];
  prices: Record<string, number>;
  prefillTicker?: string | null;
  onConfirm: (ticker: string, price: number, qty: number, sellDate: string) => boolean;
}

export function SellStockModal({ open, onClose, portfolio, prices, prefillTicker, onConfirm }: Props) {
  const [ticker, setTicker] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [sellDate, setSellDate] = useState(todayStr());
  const [err, setErr] = useState<string | null>(null);

  const holding = useMemo(() => portfolio.find((h) => h.ticker === ticker), [portfolio, ticker]);

  useEffect(() => {
    if (!open) return;
    setSellDate(todayStr());
    setErr(null);
    const t = prefillTicker ?? portfolio[0]?.ticker ?? "";
    setTicker(t);
    if (t && prices[t]) setPrice(String(prices[t]));
  }, [open, prefillTicker, portfolio, prices]);

  useEffect(() => {
    if (ticker && prices[ticker]) setPrice(String(prices[ticker]));
  }, [ticker, prices]);

  const total = (parseFloat(price) || 0) * (parseInt(qty) || 0);
  const profit = holding ? (parseFloat(price) - holding.avgPrice) * (parseInt(qty) || 0) : 0;

  const handle = () => {
    const p = parseFloat(price);
    const q = parseInt(qty);
    if (!ticker || !p || !q) return setErr("Fill all fields");
    if (!holding || q > holding.qty) return setErr("Insufficient shares");
    if (onConfirm(ticker, p, q, sellDate)) {
      setQty(""); setPrice("");
      onClose();
    } else setErr("Sell failed");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">🔴 Sell Stock</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2 space-y-1.5">
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
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="s-dt">Sell Date</Label>
            <Input id="s-dt" type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} />
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono font-semibold">{formatINR(total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">P&amp;L</span><span className={`font-mono font-semibold ${profit >= 0 ? "text-gain" : "text-loss"}`}>{profit >= 0 ? "+" : ""}{formatNumber(profit, 2)}</span></div>
          </div>
          {err && <p className="col-span-2 text-xs text-loss">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handle}>Sell</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
