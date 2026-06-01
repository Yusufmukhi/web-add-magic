import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFinance } from "@/hooks/useFinance";
import type { WalletAllocation } from "@/types/finance.types";
import { toast } from "sonner";

const PALETTE = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
];

const EMPTY_ALLOC = { label: "", amount: "", color: PALETTE[0] };

export function SettingsTab() {
  const {
    settings,
    updateSettings,
    addWalletAllocation,
    updateWalletAllocation,
    deleteWalletAllocation,
  } = useFinance();

  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [editAllocId, setEditAllocId] = useState<string | null>(null);
  const [allocForm, setAllocForm] = useState(EMPTY_ALLOC);

  function openAddAlloc() {
    setEditAllocId(null);
    setAllocForm(EMPTY_ALLOC);
    setAllocDialogOpen(true);
  }

  function openEditAlloc(alloc: WalletAllocation) {
    setEditAllocId(alloc.id);
    setAllocForm({
      label: alloc.label,
      amount: String(alloc.amount),
      color: alloc.color,
    });
    setAllocDialogOpen(true);
  }

  function handleSaveAlloc() {
    if (!allocForm.label.trim() || !allocForm.amount) {
      toast.error("Label and amount are required");
      return;
    }
    const amount = parseFloat(allocForm.amount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (editAllocId) {
      updateWalletAllocation(editAllocId, {
        label: allocForm.label.trim(),
        amount,
        color: allocForm.color,
      });
      toast.success("Wallet allocation updated");
    } else {
      addWalletAllocation({
        label: allocForm.label.trim(),
        amount,
        color: allocForm.color,
      });
      toast.success("Wallet allocation added");
    }
    setAllocDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Configure your PocketWise finance tracker
        </p>
      </div>

      {/* Monthly income budget */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">
          Monthly Income Budget
        </p>
        <Input
          type="number"
          value={settings.monthlyIncomeBudget || ""}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateSettings({
              monthlyIncomeBudget: isNaN(val) ? 0 : val,
            });
          }}
          placeholder="0"
        />
      </div>

      {/* Wallet allocations */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Spending Wallet Allocations
          </p>
          <Button size="sm" variant="outline" onClick={openAddAlloc}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        {settings.walletAllocations.length === 0 ? (
          <p className="text-xs text-muted-foreground">No allocations set.</p>
        ) : (
          <div className="space-y-2">
            {settings.walletAllocations.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-2.5 cursor-pointer"
                onClick={() => openEditAlloc(a)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: a.color }}
                  />
                  <span className="text-sm text-foreground">{a.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    ₹{a.amount.toLocaleString("en-IN")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWalletAllocation(a.id);
                      toast.success("Allocation deleted");
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">About PocketWise</p>
        <p className="text-xs text-muted-foreground">
          PocketWise is your personal finance tracker integrated with Dalal
          Street. All data is stored locally in your browser. The Portfolio Value
          is automatically synced from your Dalal Street brokerage account.
        </p>
        <p className="text-xs text-muted-foreground">
          localStorage keys used: finance_income, finance_savings_deposits,
          finance_expenses, finance_settings — fully isolated from Dalal Street's
          portfolio, cash_balance, and transactions keys.
        </p>
      </div>

      {/* Allocation Dialog */}
      <Dialog open={allocDialogOpen} onOpenChange={setAllocDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editAllocId ? "Edit Allocation" : "Add Allocation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Label</label>
              <Input
                value={allocForm.label}
                onChange={(e) =>
                  setAllocForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="e.g. Needs, Wants…"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Amount (₹ / month)
              </label>
              <Input
                type="number"
                value={allocForm.amount}
                onChange={(e) =>
                  setAllocForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Color</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded-full transition-transform ${
                      allocForm.color === c
                        ? "ring-2 ring-offset-1 ring-foreground scale-110"
                        : ""
                    }`}
                    style={{ background: c }}
                    onClick={() => setAllocForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAlloc}>
              {editAllocId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
