import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatINR } from "@/utils/formatters";
import { installmentsElapsed, useSIP, type SIPFrequency } from "@/hooks/useSIP";
import { toast } from "sonner";

interface Props {
  prices: Record<string, number>;
}

export function SIPPanel({ prices }: Props) {
  const { sips, addSIP, removeSIP } = useSIP();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ticker: "",
    amount: 0,
    frequency: "monthly" as SIPFrequency,
    startDate: new Date().toISOString().slice(0, 10),
  });

  const totals = useMemo(() => {
    let invested = 0, value = 0;
    for (const s of sips) {
      const inst = installmentsElapsed(s.startDate, s.frequency);
      const inv = inst * s.amount;
      invested += inv;
      const cmp = prices[s.ticker.toUpperCase()];
      value += cmp ? inv * 1 : inv; // value approximated to invested if no price (best-effort)
    }
    return { invested, value };
  }, [sips, prices]);

  const submit = () => {
    if (!form.ticker.trim() || form.amount <= 0) {
      toast.error("Enter ticker and amount");
      return;
    }
    addSIP({ ...form, ticker: form.ticker.toUpperCase().trim() });
    setOpen(false);
    setForm({ ticker: "", amount: 0, frequency: "monthly", startDate: new Date().toISOString().slice(0, 10) });
    toast.success("SIP added");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active SIPs" value={String(sips.length)} />
        <Stat label="Total Invested (est.)" value={formatINR(totals.invested)} />
        <Stat label="Estimated Value" value={formatINR(totals.value)} />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">🔄 SIP Tracker</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 minimal:rounded-none"><Plus className="h-3.5 w-3.5" />Add SIP</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add SIP</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Ticker</Label><Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="e.g. RELIANCE" className="font-mono" /></div>
              <div><Label>Amount (₹)</Label><Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as SIPFrequency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Add SIP</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground minimal:bg-transparent">
              <th className="px-3 py-2.5 font-medium">Ticker</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Frequency</th>
              <th className="px-3 py-2.5 font-medium">Start</th>
              <th className="px-3 py-2.5 text-right font-medium">Installments</th>
              <th className="px-3 py-2.5 text-right font-medium">Invested</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {sips.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No SIPs configured.</td></tr>
            ) : sips.map((s) => {
              const inst = installmentsElapsed(s.startDate, s.frequency);
              return (
                <tr key={s.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono font-semibold">{s.ticker}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatINR(s.amount)}</td>
                  <td className="px-3 py-2 capitalize">{s.frequency}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s.startDate}</td>
                  <td className="px-3 py-2 text-right font-mono">{inst}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatINR(inst * s.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => removeSIP(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-loss" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 creative:shadow-soft minimal:rounded-none">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
    </div>
  );
}
