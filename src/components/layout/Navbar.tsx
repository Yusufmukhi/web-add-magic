import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { ModeToggle } from "./ModeToggle";

export function Navbar({ rightSlot }: { rightSlot?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl creative:glass minimal:bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Creative: animated gradient mark with live pulse. Minimal: monogram. */}
          <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl creative:gradient-hero creative:shadow-glow minimal:rounded-none minimal:border minimal:border-foreground minimal:bg-transparent">
            <span className="font-display text-base font-extrabold text-primary-foreground minimal:text-foreground">
              ₹
            </span>
            <span className="absolute -bottom-1 -right-1 hidden h-3 w-3 rounded-full bg-gain ring-2 ring-background creative:block ticker-pulse" />
          </div>
          <div>
            <h1 className="font-display text-lg font-extrabold tracking-tight creative:bg-gradient-to-r creative:from-foreground creative:via-primary creative:to-foreground creative:bg-clip-text creative:text-transparent sm:text-xl">
              Dalal&nbsp;Street
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground minimal:tracking-[0.4em]">
              NSE · Watchlist
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
