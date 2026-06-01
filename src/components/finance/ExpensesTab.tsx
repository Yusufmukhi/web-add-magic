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
import type {
  ExpenseCategory,
  ExpenseEntry,
  ExpensePaymentMode,
} from "@/types/finance.types";
import { toast } from "sonner";

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "housing", label: "Housing" },
  { value: "food", label: "Food & Dining" },
  { value: "transport", label: "Transport" },
  { value: "utilities", label: "Utilities" },
  { value: "healthcare", label: "Healthcare" },
  { value: "entertainment", label: "Entertainment" },
  { value: "education", label: "Education" },
  { value: "clothing", label: "Clothing" },
  { value: "personal", label: "Personal Care" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "custom", label: "Other" },
];

const PAYMENT_MODES: { value: ExpensePaymentMode; label: string }[] = [
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "netbanking", label: "Net Banking" },
  { value: "emi", label: "EMI" },
];

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const EMPTY_FORM = {
  description: "",
  amount: "",
  category: "food" as ExpenseCategory,
  paymentMode: "upi" as ExpensePaymentMode,
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export function ExpensesTab() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useFinance();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(entry: ExpenseEntry) {
    setEditId(entry.id);
    setForm({
      description: entry.description,
      amount: String(entry.amount),
      category: entry.category,
      paymentMode: entry.paymentMode,
      date: entry.date,
      notes: entry.notes ?? "",
    });
    setOpen(true);
  }

  function handleSave() {
    if (!form.description.trim() || !form.amount) {
      toast.error("Description and amount are required");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (editId) {
      updateExpense(editId, {
        description: form.description.trim(),
        amount,
        category: form.category,
        paymentMode: form.paymentMode,
        date: form.date,
        notes: form.notes || undefined,
      });
      toast.success("Expense updated");
    } else {
      addExpense({
        description: form.description.trim(),
        amount,
        category: form.category,
        paymentMode: form.paymentMode,
        date: form.date,
        notes: form.notes || undefined,
      });
      toast.success("Expense added");
    }
    setOpen(false);
  }

  // Group current month expenses by category
  const now = new Date();
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalThisMonth = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // Category breakdown
  const byCategory = CATEGORIES.map((cat) => {
    const total = thisMonthExpenses
      .filter((e) => e.category === cat.value)
      .reduce((s, e) => s + e.amount, 0);
    return { ...cat, total };
  }).filter((c) => c.total > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Expenses</h2>
          <p className="text-xs text-muted-foreground">
            This month: {fmt(totalThisMonth)}
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {byCategory.map((c) => (
            <div
              key={c.value}
              className="rounded-lg border border-border bg-card p-2.5 flex justify-between items-center"
            >
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <span className="text-sm font-semibold text-foreground">
                {fmt(c.total)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* All expenses */}
      {expenses.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          No expenses yet. Click Add to log one.
        </p>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            All Transactions
          </h3>
          {[...expenses]
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {e.description}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {e.date} · {e.category} · {e.paymentMode}
                  </p>
                  {e.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-500 text-sm">
                    -{fmt(e.amount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(e)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => {
                      deleteExpense(e.id);
                      toast.success("Expense deleted");
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
            <DialogTitle>{editId ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="e.g. Groceries, Rent…"
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
              <label className="text-xs text-muted-foreground">Category</label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as ExpenseCategory }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Payment Mode
              </label>
              <Select
                value={form.paymentMode}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    paymentMode: v as ExpensePaymentMode,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
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
            <Button onClick={handleSave}>{editId ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
