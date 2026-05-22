import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  /** The exact string the user must type to enable the confirm button. */
  confirmWord: string;
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * Reusable type-to-confirm dialog. Used to gate every destructive action
 * (delete portfolio, delete holding, edit holding, clear watchlist, import backup).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmWord,
  confirmLabel = "Confirm",
  destructive = true,
}: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const matches = value.trim() === confirmWord;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            {destructive && <AlertTriangle className="h-5 w-5 text-loss" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-input" className="text-xs">
            To proceed, type{" "}
            <span className="font-mono font-semibold text-foreground">{confirmWord}</span>{" "}
            below.
          </Label>
          <Input
            id="confirm-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={confirmWord}
            autoFocus
            className="font-mono"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!matches}
            onClick={() => {
              if (!matches) return;
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
