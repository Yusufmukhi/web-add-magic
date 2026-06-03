import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/context/FinanceContext";

type Props = {
  kind: "income" | "savings" | "expense";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function CategorySelect({ kind, value, onChange, placeholder = "Select category" }: Props) {
  const finance = useFinance();
  const list =
    kind === "income"
      ? finance.incomeCategories
      : kind === "savings"
        ? finance.savingsCategories
        : finance.expenseCategories;

  const [newCat, setNewCat] = useState("");

  const handleAdd = () => {
    const r = finance.addCategory(kind, newCat);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const name = newCat.trim();
    toast.success(`Added "${name}"`);
    onChange(name);
    setNewCat("");
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {list.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
        <div className="flex items-center gap-2 border-t p-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New category"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button type="button" size="sm" variant="secondary" onClick={handleAdd}>
            <Plus className="size-4" />
          </Button>
        </div>
      </SelectContent>
    </Select>
  );
}
