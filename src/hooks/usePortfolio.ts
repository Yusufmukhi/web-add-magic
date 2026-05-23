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
  onConfirm: (amount: number, note?: string) => boolean;
}

export function WithdrawModal({ open, onClose, cashBalance, onConfirm }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const handle = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return setErr("Enter a valid amount");
    if (n > cashBalance) return setErr("Insufficient balance");
    onConfirm(n, note);
    setAmount("");
    setNote("");
    setErr(null);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">🏧 Withdraw Funds</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Available: <span className="font-mono font-semibold">{formatINR(cashBalance)}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="wd-amt">Amount (₹)</Label>
            <Input
              id="wd-amt"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErr(null); }}
              placeholder="10000"
              autoFocus
            />
            {err && <p className="text-xs text-loss">{err}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wd-note">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="wd-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Rent payment, transferred to savings…"
              rows={2}
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handle}>Withdraw</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
