import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchQuote } from "@/services/api";
import { formatINR } from "@/utils/formatters";

const todayStr = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onClose: () => void;
  cashBalance: number;
  onConfirm: (ticker: string, price: number, qty: number, buyDate: string) => boolean;
}

export function BuyStockModal({ open, onClose, cashBalance, onConfirm }: Props) {
  const [ticker, setTicker] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [buyDate, setBuyDate] = useState(todayStr());
  const [err, setErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => { if (open) { setBuyDate(todayStr()); setErr(null); } }, [open]);

  const total = (parseFloat(price) || 0) * (parseInt(qty) || 0);

  const onTickerBlur = async () => {
    if (!ticker || ticker.length < 2) return;
    setFetching(true);
    try {
      const q = await fetchQuote(ticker.toUpperCase());
      if (q.cmp) setPrice(String(q.cmp));
    } catch { /* ignore */ }
    finally { setFetching(false); }
  };

  const handle = () => {
    const t = ticker.trim().toUpperCase();
    const p = parseFloat(price);
    const q = parseInt(qty);
    if (!t || !p || !q || p <= 0 || q <= 0) return setErr("Fill all fields correctly");
    if (p * q > cashBalance) return setErr("Insufficient cash balance");
    if (onConfirm(t, p, q, buyDate)) {
      setTicker(""); setPrice(""); setQty("");
      onClose();
    } else setErr("Buy failed");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">🟢 Buy Stock</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="b-tk">Ticker (NSE)</Label>
            <Input
              id="b-tk"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onBlur={onTickerBlur}
              placeholder="RELIANCE"
              autoFocus
              className="font-mono"
            />
            {fetching && <p className="text-xs text-muted-foreground">Fetching price…</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-pr">Price (₹)</Label>
            <Input id="b-pr" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-qty">Quantity</Label>
            <Input id="b-qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="b-dt">Buy Date</Label>
            <Input id="b-dt" type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
          </div>
          <div className="col-span-2 flex justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-mono font-semibold">{formatINR(total)}</span>
          </div>
          <div className="col-span-2 text-xs text-muted-foreground">
            Cash available: <span className="font-mono">{formatINR(cashBalance)}</span>
          </div>
          {err && <p className="col-span-2 text-xs text-loss">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} className="bg-gain text-primary-foreground hover:bg-gain/90">Buy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
