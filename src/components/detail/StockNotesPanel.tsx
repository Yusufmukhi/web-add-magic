import { useEffect, useState } from "react";
import { NotebookPen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStockNotes } from "@/hooks/useStockNotes";
import { toast } from "sonner";

export function StockNotesPanel({ ticker }: { ticker: string }) {
  const { get, save } = useStockNotes();
  const [draft, setDraft] = useState("");

  // Sync draft when ticker changes
  useEffect(() => {
    setDraft(get(ticker));
  }, [ticker, get]);

  const handleSave = () => {
    save(ticker, draft);
    toast.success("Note saved");
  };

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <NotebookPen className="h-3.5 w-3.5" /> Trade Notes
      </h3>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`Why you hold ${ticker}, target price, exit criteria…`}
        rows={4}
        className="resize-none text-sm minimal:rounded-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Saved locally in your browser</p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          className="gap-1.5 minimal:rounded-none"
          disabled={draft === get(ticker)}
        >
          <Save className="h-3.5 w-3.5" /> Save Note
        </Button>
      </div>
    </div>
  );
}
