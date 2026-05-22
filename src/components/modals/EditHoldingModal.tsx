import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Holding } from "@/types/portfolio.types";

interface Props {
  open: boolean;
  onClose: () => void;
  holding: Holding | null;
  onConfirm: (
    ticker: string,
    patch: { qty: number; avgPrice: number; buyDate: string }
  ) => void;
}

/**
 * Edit a holding's quantity, avg buy price, and first buy date.
 * The final Save is gated by a type-to-confirm step for safety.
 */
export function EditHoldingModal({ open, onClose, holding, onConfirm }: Props) {
  const [qty, setQty] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [buyDate, setBuyDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && holding) {
      setQty(String(holding.qty));
      setAvgPrice(String(holding.avgPrice));
      setBuyDate(holding.buyDate || new Date().toISOString().slice(0, 10));
      setErr(null);
    }
  }, [open, holding]);

  if (!holding) return null;

  const handleAttemptSave = () => {
    const q = parseFloat(qty);
    const p = parseFloat(avgPrice);
    if (!q || q <= 0) return setErr("Quantity must be greater than 0");
    if (!p || p <= 0) return setErr("Avg price must be greater than 0");
    if (!buyDate) return setErr("Pick a buy date");
    setErr(null);
    setConfirmOpen(true);
  };

  const handleConfirmed = () => {
    onConfirm(holding.ticker, {
      qty: parseFloat(qty),
      avgPrice: parseFloat(avgPrice),
      buyDate,
    });
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              ✏️ Edit {holding.ticker}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-qty">Quantity</Label>
              <Input
                id="e-qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-avg">Avg Buy Price (₹)</Label>
              <Input
                id="e-avg"
                type="number"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="e-date">First Buy Date</Label>
              <Input
                id="e-date"
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Editing only updates the holding row — it does not create a transaction
              or change your cash balance.
            </p>
            {err && <p className="col-span-2 text-xs text-loss">{err}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleAttemptSave}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmed}
        title={`Confirm edit to ${holding.ticker}`}
        description="This will overwrite the existing quantity, average price, and first buy date. There is no automatic transaction entry."
        confirmWord={holding.ticker}
        confirmLabel="Apply changes"
        destructive={false}
      />
    </>
  );
}
