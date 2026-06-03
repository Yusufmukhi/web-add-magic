import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useFinance } from "@/context/FinanceContext";
import { formatINR } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

function statusFor(pct: number) {
  if (pct > 100)
    return { label: "Over Budget", cls: "bg-destructive text-destructive-foreground" };
  if (pct >= 90)
    return {
      label: "Near Limit",
      cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    };
  if (pct >= 70)
    return {
      label: "Warning",
      cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    };
  return {
    label: "On Track",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  };
}

function ResetButton() {
  const finance = useFinance();
  const [stage, setStage] = useState<0 | 1>(0);
  return (
    <AlertDialog onOpenChange={(o) => !o && setStage(0)}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Reset All Data</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {stage === 0 ? "Reset all finance data?" : "Are you absolutely sure?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {stage === 0
              ? "This clears all income, savings, wallets, spends, categories, limits, goals and settings."
              : "This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {stage === 0 ? (
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                setStage(1);
              }}
            >
              Continue
            </Button>
          ) : (
            <AlertDialogAction
              onClick={() => {
                finance.resetAll();
                toast.success("All data reset");
              }}
            >
              Yes, reset everything
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SettingsTab() {
  const finance = useFinance();
  const [threshold, setThreshold] = useState(String(finance.threshold || ""));

  return (
    <div className="space-y-6">
      {/* Spending Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spending Limits (Monthly)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-40">Monthly Limit (₹)</TableHead>
                  <TableHead className="text-right">Spent This Month</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finance.expenseCategories.map((cat) => {
                  const limit = finance.limits[cat] ?? 0;
                  const spent = finance.monthlySpendByCategory[cat] ?? 0;
                  const pct = limit > 0 ? (spent / limit) * 100 : 0;
                  const over = limit > 0 && pct > 100;
                  const status = statusFor(pct);
                  return (
                    <TableRow key={cat} className={cn(over && "bg-destructive/5")}>
                      <TableCell className="font-medium">{cat}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={limit || ""}
                          onChange={(e) =>
                            finance.setLimit(cat, Number(e.target.value) || 0)
                          }
                          placeholder="0"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(spent)}
                      </TableCell>
                      <TableCell>
                        {limit > 0 ? (
                          <Badge variant="outline" className={cn("text-[10px]", status.cls)}>
                            {status.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Savings Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Savings Goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {finance.savingsCategories.map((cat) => {
            const target = finance.goals[cat] ?? 0;
            const saved = finance.savedByCategory[cat] ?? 0;
            const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
            const colorCls =
              target === 0
                ? ""
                : saved === 0
                  ? "[&>div]:bg-destructive"
                  : pct < 50
                    ? "[&>div]:bg-orange-500"
                    : "[&>div]:bg-emerald-500";
            return (
              <div key={cat} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{cat}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatINR(saved)} / {formatINR(target)}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={target || ""}
                      onChange={(e) =>
                        finance.setGoal(cat, Number(e.target.value) || 0)
                      }
                      placeholder="Target"
                      className="h-8 w-28"
                    />
                  </div>
                </div>
                <Progress value={pct} className={colorCls} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Free Cash Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Free Cash Alert Threshold</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Alert me when Free Cash drops below (₹)
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 5000"
                className="mt-1.5"
              />
            </div>
            <Button
              onClick={() => {
                finance.setThreshold(Number(threshold) || 0);
                toast.success("Threshold saved");
              }}
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Currency</span>
            <span className="font-medium">₹ (INR)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Export filename</span>
            <span className="font-mono text-xs">
              finance-export-{new Date().toISOString().slice(0, 10)}.xlsx
            </span>
          </div>
          <ResetButton />
        </CardContent>
      </Card>
    </div>
  );
}
