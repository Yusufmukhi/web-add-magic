import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatINR } from "@/utils/formatters";
import { useDividends } from "@/hooks/useDividends";
import { toast } from "sonner";

export function DividendsPanel() {
  const { dividends, addDividend, removeDividend } = useDividends();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ticker: "",
    date: new Date().toISOString().slice(0, 10),
    perShare: 0,
    shares: 0,
  });

  const totals = useMemo(() => {
    const total = dividends.reduce((s, d) => s + d.perShare * d.shares, 0);
    const byYear = new Map<string, number>();
    for (const d of dividends) {
      const y = d.date.slice(0, 4);
      byYear.set(y, (byYear.get(y) ?? 0) + d.perShare * d.shares);
    }
    return { total, byYear: [...byYear.entries()].sort(([a], [b]) => b.localeCompare(a)) };
  }, [dividends]);

  const submit = () => {
    if (!form.ticker.trim() || form.perShare <= 0 || form.shares <= 0) {
      toast.error("Fill all fields");
      return;
    }
    addDividend({ ...form, ticker: form.ticker.toUpperCase().trim() });
    setOpen(false);
    setForm({ ticker: "", date: new Date().toISOString().slice(0, 10), perShare: 0, shares: 0 });
    toast.success("Dividend recorded");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 creative:shadow-soft minimal:rounded-none">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Dividends Received</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-gain">{formatINR(totals.total)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 creative:shadow-soft minimal:rounded-none">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">By Year</div>
          {totals.byYear.length === 0 ? (
            <div className="text-sm text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-1 font-mono text-sm">
              {totals.byYear.map(([y, v]) => (
                <li key={y} className="flex justify-between"><span>{y}</span><span>{formatINR(v)}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">💸 Dividend Tracker</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 minimal:rounded-none"><Plus className="h-3.5 w-3.5" />Record Dividend</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Dividend</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Ticker</Label><Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} className="font-mono" /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Per Share (₹)</Label><Input type="number" step="0.01" value={form.perShare || ""} onChange={(e) => setForm({ ...form, perShare: +e.target.value })} /></div>
              <div><Label>Shares</Label><Input type="number" value={form.shares || ""} onChange={(e) => setForm({ ...form, shares: +e.target.value })} /></div>
              <div className="rounded border border-border bg-muted/30 p-2 font-mono text-sm">
                Total: {formatINR(form.perShare * form.shares)}
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Ticker</th>
              <th className="px-3 py-2.5 text-right font-medium">Per Share</th>
              <th className="px-3 py-2.5 text-right font-medium">Shares</th>
              <th className="px-3 py-2.5 text-right font-medium">Total</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {dividends.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No dividends recorded yet.</td></tr>
            ) : dividends.map((d) => (
              <tr key={d.id} className="border-b border-border hover:bg-accent/30">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.date}</td>
                <td className="px-3 py-2 font-mono font-semibold">{d.ticker}</td>
                <td className="px-3 py-2 text-right font-mono">{formatINR(d.perShare)}</td>
                <td className="px-3 py-2 text-right font-mono">{d.shares}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-gain">{formatINR(d.perShare * d.shares)}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => removeDividend(d.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-loss" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
