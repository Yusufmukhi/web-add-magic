import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UIMode = "creative" | "minimal";

interface UIModeContextValue {
  mode: UIMode;
  setMode: (m: UIMode) => void;
  toggleMode: () => void;
}

const UIModeContext = createContext<UIModeContextValue | null>(null);

const STORAGE_KEY = "ui_mode";

export function UIModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UIMode>("creative");

  useEffect(() => {
    const saved = (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null) as UIMode | null;
    if (saved === "creative" || saved === "minimal") setModeState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = (m: UIMode) => setModeState(m);
  const toggleMode = () =>
    setModeState((m) => (m === "creative" ? "minimal" : "creative"));

  return (
    <UIModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </UIModeContext.Provider>
  );
}

export function useUIModeContext(): UIModeContextValue {
  const ctx = useContext(UIModeContext);
  if (!ctx) throw new Error("useUIModeContext must be used inside UIModeProvider");
  return ctx;
}
