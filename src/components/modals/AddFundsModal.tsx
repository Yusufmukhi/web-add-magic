import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/utils/formatters";

interface Props {
  open: boolean;
  onClose: () => void;
  cashBalance: number;
  onConfirm: (amount: number) => void;
}

export function AddFundsModal({ open, onClose, cashBalance, onConfirm }: Props) {
  const [amount, setAmount] = useState("");
  const handle = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onConfirm(n);
    setAmount("");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handle}>Add Funds</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
