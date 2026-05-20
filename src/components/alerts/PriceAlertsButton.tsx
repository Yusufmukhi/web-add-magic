import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import type { QuoteResult } from "@/hooks/useStockQuote";
import { formatINR } from "@/utils/formatters";

interface Props {
  quotes: QuoteResult[];
}

export function PriceAlertsButton({ quotes }: Props) {
  const { alerts, add, remove, markTriggered, reset } = usePriceAlerts();
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    quotes.forEach((q) => { if (q.data) m[q.ticker] = q.data.cmp; });
    return m;
  }, [quotes]);

  // Check for triggers
  useEffect(() => {
    alerts.forEach((a) => {
      if (a.triggered) return;
      const cmp = priceMap[a.ticker];
      if (cmp == null) return;
      const hit = a.direction === "above" ? cmp >= a.target : cmp <= a.target;
      if (hit) {
        markTriggered(a.id);
        toast.success(`🔔 ${a.ticker} ${a.direction} ₹${a.target.toFixed(2)} — now ${formatINR(cmp)}`, {
          duration: 8000,
        });
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`${a.ticker} alert`, {
            body: `${a.ticker} is now ${formatINR(cmp)} (target: ₹${a.target.toFixed(2)})`,
          });
        }
      }
    });
  }, [priceMap, alerts, markTriggered]);

  const handleAdd = () => {
    const t = ticker.trim().toUpperCase();
    const p = parseFloat(target);
    if (!t || isNaN(p) || p <= 0) {
      toast.error("Enter a valid ticker and target price");
      return;
    }
    add(t, p, direction);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setTicker("");
    setTarget("");
    toast.success(`Alert set for ${t}`);
  };

  const activeCount = alerts.filter((a) => !a.triggered).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Price Alerts">
          {activeCount > 0 ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4" />}
          {activeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Price Alerts</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2">
            <Input
              placeholder="TICKER"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <Select value={direction} onValueChange={(v) => setDirection(v as "above" | "below")}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Above</SelectItem>
                <SelectItem value="below">Below</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Target ₹"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="font-mono"
            />
            <Button onClick={handleAdd} size="icon"><Plus className="h-4 w-4" /></Button>
          </div>

          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No alerts yet. Set one above to get notified when a stock hits your target.
              </p>
            ) : (
              alerts.map((a) => {
                const cmp = priceMap[a.ticker];
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{a.ticker}</span>
                      <Badge variant={a.direction === "above" ? "default" : "secondary"} className="text-[10px]">
                        {a.direction} ₹{a.target.toFixed(2)}
                      </Badge>
                      {a.triggered && (
                        <Badge variant="outline" className="border-gain text-gain text-[10px]">triggered</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {cmp != null ? formatINR(cmp) : "—"}
                      </span>
                      {a.triggered && (
                        <Button variant="ghost" size="sm" onClick={() => reset(a.id)} className="h-7 text-xs">
                          Re-arm
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => remove(a.id)} className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5 text-loss" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
