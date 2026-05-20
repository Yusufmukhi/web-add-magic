import { Plus, Minus, ShoppingCart, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onAddFunds: () => void;
  onWithdraw: () => void;
  onBuy: () => void;
  onSell: () => void;
  canSell: boolean;
}

export function PortfolioActions({ onAddFunds, onWithdraw, onBuy, onSell, canSell }: Props) {
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
    </div>
  );
}
