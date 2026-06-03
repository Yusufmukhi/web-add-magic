import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinance } from "@/context/FinanceContext";
import { formatINR } from "@/lib/finance/format";
import type { SavingsSource } from "@/lib/finance/types";
import { CategorySelect } from "./CategorySelect";
import { AmountInput, DateField, Field, todayISO } from "./form-fields";
import { ConfirmDelete } from "./ConfirmDelete";

export function SavingsTab() {
  const finance = useFinance();
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<SavingsSource>("allocate");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return toast.error("Pick a category");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const r = finance.addSavings({ date, amount: amt, category, description, source });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Savings +${formatINR(amt)}`);
    setAmount("");
    setDescription("");
  };

  return (
    <div className="space-y-4">
      <Card className="border-sky-500/30 bg-sky-500/5">
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">Total Savings</span>
          <span className="text-2xl font-semibold text-sky-600 dark:text-sky-400">
            {formatINR(finance.totals.savings)}
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
              <CategorySelect kind="savings" value={category} onChange={setCategory} />
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Source">
                <Tabs value={source} onValueChange={(v) => setSource(v as SavingsSource)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="allocate">
                      Allocate from Free Cash
                    </TabsTrigger>
                    <TabsTrigger value="new">Add New Cash</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
              <p className="mt-1 text-xs text-muted-foreground">
                {source === "allocate"
                  ? `Available Free Cash: ${formatINR(finance.totals.freeCash)}`
                  : "Adds to both Free Cash and Savings balance."}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full">
                Add Savings
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
                  <TableHead>Source</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {finance.savings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No savings recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  finance.savings.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-xs">{s.date}</TableCell>
                      <TableCell>{s.category}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatINR(s.amount)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.source === "allocate" ? "From Free Cash" : "New Cash"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {s.description}
                      </TableCell>
                      <TableCell>
                        <ConfirmDelete
                          onConfirm={() => {
                            const before = finance.savings.length;
                            finance.deleteSavings(s.id);
                            if (finance.savings.length === before && s.source === "new") {
                              toast.error("Cannot delete: would make Free Cash negative");
                            } else {
                              toast.success("Savings removed");
                            }
                          }}
                        >
                          <Button variant="ghost" size="icon">
                            <Trash2 className="size-4" />
                          </Button>
                        </ConfirmDelete>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
