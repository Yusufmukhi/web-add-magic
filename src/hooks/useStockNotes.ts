import { useCallback, useEffect, useState } from "react";

const KEY = "stock_notes";

type NotesMap = Record<string, string>; // ticker → note text

export function useStockNotes() {
  const [notes, setNotes] = useState<NotesMap>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setNotes(JSON.parse(raw) as NotesMap);
    } catch { /* ignore */ }
  }, []);

  const save = useCallback((ticker: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) next[ticker] = text.trim();
      else delete next[ticker];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const get = useCallback((ticker: string) => notes[ticker] ?? "", [notes]);

  return { notes, save, get };
}
