import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { sectorBadgeClass } from "@/utils/colorHelpers";
import { useSectorOverrides } from "@/hooks/useSectorOverrides";
import type { QuoteResult } from "@/hooks/useStockQuote";

interface Props {
  results: QuoteResult[];
}

export function SectorEditor({ results }: Props) {
  const { overrides, setSector, resolve } = useSectorOverrides();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const rows = results
    .filter((r) => r.data)
    .map((r) => ({
      ticker: r.ticker,
      name: r.data!.name,
      apiSector: r.data!.sector,
      sector: resolve(r.ticker, r.data!.sector),
      overridden: overrides[r.ticker] != null,
    }));

  const start = (t: string, current: string) => {
    setEditing(t);
    setDraft(current);
  };
  const save = (t: string) => {
    setSector(t, draft);
    setEditing(null);
  };
  const reset = (t: string) => {
    setSector(t, "");
    setEditing(null);
  };

  return (
    <Card className="creative:shadow-soft minimal:rounded-none minimal:border-2 p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold">Sector Overrides</h2>
        <p className="text-xs text-muted-foreground">
          Override the sector assigned by Yahoo for any stock. Stored locally.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Add stocks to your watchlist to manage sectors.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.ticker}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 minimal:rounded-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{r.ticker}</span>
                  {r.overridden && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">custom</Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">{r.name}</div>
              </div>
              {editing === r.ticker ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="h-8 w-44 text-xs minimal:rounded-none"
                    placeholder="Sector name"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => save(r.ticker)}>
                    <Check className="h-4 w-4 text-gain" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${sectorBadgeClass(r.sector)} text-xs`}>
                    {r.sector}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => start(r.ticker, r.sector)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {r.overridden && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => reset(r.ticker)}>
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
