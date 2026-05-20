import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatINR } from "@/utils/formatters";
import { useGoals } from "@/hooks/useGoals";
import { toast } from "sonner";

interface Props {
  portfolioValue: number;
}

export function GoalsPanel({ portfolioValue }: Props) {
  const { goals, addGoal, removeGoal, updateProgress } = useGoals();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    target: 0,
    current: 0,
    targetDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });

  const submit = () => {
    if (!form.name.trim() || form.target <= 0) {
      toast.error("Enter name and target amount");
      return;
    }
    addGoal(form);
    setOpen(false);
    setForm({ name: "", target: 0, current: 0, targetDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) });
    toast.success("Goal added");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">🎯 Goal-Based Investing</h3>
          <p className="text-xs text-muted-foreground">Portfolio value: <span className="font-mono">{formatINR(portfolioValue)}</span></p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 minimal:rounded-none"><Plus className="h-3.5 w-3.5" />Add Goal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Goal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Retirement, House…" /></div>
              <div><Label>Target Amount (₹)</Label><Input type="number" value={form.target || ""} onChange={(e) => setForm({ ...form, target: +e.target.value })} /></div>
              <div><Label>Current Progress (₹)</Label><Input type="number" value={form.current || ""} onChange={(e) => setForm({ ...form, current: +e.target.value })} /></div>
              <div><Label>Target Date</Label><Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Add Goal</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground creative:shadow-soft minimal:rounded-none">
          No goals yet. Add your first financial goal.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(100, (g.current / g.target) * 100);
            const daysLeft = Math.max(0, Math.floor((Date.parse(g.targetDate) - Date.now()) / 86400000));
            return (
              <div key={g.id} className="rounded-2xl border border-border bg-card p-4 creative:shadow-soft minimal:rounded-none">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-display text-base font-semibold">{g.name}</h4>
                    <p className="text-xs text-muted-foreground">{daysLeft} days left · target {g.targetDate}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeGoal(g.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-loss" />
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  <Progress value={pct} />
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-muted-foreground">{formatINR(g.current)} / {formatINR(g.target)}</span>
                    <span className={pct >= 100 ? "text-gain font-semibold" : "text-foreground"}>{pct.toFixed(1)}%</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Update progress"
                    onBlur={(e) => {
                      const v = +e.target.value;
                      if (v > 0) {
                        updateProgress(g.id, v);
                        e.currentTarget.value = "";
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
