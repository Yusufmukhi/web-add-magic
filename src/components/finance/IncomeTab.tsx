import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFinance } from "@/context/FinanceContext";
import { formatINR } from "@/lib/finance/format";
import { CategorySelect } from "./CategorySelect";
import { AmountInput, DateField, Field, todayISO } from "./form-fields";
import { ConfirmDelete } from "./ConfirmDelete";

export function IncomeTab() {
  const finance = useFinance();
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return toast.error("Pick a category");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const r = finance.addIncome({ date, amount: amt, category, description });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Income +${formatINR(amt)}`);
    setAmount("");
    setDescription("");
  };

  // Category limit check (per category)
  const categoryTotals: Record<string, number> = {};
  for (const i of finance.income) {
    categoryTotals[i.category] = (categoryTotals[i.category] ?? 0) + i.amount;
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">Total Income</span>
          <span className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatINR(finance.totals.income)}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <DateField value={date} onChange={setDate} />
            </Field>
            <Field label="Amount (₹)">
              <AmountInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Category">
              <CategorySelect kind="income" value={category} onChange={setCategory} />
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full">
                Add Income
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {finance.income.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No income recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  finance.income.map((i) => {
                    const limit = finance.limits[i.category];
                    const over =
                      limit && limit > 0 && (categoryTotals[i.category] ?? 0) > limit;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="whitespace-nowrap text-xs">{i.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {i.category}
                            {over && (
                              <Badge variant="destructive" className="text-[10px]">
                                over limit
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatINR(i.amount)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {i.description}
                        </TableCell>
                        <TableCell>
                          <ConfirmDelete
                            onConfirm={() => {
                              finance.deleteIncome(i.id);
                              toast.success("Income removed");
                            }}
                          >
                            <Button variant="ghost" size="icon">
                              <Trash2 className="size-4" />
                            </Button>
                          </ConfirmDelete>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
