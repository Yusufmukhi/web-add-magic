import { useEffect, useRef, useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { searchStocks } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SearchApiResponse } from "@/types/api.types";

type SearchResult = NonNullable<SearchApiResponse["quotes"]>[number];

interface Props {
  onAdd: (ticker: string) => void;
}

export function AddStockBar({ onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 300ms debounce
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Search on debounced change
  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    searchStocks(debounced)
      .then((r) => {
        if (!cancel) {
          setResults(r ?? []);
          setOpen(true);
        }
      })
      .catch(() => !cancel && setResults([]))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [debounced]);

  // "/" keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handlePick = (sym: string) => {
    onAdd(sym.replace(".NS", ""));
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) handlePick(query.trim().toUpperCase());
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NSE ticker (e.g. RELIANCE, TCS) — press / to focus"
            className="h-11 rounded-xl pl-10 pr-10 font-mono creative:bg-card creative:shadow-soft minimal:rounded-none minimal:border-0 minimal:border-b minimal:bg-transparent minimal:px-2"
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button type="submit" size="lg" className="h-11 gap-2 rounded-xl minimal:rounded-none">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-12 top-full z-40 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-soft creative:shadow-glow minimal:rounded-none">
          {results.map((r) => (
            <button
              key={r.symbol}
              type="button"
              onClick={() => handlePick(r.symbol)}
              className="flex w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent"
            >
              <div>
                <div className="font-mono text-sm font-semibold">
                  {r.symbol.replace(".NS", "")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.longname || r.shortname}
                </div>
              </div>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
