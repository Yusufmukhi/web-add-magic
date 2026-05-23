import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/utils/formatters";

interface Props {
  open: boolean;
  onClose: () => void;
  cashBalance: number;
  onConfirm: (amount: number, note?: string) => void;
}

export function AddFundsModal({ open, onClose, cashBalance, onConfirm }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const handle = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onConfirm(n, note);
    setAmount("");
    setNote("");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">💰 Add Funds</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Current balance: <span className="font-mono font-semibold">{formatINR(cashBalance)}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="add-amt">Amount (₹)</Label>
            <Input
              id="add-amt"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-note">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="add-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Salary, UPI from HDFC, Diwali bonus…"
              rows={2}
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handle}>Add Funds</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
