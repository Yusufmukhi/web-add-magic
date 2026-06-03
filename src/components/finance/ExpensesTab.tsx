import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

function WalletForm() {
  const finance = useFinance();
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return toast.error("Enter a label");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const r = finance.addWallet({ date, label: label.trim(), amount: amt, description });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Allocated ${formatINR(amt)} to "${label}"`);
    setLabel("");
    setAmount("");
    setDescription("");
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Date">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Label">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Weekly Groceries"
        />
      </Field>
      <Field label="Amount (₹)">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Description">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
        />
      </Field>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Available Free Cash: {formatINR(finance.totals.freeCash)}
      </p>
      <div className="sm:col-span-2">
        <Button type="submit" className="w-full">
          Allocate to Wallet
        </Button>
      </div>
    </form>
  );
}

function SpendForm() {
  const finance = useFinance();
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [walletId, setWalletId] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletId) return toast.error("Choose a wallet allocation");
    if (!category) return toast.error("Pick a category");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const r = finance.addSpend({ date, amount: amt, category, description, walletId });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Spend recorded: ${formatINR(amt)}`);
    setAmount("");
    setDescription("");
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Date">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Amount (₹)">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Category">
        <CategorySelect kind="expense" value={category} onChange={setCategory} />
      </Field>
      <Field label="Linked Wallet">
        <Select value={walletId} onValueChange={setWalletId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a wallet" />
          </SelectTrigger>
          <SelectContent>
            {finance.wallet.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Allocate a wallet first
              </div>
            ) : (
              finance.wallet.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.label} — remaining {formatINR(finance.walletRemaining(w.id))}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
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
          Log Spend
        </Button>
      </div>
    </form>
  );
}

function StatusBadge({ pct }: { pct: number }) {
  if (pct > 100)
    return <Badge variant="destructive" className="text-[10px]">Over Budget</Badge>;
  if (pct >= 90)
    return (
      <Badge className="border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-300 text-[10px]">
        Near Limit
      </Badge>
    );
  if (pct >= 70)
    return (
      <Badge className="border-yellow-500/30 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 text-[10px]">
        Warning
      </Badge>
    );
  return (
    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">
      On Track
    </Badge>
  );
}

export function ExpensesTab() {
  const finance = useFinance();
  const { allocated, spends, walletBalance } = finance.totals;

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="grid grid-cols-3 gap-2 py-4 text-center">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Allocated
            </div>
            <div className="text-lg font-semibold tabular-nums">{formatINR(allocated)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Spent
            </div>
            <div className="text-lg font-semibold tabular-nums">{formatINR(spends)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Remaining
            </div>
            <div className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {formatINR(walletBalance)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">A. Spending Wallet — Allocate Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <WalletForm />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {finance.wallet.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No wallets yet
                    </TableCell>
                  </TableRow>
                ) : (
                  finance.wallet.map((w) => {
                    const remaining = finance.walletRemaining(w.id);
                    const spent = w.amount - remaining;
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(w.amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(spent)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(remaining)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{w.date}</TableCell>
                        <TableCell>
                          <ConfirmDelete
                            description="If this wallet has logged spends, delete those first."
                            onConfirm={() => {
                              const before = finance.wallet.length;
                              finance.deleteWallet(w.id);
                              if (finance.wallet.length === before) {
                                toast.error("Delete linked spends first");
                              } else {
                                toast.success("Wallet removed");
                              }
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">B. Log a Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendForm />
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
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {finance.spends.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No spends logged yet
                    </TableCell>
                  </TableRow>
                ) : (
                  finance.spends.map((s) => {
                    const w = finance.wallet.find((x) => x.id === s.walletId);
                    const limit = finance.limits[s.category];
                    const monthSpent = finance.monthlySpendByCategory[s.category] ?? 0;
                    const pct = limit ? (monthSpent / limit) * 100 : 0;
                    const over = limit && limit > 0 && pct > 100;
                    return (
                      <TableRow
                        key={s.id}
                        className={cn(over && "bg-destructive/5")}
                      >
                        <TableCell className="whitespace-nowrap text-xs">{s.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {s.category}
                            {over ? <StatusBadge pct={pct} /> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {w?.label ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatINR(s.amount)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {s.description}
                        </TableCell>
                        <TableCell>
                          <ConfirmDelete
                            onConfirm={() => {
                              finance.deleteSpend(s.id);
                              toast.success("Spend removed");
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
