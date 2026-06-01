/**
 * PATCH: src/components/layout/BottomNav.tsx
 *
 * Two changes only — everything else stays identical:
 *
 * 1. Add "finance" to the NavTab union type
 * 2. Add Wallet icon import from lucide-react
 * 3. Insert Finance entry in TABS array between "transactions" and "settings"
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * BEFORE (type):
 *
 *   export type NavTab =
 *     | "home"
 *     | "watchlist"
 *     | "portfolio"
 *     | "analytics"
 *     | "transactions"
 *     | "settings"
 *     | "planning";
 *
 * AFTER:
 *
 *   export type NavTab =
 *     | "home"
 *     | "watchlist"
 *     | "portfolio"
 *     | "analytics"
 *     | "transactions"
 *     | "finance"          // ← NEW
 *     | "settings"
 *     | "planning";
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * BEFORE (icon import line, e.g.):
 *
 *   import { Home, List, PieChart, BarChart2, FileText, Settings, Calendar } from "lucide-react";
 *
 * AFTER — add Wallet:
 *
 *   import { Home, List, PieChart, BarChart2, FileText, Settings, Calendar, Wallet } from "lucide-react";
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * BEFORE (TABS array, near end of transactions entry):
 *
 *     { id: "transactions", label: "Transactions", icon: FileText },
 *     { id: "settings",     label: "Settings",     icon: Settings  },
 *
 * AFTER:
 *
 *     { id: "transactions", label: "Transactions", icon: FileText },
 *     { id: "finance",      label: "Finance",      icon: Wallet   },   // ← NEW
 *     { id: "settings",     label: "Settings",     icon: Settings  },
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * No other changes.  The onTabChange callback signature stays the same:
 *   onTabChange?: (tab: NavTab) => void
 * The FinanceTrackerPage calls onTabChange and navigates away for all tabs
 * other than "finance", so BottomNav doesn't need any routing logic itself.
 */

// This file is documentation-only.  Apply the three diffs above manually.
export {};
