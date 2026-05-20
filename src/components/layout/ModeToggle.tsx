import { Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIMode } from "@/hooks/useUIMode";

export function ModeToggle() {
  const { mode, toggleMode } = useUIMode();
  return (
    <Button
      variant="outline"
      onClick={toggleMode}
      className="rounded-full gap-2"
      aria-label="Toggle UI mode"
    >
      {mode === "creative" ? (
        <>
          <Sparkles className="h-4 w-4" /> Creative
        </>
      ) : (
        <>
          <Type className="h-4 w-4" /> Minimal
        </>
      )}
    </Button>
  );
}
