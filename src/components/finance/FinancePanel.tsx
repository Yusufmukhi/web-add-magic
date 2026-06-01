import { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, DollarSign,
  Plus, Trash2, Target, Settings2, BarChart3, ChevronDown,
  ChevronUp, CreditCard, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useFinanceState } from "@/hooks/useFinance";
import { formatINR, formatIndianNumber } from "@/utils/formatters";
import { cn } from "@/lib/utils";

// ─── Colour palette ──────────────────────────────────────────────────────────
const EXPENSE_COLORS = [
  "#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6",
  "#ec4899","#06b6d4","#84cc16","#f97316","#14b8a6",
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[+m - 1]} ${y.slice(2)}`;
}

// ─── Mini card ───────────────────────────────────────────────────────────────
function FinCard({
  label, value, sub, icon: Icon, positive, className,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; positive?: boolean; className?: string;
}) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 flex items-start gap-3 transition-shadow hover:shadow-soft creative:hover:shadow-glow",
      className
    )}>
      <div className={cn(
        "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg",
        positive === true ? "bg-gain/15 text-gain" :
        positive === false ? "bg-loss/15 text-loss" :
        "bg-primary/10 text-primary"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Overview tab ────────────────────────────────────────────────────────────
function OverviewTab({ finance }: { finance: ReturnType<typeof useFinanceState> }) {
  const {
    state, monthlyIncome, monthlyExpenses, monthlySavings,
    totalIncome, totalExpenses, totalSaved, freeCash, walletBalance, savingsBalance,
  } = finance;

  // Build last-6-months trend data
  const trendData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym = d.toISOString().slice(0, 7);
      const inc = state.incomes.filter(x => x.date.startsWith(ym)).reduce((a,x)=>a+x.amount,0);
      const exp = state.expenses.filter(x => x.date.startsWith(ym)).reduce((a,x)=>a+x.amount,0);
      const sav = state.savings.filter(x => x.date.startsWith(ym)).reduce((a,x)=>a+x.amount,0);
      return { month: monthLabel(ym), income: inc, expenses: exp, savings: sav };
    });
  }, [state]);

  // Expense breakdown by category
  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    const ym = new Date().toISOString().slice(0, 7);
    state.expenses.filter(e => e.date.startsWith(ym)).forEach(e => {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, fill: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }));
  }, [state.expenses]);

  const netWorth = freeCash;
  const alloc = state.settings.allocation;
  const spendLimit = alloc.monthlySpendLimit || monthlyIncome * (alloc.spendingPct / 100);
  const spendUsed = monthlyExpenses / Math.max(spendLimit, 1) * 100;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FinCard label="Free Cash" value={formatINR(freeCash)} icon={Wallet}
          positive={freeCash >= 0} sub="all time" />
        <FinCard label="Wallet" value={formatINR(walletBalance)} icon={CreditCard}
          positive={walletBalance >= 0} sub="this month" />
        <FinCard label="Savings" value={formatINR(totalSaved)} icon={PiggyBank}
          positive sub="accumulated" />
        <FinCard label="Net Worth" value={formatINR(netWorth)} icon={TrendingUp}
          positive={netWorth >= 0} sub="income − spent" />
      </div>

      {/* Spend limit bar */}
      {spendLimit > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Monthly Spend Limit</span>
            <span className={cn("font-mono text-xs", spendUsed > 90 ? "text-loss" : "text-muted-foreground")}>
              {formatINR(monthlyExpenses)} / {formatINR(spendLimit)}
            </span>
          </div>
          <Progress value={Math.min(spendUsed, 100)}
            className={cn("h-2", spendUsed > 90 && "[&>div]:bg-loss")} />
        </div>
      )}

      {/* Monthly snapshot */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold">This Month</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-gain/10 p-2">
            <p className="font-bold text-gain text-base">{formatINR(monthlyIncome)}</p>
            <p className="text-muted-foreground">Income</p>
          </div>
          <div className="rounded-lg bg-loss/10 p-2">
            <p className="font-bold text-loss text-base">{formatINR(monthlyExpenses)}</p>
            <p className="text-muted-foreground">Expenses</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <p className="font-bold text-primary text-base">{formatINR(monthlySavings)}</p>
            <p className="text-muted-foreground">Saved</p>
          </div>
        </div>
      </div>

      {/* 6-month trend */}
      {trendData.some(d => d.income > 0 || d.expenses > 0) && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">6-Month Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData} barSize={10} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => formatINR(v)}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" fill="#10b981" radius={[3,3,0,0]} name="Income" />
              <Bar dataKey="expenses" fill="#ef4444" radius={[3,3,0,0]} name="Expenses" />
              <Bar dataKey="savings" fill="#6366f1" radius={[3,3,0,0]} name="Savings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Expense pie */}
      {catData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Expense Breakdown (This Month)</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={catData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {catData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ fontSize: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-1 text-xs shrink-0 w-full sm:w-auto">
              {catData.slice(0, 6).map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.fill }} />
                  <span className="truncate text-muted-foreground">{c.name}</span>
                  <span className="ml-auto font-mono font-medium">{formatINR(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Goals */}
      {state.settings.goals.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Savings Goals</p>
          {state.settings.goals.map((g) => {
            const pct = Math.min((g.saved / Math.max(g.target, 1)) * 100, 100);
            return (
              <div key={g.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-muted-foreground">{formatINR(g.saved)} / {formatINR(g.target)}</span>
                </div>
                <Progress value={pct} className="h-1.5" style={{ ["--progress-color" as string]: g.color }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Income tab ──────────────────────────────────────────────────────────────
function IncomeTab({ finance }: { finance: ReturnType<typeof useFinanceState> }) {
  const { state, addIncome, removeIncome } = finance;
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 7));
  const [note, setNote] = useState("");

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !source.trim()) return;
    addIncome(amt, source.trim(), date, note.trim() || undefined);
    setAmount(""); setSource(""); setNote("");
  };

  const totalIncome = state.incomes.reduce((a, i) => a + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-gain" /> Add Income
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Amount (₹)" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="text-sm" />
          <Input placeholder="Source (e.g. Salary)" value={source} onChange={e => setSource(e.target.value)} className="text-sm" />
          <Input type="month" value={date} onChange={e => setDate(e.target.value)} className="text-sm" />
          <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="text-sm" />
        </div>
        <Button size="sm" onClick={handleAdd} className="w-full gap-1.5">
          <ArrowUpCircle className="h-3.5 w-3.5" /> Add Income
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm font-semibold">Income History</p>
          <span className="text-xs text-gain font-mono">Total: {formatINR(totalIncome)}</span>
        </div>
        {state.incomes.length === 0 ? (
          <p className="text-center py-6 text-xs text-muted-foreground">No income entries yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {state.incomes.map((inc) => (
              <li key={inc.id} className="flex items-center justify-between py-2 px-1 group">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{inc.source}</p>
                  <p className="text-xs text-muted-foreground">{monthLabel(inc.date)}{inc.note ? ` · ${inc.note}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm text-gain">{formatINR(inc.amount)}</span>
                  <button onClick={() => removeIncome(inc.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss transition-opacity">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Expenses tab ────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Food","Transport","Shopping","Entertainment","Health","Utilities",
  "Rent","Education","Travel","Subscriptions","Others",
];

function ExpensesTab({ finance }: { finance: ReturnType<typeof useFinanceState> }) {
  const { state, addExpense, removeExpense } = finance;
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [customCat, setCustomCat] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [wallet, setWallet] = useState<"spending" | "free">("spending");
  const [note, setNote] = useState("");

  const handleAdd = () => {
    const amt = parseFloat(amount);
    const cat = customCat.trim() || category;
    if (!amt || amt <= 0) return;
    addExpense(amt, cat, date, wallet, note.trim() || undefined);
    setAmount(""); setNote(""); setCustomCat("");
  };

  const totalExpenses = state.expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-loss" /> Add Expense
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Amount (₹)" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="text-sm" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input placeholder="Custom category (optional)" value={customCat} onChange={e => setCustomCat(e.target.value)} className="text-sm" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm" />
          <select value={wallet} onChange={e => setWallet(e.target.value as "spending" | "free")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="spending">Spending Wallet</option>
            <option value="free">Free Cash</option>
          </select>
          <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="text-sm" />
        </div>
        <Button size="sm" onClick={handleAdd} variant="destructive" className="w-full gap-1.5">
          <ArrowDownCircle className="h-3.5 w-3.5" /> Add Expense
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm font-semibold">Expense History</p>
          <span className="text-xs text-loss font-mono">Total: {formatINR(totalExpenses)}</span>
        </div>
        {state.expenses.length === 0 ? (
          <p className="text-center py-6 text-xs text-muted-foreground">No expenses logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {state.expenses.map((exp) => (
              <li key={exp.id} className="flex items-center justify-between py-2 px-1 group">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{exp.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {exp.date} · {exp.wallet === "spending" ? "Wallet" : "Free Cash"}
                    {exp.note ? ` · ${exp.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm text-loss">{formatINR(exp.amount)}</span>
                  <button onClick={() => removeExpense(exp.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss transition-opacity">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Savings tab ─────────────────────────────────────────────────────────────
const GOAL_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4"];

function SavingsTab({ finance }: { finance: ReturnType<typeof useFinanceState> }) {
  const { state, addSavings, removeSavings, addGoal, removeGoal } = finance;
  const [amount, setAmount] = useState("");
  const [goalId, setGoalId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  // goal form
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState("");
  const [gDeadline, setGDeadline] = useState("");
  const [gColor, setGColor] = useState(GOAL_COLORS[0]);
  const [showGoalForm, setShowGoalForm] = useState(false);

  const handleAddSavings = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    addSavings(amt, date, goalId || undefined, note.trim() || undefined);
    setAmount(""); setNote("");
  };

  const handleAddGoal = () => {
    const tgt = parseFloat(gTarget);
    if (!gName.trim() || !tgt || tgt <= 0) return;
    addGoal(gName.trim(), tgt, gDeadline || undefined, gColor);
    setGName(""); setGTarget(""); setGDeadline("");
    setShowGoalForm(false);
  };

  const totalSaved = state.savings.reduce((a, s) => a + s.amount, 0);

  return (
    <div className="space-y-4">
      {/* Saving goals */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" /> Savings Goals
          </p>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
            onClick={() => setShowGoalForm(v => !v)}>
            <Plus className="h-3 w-3" /> Goal
          </Button>
        </div>
        {showGoalForm && (
          <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/40">
            <Input placeholder="Goal name" value={gName} onChange={e => setGName(e.target.value)} className="text-sm" />
            <Input placeholder="Target (₹)" type="number" value={gTarget} onChange={e => setGTarget(e.target.value)} className="text-sm" />
            <Input type="date" value={gDeadline} onChange={e => setGDeadline(e.target.value)} className="text-sm" placeholder="Deadline (optional)" />
            <div className="flex gap-1.5 items-center">
              {GOAL_COLORS.map(c => (
                <button key={c} className={cn("h-5 w-5 rounded-full border-2 transition-transform", gColor === c ? "scale-125 border-foreground" : "border-transparent")}
                  style={{ background: c }} onClick={() => setGColor(c)} />
              ))}
            </div>
            <Button size="sm" onClick={handleAddGoal} className="col-span-2 h-7 text-xs">Create Goal</Button>
          </div>
        )}
        {state.settings.goals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No goals yet. Create one above!</p>
        ) : (
          state.settings.goals.map(g => {
            const pct = Math.min((g.saved / Math.max(g.target, 1)) * 100, 100);
            return (
              <div key={g.id} className="space-y-1 group">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                    {g.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{pct.toFixed(0)}% · {formatINR(g.saved)}/{formatINR(g.target)}</span>
                    <button onClick={() => removeGoal(g.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })
        )}
      </div>

      {/* Add saving entry */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-primary" /> Log Savings
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Amount (₹)" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="text-sm" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm" />
          <select value={goalId} onChange={e => setGoalId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">No goal</option>
            {state.settings.goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="text-sm" />
        </div>
        <Button size="sm" onClick={handleAddSavings} className="w-full gap-1.5">
          <PiggyBank className="h-3.5 w-3.5" /> Log Savings
        </Button>
      </div>

      {/* History */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm font-semibold">Savings History</p>
          <span className="text-xs text-primary font-mono">Total: {formatINR(totalSaved)}</span>
        </div>
        {state.savings.length === 0 ? (
          <p className="text-center py-6 text-xs text-muted-foreground">No savings logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {state.savings.map((sv) => {
              const goalName = state.settings.goals.find(g => g.id === sv.goalId)?.name;
              return (
                <li key={sv.id} className="flex items-center justify-between py-2 px-1 group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{goalName ?? "General savings"}</p>
                    <p className="text-xs text-muted-foreground">{sv.date}{sv.note ? ` · ${sv.note}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-sm text-primary">{formatINR(sv.amount)}</span>
                    <button onClick={() => removeSavings(sv.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Allocation / Settings tab ────────────────────────────────────────────────
function AllocTab({ finance }: { finance: ReturnType<typeof useFinanceState> }) {
  const { state, updateAllocation } = finance;
  const alloc = state.settings.allocation;

  const freePct = Math.max(0, 100 - alloc.spendingPct - alloc.savingsPct);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5 text-primary" /> Wallet Allocation
        </p>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <label className="w-32 shrink-0 text-muted-foreground">Spending %</label>
            <Input type="number" min={0} max={100} value={alloc.spendingPct}
              onChange={e => updateAllocation({ spendingPct: Math.min(100, +e.target.value) })}
              className="w-24 text-sm" />
            <span className="text-xs text-muted-foreground">of monthly income → spending wallet</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="w-32 shrink-0 text-muted-foreground">Savings %</label>
            <Input type="number" min={0} max={100} value={alloc.savingsPct}
              onChange={e => updateAllocation({ savingsPct: Math.min(100, +e.target.value) })}
              className="w-24 text-sm" />
            <span className="text-xs text-muted-foreground">of monthly income → savings wallet</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="w-32 shrink-0 text-muted-foreground">Spend Limit</label>
            <Input type="number" min={0} value={alloc.monthlySpendLimit || ""}
              placeholder="Auto"
              onChange={e => updateAllocation({ monthlySpendLimit: +e.target.value || 0 })}
              className="w-24 text-sm" />
            <span className="text-xs text-muted-foreground">₹ hard cap / month (0 = auto)</span>
          </div>
        </div>

        {/* Visual split */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Income split preview</p>
          <div className="flex h-4 w-full overflow-hidden rounded-full gap-0.5">
            <div className="bg-loss h-full rounded-l-full transition-all" style={{ width: `${alloc.spendingPct}%` }} title={`Spending ${alloc.spendingPct}%`} />
            <div className="bg-primary h-full transition-all" style={{ width: `${alloc.savingsPct}%` }} title={`Savings ${alloc.savingsPct}%`} />
            <div className="bg-gain h-full rounded-r-full transition-all" style={{ width: `${freePct}%` }} title={`Free ${freePct}%`} />
          </div>
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-loss inline-block"/>Spending {alloc.spendingPct}%</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-primary inline-block"/>Savings {alloc.savingsPct}%</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-gain inline-block"/>Free {freePct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function FinancePanel() {
  const finance = useFinanceState();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight creative:bg-gradient-to-r creative:from-foreground creative:to-primary creative:bg-clip-text creative:text-transparent">
            PocketWise
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track income, savings, wallet & expenses in ₹</p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider mt-1">Finance</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="inline-flex h-auto w-full bg-card creative:shadow-soft">
          <TabsTrigger value="overview" className="flex-1 text-xs gap-1">
            <BarChart3 className="h-3 w-3" /> Overview
          </TabsTrigger>
          <TabsTrigger value="income" className="flex-1 text-xs gap-1">
            <TrendingUp className="h-3 w-3" /> Income
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1 text-xs gap-1">
            <TrendingDown className="h-3 w-3" /> Expenses
          </TabsTrigger>
          <TabsTrigger value="savings" className="flex-1 text-xs gap-1">
            <PiggyBank className="h-3 w-3" /> Savings
          </TabsTrigger>
          <TabsTrigger value="alloc" className="flex-1 text-xs gap-1">
            <Settings2 className="h-3 w-3" /> Allocate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab finance={finance} />
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          <IncomeTab finance={finance} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab finance={finance} />
        </TabsContent>
        <TabsContent value="savings" className="mt-4">
          <SavingsTab finance={finance} />
        </TabsContent>
        <TabsContent value="alloc" className="mt-4">
          <AllocTab finance={finance} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
