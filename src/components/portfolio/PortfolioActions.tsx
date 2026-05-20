import { useRef } from "react";
import { Plus, Minus, ShoppingCart, ArrowDownToLine, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onAddFunds: () => void;
  onWithdraw: () => void;
  onBuy: () => void;
  onSell: () => void;
  onExportCSV: () => void;
  onImportCSV?: (file: File) => void;
  canSell: boolean;
  canExport: boolean;
}

export function PortfolioActions({
  onAddFunds, onWithdraw, onBuy, onSell, onExportCSV, onImportCSV, canSell, canExport,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onAddFunds} variant="outline" className="gap-2 minimal:rounded-none">
        <Plus className="h-4 w-4" /> Add Funds
      </Button>
      <Button onClick={onWithdraw} variant="outline" className="gap-2 minimal:rounded-none">
        <ArrowDownToLine className="h-4 w-4" /> Withdraw
      </Button>
      <Button onClick={onBuy} className="gap-2 bg-gain text-primary-foreground hover:bg-gain/90 minimal:rounded-none">
        <ShoppingCart className="h-4 w-4" /> Buy
      </Button>
      <Button onClick={onSell} disabled={!canSell} variant="destructive" className="gap-2 minimal:rounded-none">
        <Minus className="h-4 w-4" /> Sell
      </Button>
      <div className="ml-auto flex gap-2">
        {onImportCSV && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportCSV(f);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              variant="outline"
              className="gap-2 minimal:rounded-none"
              title="Import CSV: columns ticker, qty, price, date"
            >
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
          </>
        )}
        <Button
          onClick={onExportCSV}
          disabled={!canExport}
          variant="outline"
          className="gap-2 minimal:rounded-none"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>
    </div>
  );
}
