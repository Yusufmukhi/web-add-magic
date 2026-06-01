import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { useFinance } from "@/hooks/useFinance";
import type { SavingsCategory } from "@/types/finance.types";
import { toast } from "sonner";

const CATEGORIES: { value: SavingsCategory; label: string }[] = [
  { value: "emergency", label: "Emergency Fund" },
  { value: "retirement", label: "Retirement" },
  { value: "education", label: "Education" },
  { value: "vacation", label: "Vacation" },
  { value: "home", label: "Home" },
  { value: "car", label: "Car" },
  { value: "wedding", label: "Wedding" },
  { value: "custom", label: "Custom" },
];

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const EMPTY_GOAL_FORM = {
  name: "",
  targetAmount: "",
  category: "custom" as SavingsCategory,
  targetDate: "",
  notes: "",
};

const EMPTY_DEPOSIT_FORM = {
  goalId: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export function SavingsTab() {
  const {
    settings,
    savingsDeposits,
    addSavingsGoal,
    deleteSavingsGoal,
    addSavingsDeposit,
    deleteSavingsDeposit,
  } = useFinance();

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL_FORM);
  const [depositForm, setDepositForm] = useState(EMPTY_DEPOSIT_FORM);

  function handleAddGoal() {
    if (!goalForm.name.trim() || !goalForm.targetAmount) {
      toast.error("Name and target amount are required");
      return;
    }
    const target = parseFloat(goalForm.targetAmount);
    if (isNaN(target) || target <= 0) {
      toast.error("Enter a valid target amount");
      return;
    }
    addSavingsGoal({
      name: goalForm.name.trim(),
      targetAmount: target,
      currentAmount: 0,
      category: goalForm.category,
      targetDate: goalForm.targetDate || undefined,
      notes: goalForm.notes || undefined,
    });
    toast.success("Goal added");
    setGoalForm(EMPTY_GOAL_FORM);
    setGoalDialogOpen(false);
  }

  function handleAddDeposit() {
    if (!depositForm.goalId || !depositForm.amount) {
      toast.error("Goal and amount are required");
      return;
    }
    const amount = parseFloat(depositForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    addSavingsDeposit({
      goalId: depositForm.goalId,
      amount,
      date: depositForm.date,
      notes: depositForm.notes || undefined,
    });
    toast.success("Deposit recorded");
    setDepositForm(EMPTY_DEPOSIT_FORM);
    setDepositDialogOpen(false);
  }

  const goals = settings.savingsGoals;
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Savings Goals
          </h2>
          <p className="text-xs text-muted-foreground">
            Total saved: {fmt(totalSaved)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDepositForm(EMPTY_DEPOSIT_FORM);
              setDepositDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Deposit
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setGoalForm(EMPTY_GOAL_FORM);
              setGoalDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Goal
          </Button>
        </div>
      </div>

      {goals.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          No savings goals yet. Click Goal to create one.
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const pct = goal.targetAmount
              ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
              : 0;
            return (
              <div
                key={goal.id}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {goal.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {goal.category}
                      {goal.targetDate ? ` · Due ${goal.targetDate}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-violet-500">
                      {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        deleteSavingsGoal(goal.id);
                        toast.success("Goal deleted");
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <Progress value={pct} className="h-1.5" />
                <p className="text-xs text-muted-foreground text-right">
                  {pct.toFixed(0)}% complete
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent deposits */}
      {savingsDeposits.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Recent Deposits
          </h3>
          {[...savingsDeposits]
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .slice(0, 10)
            .map((d) => {
              const goal = goals.find((g) => g.id === d.goalId);
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-2.5"
                >
                  <div>
                    <p className="text-sm text-foreground">
                      {goal?.name ?? "Unknown Goal"}
                    </p>
                    <p className="text-xs text-muted-foreground">{d.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-violet-500">
                      +{fmt(d.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => {
                        deleteSavingsDeposit(d.id);
                        toast.success("Deposit removed");
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Add Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Savings Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Goal Name</label>
              <Input
                value={goalForm.name}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Emergency Fund"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Target Amount (₹)
              </label>
              <Input
                type="number"
                value={goalForm.targetAmount}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, targetAmount: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Select
                value={goalForm.category}
                onValueChange={(v) =>
                  setGoalForm((f) => ({
                    ...f,
                    category: v as SavingsCategory,
                  }))
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
                Target Date (optional)
              </label>
              <Input
                type="date"
                value={goalForm.targetDate}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, targetDate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGoalDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddGoal}>Add Goal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deposit Dialog */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Goal</label>
              <Select
                value={depositForm.goalId}
                onValueChange={(v) =>
                  setDepositForm((f) => ({ ...f, goalId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a goal" />
                </SelectTrigger>
                <SelectContent>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Amount (₹)</label>
              <Input
                type="number"
                value={depositForm.amount}
                onChange={(e) =>
                  setDepositForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <Input
                type="date"
                value={depositForm.date}
                onChange={(e) =>
                  setDepositForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDepositDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddDeposit}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
