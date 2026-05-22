import { useRef } from "react";
import { Plus, Minus, ShoppingCart, ArrowDownToLine, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  onAddFunds: () => void;
  onWithdraw: () => void;
  onBuy: () => void;
  onSell: () => void;
  onExportExcel: () => void;
  onImportExcel?: (file: File) => void;
  canSell: boolean;
  canExport: boolean;
}

export function PortfolioActions({
  onAddFunds, onWithdraw, onBuy, onSell, onExportExcel, onImportExcel, canSell, canExport,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <TooltipProvider delayDuration={300}>
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
          {onImportExcel && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportExcel(f);
                  e.target.value = "";
                }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => fileRef.current?.click()}
                    variant="outline"
                    className="gap-2 minimal:rounded-none"
                  >
                    <Upload className="h-4 w-4" /> Import Excel
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  <p className="font-semibold mb-1">📥 Import Holdings from Excel</p>
                  <p className="mb-1">Supports two formats:</p>
                  <p className="font-medium text-teal-400">① Broker Export (Angel One, Zerodha, etc.)</p>
                  <p className="text-muted-foreground mb-1">Upload your broker's holdings Excel directly — no changes needed.</p>
                  <p className="font-medium text-teal-400">② Custom Excel</p>
                  <ul className="mt-0.5 space-y-0.5 list-disc list-inside text-muted-foreground">
                    <li><strong>Ticker</strong> — Stock symbol (e.g. RELIANCE)</li>
                    <li><strong>Qty</strong> — Number of shares</li>
                    <li><strong>Price</strong> — Average buy price (₹)</li>
                    <li><strong>Date</strong> — Buy date (optional)</li>
                  </ul>
                  <p className="mt-1 text-muted-foreground">Existing holdings will be merged.</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onExportExcel}
                disabled={!canExport}
                variant="outline"
                className="gap-2 minimal:rounded-none"
              >
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
              <p className="font-semibold mb-1">📊 Export Full Portfolio Report</p>
              <p>Downloads a <strong>.xlsx</strong> file with your complete portfolio data in one sheet:</p>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li>Portfolio Summary &amp; P&amp;L</li>
                <li>All Current Holdings</li>
                <li>Buy &amp; Sell History</li>
                <li>Fund Deposits &amp; Withdrawals</li>
                <li>Portfolio Value Timeline</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
