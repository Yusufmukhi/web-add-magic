import { Home, ListChecks, Briefcase, LineChart, Receipt, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavTab = "home" | "watchlist" | "portfolio" | "analytics" | "transactions" | "settings" | "planning";

const TABS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "watchlist", label: "Watchlist", icon: ListChecks },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
  { id: "analytics", label: "Stats", icon: LineChart },
  { id: "transactions", label: "Orders", icon: Receipt },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

interface Props {
  value: NavTab;
  onChange: (t: NavTab) => void;
}

export function BottomNav({ value, onChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = value === t.id;
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex w-full flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    active && "scale-110"
                  )}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span
                  className={cn(
                    "text-[10px] leading-none tracking-tight",
                    active && "font-semibold"
                  )}
                >
                  {t.label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 h-0.5 w-6 rounded-full transition-all",
                    active ? "bg-primary" : "bg-transparent"
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
