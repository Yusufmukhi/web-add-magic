import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Trash2, ListX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import type { Holding, Transaction } from "@/types/portfolio.types";
import { SoldStocksPanel } from "@/components/sold/SoldStocksPanel";

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
}

export function SettingsPanel({
  portfolio,
  transactions,
  cashBalance,
  watchlist,
  onResetPortfolio,
  onClearWatchlist,
  onImportBackup,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<
    | null
    | { kind: "reset" }
    | { kind: "watchlist" }
    | { kind: "import"; data: BackupShape }
  >(null);

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

  return (
    <div className="space-y-6">
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

      {/* Confirm dialogs (type-to-confirm) */}
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
