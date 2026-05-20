## Scope reality check

Your `index.html` is a 2,434-line single-page app with **6 major surfaces**:
1. Watchlist (cards, detail tabs, search, refresh)
2. Portfolio (holdings table, stats, charts)
3. Transactions (history, filter, CSV export)
4. Buy/Sell/Funds modals
5. Sector editor
6. Analytics (portfolio vs NIFTY 50 / SENSEX benchmarks)

Plus 4 UI combinations (Creative/Minimal × Dark/Light), sparklines, sortable columns, debounced search, CSV export, sector badges, keyboard shortcuts, skeletons, empty states, responsive.

Doing **all of this correctly in one loop** would produce ~40 files / 4–5k lines of generated code with high risk of bugs and broken parity. I recommend phasing.

## Proposed phasing

### Phase 1 (this loop) — Foundation + Watchlist
- `/backend/server.py` + `requirements.txt` (your code, cleaned, untouched API shapes)
- `.env.example` with `VITE_API_BASE_URL=http://localhost:8000`
- Full folder skeleton per your spec (adapted to TanStack: route lives in `src/routes/index.tsx`, no `App.tsx`/`main.tsx`)
- Context + hooks: `ThemeContext`, `UIModeContext`, `useTheme`, `useUIMode`, `useWatchlist`, `useStockQuote`, `useStockHistory`, localStorage persistence
- `services/api.ts` typed wrapper for all 4 endpoints
- `types/`, `utils/formatters.ts` (₹, Cr/L, Indian commas, ▲/▼), `utils/colorHelpers.ts`
- Layout: `Navbar` with `ThemeToggle` + `ModeToggle`, tabs scaffold
- **Watchlist tab fully functional**: `AddStockBar` (debounced search, `/` shortcut), `WatchlistTable` (sortable, sparklines, sector badges, 52-wk alert badges, CSV export), `StockRow`, `StockDetail` with `StatCard`, skeletons, empty states
- Portfolio Summary Bar (total / avg PE / top gainer-loser)
- All 4 UI combinations wired and working

### Phase 2 (next message after you confirm phase 1) — Portfolio + Transactions
- Portfolio tab (holdings, stats, allocation/sector charts via Recharts)
- Transactions tab (filter, CSV export)
- Buy/Sell/Funds modals + cash balance + realized P/L logic

### Phase 3 — Analytics + Sector editor
- Analytics tab with NIFTY 50 / SENSEX benchmark via `useStockHistory`, `PeriodSelector`, `BenchmarkToggle`
- Sector editor

## Technical notes

- TanStack Start (Cloudflare Workers runtime) cannot run Python. `server.py` stays in `/backend/` for you to run locally. Frontend reads `import.meta.env.VITE_API_BASE_URL` (default `http://localhost:8000`). Lovable preview will show empty/error states until you run the backend; that's expected.
- All data fetching wrapped in TanStack Query (already in template) for caching/dedup.
- Theme + mode applied via `data-theme` and `data-mode` attributes on `<html>`, with Tailwind `data-[mode=creative]:` variants. No custom CSS files — just `src/styles.css` token block.
- Charts via Recharts (sparklines = `<LineChart>` with no axes).

## Confirm

Reply "go phase 1" and I'll build it. If you'd rather I attempt everything in one giant loop, say "all at once" — but expect a longer build and more iteration to fix breakage.