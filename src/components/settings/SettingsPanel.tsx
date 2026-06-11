import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Trash2, ListX, AlertTriangle, Pencil, Check, X, Sun, Moon, Monitor, Database, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import type { Holding, Transaction } from "@/types/portfolio.types";
import { SoldStocksPanel } from "@/components/sold/SoldStocksPanel";
import { useTheme } from "@/hooks/useTheme";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { formatINR } from "@/utils/formatters";
import { getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from "@/lib/supabase";

export interface BackupShape {
  version: 1;
  exportedAt: string;
  portfolio: Holding[];
  transactions: Transaction[];
  cashBalance: number;
  watchlist: string[];
}

interface Props {
  portfolio: Holding[];
  transactions: Transaction[];
  cashBalance: number;
  watchlist: string[];
  onResetPortfolio: () => void;
  onClearWatchlist: () => void;
  onImportBackup: (data: BackupShape) => void;
  onAddFunds?: (amount: number) => void;
  onWithdraw?: (amount: number) => void;
}

export function SettingsPanel({
  portfolio,
  transactions,
  cashBalance,
  watchlist,
  onResetPortfolio,
  onClearWatchlist,
  onImportBackup,
  onAddFunds,
  onWithdraw,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const [confirm, setConfirm] = useState<
    | null
    | { kind: "reset" }
    | { kind: "watchlist" }
    | { kind: "import"; data: BackupShape }
  >(null);

  // Cash inline edit
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState("");

  // Broker info stored locally
  const [brokerName, setBrokerName] = useLocalStorage<string>("broker_name", "");
  const [dematAccount, setDematAccount] = useLocalStorage<string>("demat_account", "");

  // Supabase config
  const existingSB = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(existingSB?.url ?? "");
  const [sbKey, setSbKey] = useState(existingSB?.anonKey ?? "");
  const [sbConnected, setSbConnected] = useState(!!existingSB);

  const handleSaveSupabase = () => {
    if (!sbUrl.trim() || !sbKey.trim()) { toast.error("Enter both Supabase URL and anon key"); return; }
    saveSupabaseConfig(sbUrl.trim(), sbKey.trim());
    setSbConnected(true);
    toast.success("Supabase connected! Research data will now be cached for 7 days.");
  };

  const handleDisconnectSupabase = () => {
    clearSupabaseConfig();
    setSbUrl(""); setSbKey(""); setSbConnected(false);
    toast.success("Supabase disconnected");
  };

  const handleExport = () => {
    const data: BackupShape = {
      version: 1,
      exportedAt: new Date().toISOString(),
      portfolio,
      transactions,
      cashBalance,
      watchlist,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dalal-street-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupShape;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray(parsed.portfolio) ||
        !Array.isArray(parsed.transactions) ||
        typeof parsed.cashBalance !== "number" ||
        !Array.isArray(parsed.watchlist)
      ) {
        toast.error("Invalid backup file format");
        return;
      }
      setConfirm({ kind: "import", data: parsed });
    } catch {
      toast.error("Could not read backup file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCashSave = () => {
    const amt = parseFloat(cashInput);
    if (isNaN(amt) || amt < 0) { toast.error("Enter a valid amount"); return; }
    const diff = amt - cashBalance;
    if (diff > 0) onAddFunds?.(diff);
    else if (diff < 0) onWithdraw?.(Math.abs(diff));
    setEditingCash(false);
    toast.success("Cash balance updated");
  };

  return (
    <div className="space-y-6">
      {/* Account: Cash Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Account</CardTitle>
          <CardDescription>Manage your cash balance and broker details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cash Balance</Label>
            {editingCash ? (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder="Enter new balance"
                  type="number"
                  className="h-9 max-w-[200px]"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCashSave()}
                />
                <Button size="icon" className="h-9 w-9" onClick={handleCashSave}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditingCash(false)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-xl font-bold">{formatINR(cashBalance)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => { setCashInput(cashBalance.toFixed(2)); setEditingCash(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="broker-name" className="text-xs text-muted-foreground uppercase tracking-wider">Broker Name</Label>
              <Input
                id="broker-name"
                value={brokerName}
                onChange={(e) => setBrokerName(e.target.value)}
                placeholder="e.g. Zerodha, Groww, Upstox"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demat-account" className="text-xs text-muted-foreground uppercase tracking-wider">Demat Account No.</Label>
              <Input
                id="demat-account"
                value={dematAccount}
                onChange={(e) => setDematAccount(e.target.value)}
                placeholder="e.g. 1234567890"
                className="h-9"
              />
            </div>
          </div>
          {brokerName && (
            <p className="text-xs text-muted-foreground">Tracking via {brokerName}{dematAccount ? ` · ${dematAccount}` : ""}</p>
          )}
        </CardContent>
      </Card>

      {/* Theme Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Appearance</CardTitle>
          <CardDescription>Choose your preferred app theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                theme === "light" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="h-4 w-4" /> Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                theme === "dark" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon className="h-4 w-4" /> Dark
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Backup &amp; Restore</CardTitle>
          <CardDescription>
            Export your full portfolio, transactions, cash, and watchlist as JSON — or restore from a previous backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Export full backup (JSON)
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" /> Import backup (JSON)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
            }}
          />
        </CardContent>
      </Card>

      {/* Sold stocks history */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Sold Stocks</CardTitle>
          <CardDescription>
            Full history of every sell with realized P&amp;L, charges, holding period and tax type. Export to CSV or Excel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SoldStocksPanel transactions={transactions} />
        </CardContent>
      </Card>

      {/* Watchlist tools */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Watchlist</CardTitle>
          <CardDescription>
            You currently have {watchlist.length} ticker{watchlist.length === 1 ? "" : "s"} on your watchlist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setConfirm({ kind: "watchlist" })}
            disabled={watchlist.length === 0}
            className="gap-2"
          >
            <ListX className="h-4 w-4" /> Clear watchlist
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-loss/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-loss">
            <AlertTriangle className="h-5 w-5" /> Danger zone
          </CardTitle>
          <CardDescription>
            These actions permanently erase data from this device. Export a backup first if you might need it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Separator />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Reset entire portfolio</p>
              <p className="text-xs text-muted-foreground">
                Deletes all holdings, transactions and resets cash balance to ₹0.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setConfirm({ kind: "reset" })}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" /> Reset portfolio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Supabase Cloud Cache */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Supabase Cloud Cache
            {sbConnected && <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-0.5 font-medium">Connected</span>}
          </CardTitle>
          <CardDescription>
            Cache AI research reports, stock thesis, smart money data, and theme deep dives for 7 days. Data is stored in your own Supabase project — free tier is more than enough.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sbConnected ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">✅ Supabase connected</p>
                <p>Research reports auto-cached · Smart Money cached · Theme deep dives cached</p>
                <p>Cache TTL: 7 days · On search: Supabase first, Gemini only if cache is stale/missing</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={handleDisconnectSupabase}>
                Disconnect Supabase
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground">Setup (2 minutes, free):</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="h-2.5 w-2.5" /></a> → New project</li>
                  <li>Copy your <strong className="text-foreground">Project URL</strong> from Settings → API</li>
                  <li>Copy your <strong className="text-foreground">anon / public key</strong></li>
                  <li>Run the SQL from <code className="bg-muted px-1 rounded">src/lib/supabase.ts</code> in SQL Editor</li>
                </ol>
              </div>
              <div className="grid gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Project URL</Label>
                  <Input placeholder="https://xyzxyz.supabase.co" value={sbUrl}
                    onChange={(e) => setSbUrl(e.target.value)} className="text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Anon / Public Key</Label>
                  <Input placeholder="eyJhbGciOiJI..." value={sbKey} type="password"
                    onChange={(e) => setSbKey(e.target.value)} className="text-xs font-mono" />
                </div>
              </div>
              <Button size="sm" className="gap-1.5" onClick={handleSaveSupabase}>
                <Database className="h-3.5 w-3.5" /> Connect Supabase
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirm?.kind === "reset"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          onResetPortfolio();
          toast.success("Portfolio reset");
        }}
        title="Reset entire portfolio?"
        description="This will permanently delete all holdings, transactions, and your cash balance from this device. This cannot be undone."
        confirmWord="DELETE"
        confirmLabel="Reset everything"
      />

      <ConfirmDialog
        open={confirm?.kind === "watchlist"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          onClearWatchlist();
          toast.success("Watchlist cleared");
        }}
        title="Clear watchlist?"
        description="This removes every ticker from your watchlist. Your portfolio holdings are not affected."
        confirmWord="CLEAR"
        confirmLabel="Clear watchlist"
      />

      <ConfirmDialog
        open={confirm?.kind === "import"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "import") {
            onImportBackup(confirm.data);
            toast.success("Backup restored");
          }
        }}
        title="Restore from backup?"
        description="This will OVERWRITE your current portfolio, transactions, cash balance, and watchlist with the contents of the backup file."
        confirmWord="IMPORT"
        confirmLabel="Restore backup"
      />
    </div>
  );
}
