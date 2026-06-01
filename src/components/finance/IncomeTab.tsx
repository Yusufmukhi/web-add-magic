import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFinance } from "@/hooks/useFinance";
import type { IncomeEntry, IncomeFrequency } from "@/types/finance.types";
import { toast } from "sonner";

const FREQUENCIES: { value: IncomeFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one-time", label: "One-Time" },
];

const EMPTY_FORM = {
  source: "",
  amount: "",
  frequency: "monthly" as IncomeFrequency,
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function IncomeTab() {
  const { incomeEntries, addIncome, updateIncome, deleteIncome } = useFinance();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(entry: IncomeEntry) {
    setEditId(entry.id);
    setForm({
      source: entry.source,
      amount: String(entry.amount),
      frequency: entry.frequency,
      date: entry.date,
      notes: entry.notes ?? "",
    });
    setOpen(true);
  }

  function handleSave() {
    if (!form.source.trim() || !form.amount) {
      toast.error("Source and amount are required");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (editId) {
      updateIncome(editId, {
        source: form.source.trim(),
        amount,
        frequency: form.frequency,
        date: form.date,
        notes: form.notes || undefined,
      });
      toast.success("Income updated");
    } else {
      addIncome({
        source: form.source.trim(),
        amount,
        frequency: form.frequency,
        date: form.date,
        notes: form.notes || undefined,
      });
      toast.success("Income added");
    }
    setOpen(false);
  }

  const total = incomeEntries.reduce((s, e) => {
    if (e.frequency === "monthly") return s + e.amount;
    if (e.frequency === "quarterly") return s + e.amount / 3;
    if (e.frequency === "yearly") return s + e.amount / 12;
    return s;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Income Sources
          </h2>
          <p className="text-xs text-muted-foreground">
            Monthly equivalent: {fmt(total)}
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {incomeEntries.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          No income entries yet. Click Add to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {[...incomeEntries]
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {entry.source}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.date} ·{" "}
                    {FREQUENCIES.find((f) => f.value === entry.frequency)
                      ?.label ?? entry.frequency}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-500 text-sm">
                    {fmt(entry.amount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(entry)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => {
                      deleteIncome(entry.id);
                      toast.success("Income deleted");
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit Income" : "Add Income"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Source</label>
              <Input
                value={form.source}
                onChange={(e) =>
                  setForm((f) => ({ ...f, source: e.target.value }))
                }
                placeholder="e.g. Salary, Freelance…"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Amount (₹)</label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Frequency</label>
              <Select
                value={form.frequency}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, frequency: v as IncomeFrequency }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Notes (optional)
              </label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Optional notes…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
