import { Plus, Minus, ShoppingCart, ArrowDownToLine, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onAddFunds: () => void;
  onWithdraw: () => void;
  onBuy: () => void;
  onSell: () => void;
  onExportCSV: () => void;
  canSell: boolean;
  canExport: boolean;
}

export function PortfolioActions({
  onAddFunds, onWithdraw, onBuy, onSell, onExportCSV, canSell, canExport,
}: Props) {
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
      <Button
        onClick={onExportCSV}
        disabled={!canExport}
        variant="outline"
        className="ml-auto gap-2 minimal:rounded-none"
      >
        <Download className="h-4 w-4" /> Export CSV
      </Button>
    </div>
  );
}

