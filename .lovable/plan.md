## Audit of your current app

Right now you have **9 tabs** crammed into one row: Watchlist, Portfolio, Sold, Transactions, Analytics, SIP, Goals, Dividends, Tax. On your 852px viewport they wrap to two rows and look noisy. Most users only touch 3–4 of these daily.

Below is a concrete plan to **remove clutter, regroup tabs, and add a few high-value features**. Pick what you want — I'll implement only the checked items.

---

### A. Remove / consolidate (declutter)

1. **Merge "Sold" into "Transactions"** — Sold is just a filtered view of transactions. Add a filter chip (All / Buy / Sell / Dividend) inside Transactions instead of a whole tab.
2. **Merge "Dividends" into Transactions too** — same reasoning; dividends are a transaction type. Keep the dividend *summary* card inside Portfolio.
3. **Move "Tax" under Portfolio as a sub-section / button** ("Download Tax Report") — it's a once-a-year action, not a daily tab.
4. **Drop the footer hint** ("Press / to focus search") if the shortcut isn't actually wired up (it currently isn't).

Result: **9 tabs → 5 tabs** (Watchlist, Portfolio, Transactions, Analytics, Planning) where "Planning" holds SIP + Goals.

---

### B. Rearrange (better hierarchy)

1. **Dashboard-first landing**: replace the current Watchlist-first default with a compact **Overview** strip on top of every tab showing: Portfolio Value, Day P&L, Total P&L, Cash, CAGR. The `PortfolioSummary` block today only shows watchlist movers — it should show *your money* first.
2. **Sticky tab bar** when scrolling long tables.
3. **Reorder tabs by frequency**: Portfolio → Watchlist → Analytics → Transactions → Planning.
4. **Collapse the title block** ("Dalal Street" + tagline) into the Navbar to reclaim vertical space.

---

### C. Useful features to ADD

1. **Top movers / heatmap** on the Analytics tab — color-coded grid of your holdings by day % change.
2. **Price alerts** — set a target price per ticker; toast + browser notification when crossed (uses existing quote polling).
3. **News feed per stock** in StockDetail (Yahoo Finance news endpoint, one extra backend route).
4. **Compare stocks** — pick 2–3 tickers, overlay normalized price charts.
5. **Import / Export portfolio as CSV** (you already have CSV export for holdings; add **import** so users can seed from a broker statement).
6. **Cost-basis methods** toggle (FIFO vs Average) for realized P&L — affects Sold + Tax numbers.
7. **Currency / locale** in settings (default ₹ IST, optional $ USD for NRIs).
8. **Keyboard shortcuts** actually wired: `/` focus search, `b` buy, `s` sell, `g p` go to portfolio.

---

### D. Visual polish

1. Tighter card padding on mobile (currently `py-8` everywhere — too airy at 852px width).
2. Use the same StatCard component everywhere (Portfolio, Analytics, Goals already use it; SIP/Dividends don't — inconsistent).
3. Replace the wrapping TabsList with a horizontal-scroll bar on small viewports, or switch to an icon-only collapsed mode.
4. Add empty-state illustrations for Watchlist / Portfolio / Transactions when empty (right now they just show blank tables).

---

### My recommendation (minimal, high-impact)

If you want one batch of changes, I'd do:

- **A1, A2, A3** (collapse 9 tabs → 5)
- **B1** (top overview strip with real portfolio numbers)
- **B3** (reorder tabs)
- **C2** (price alerts) and **C5** (CSV import)
- **D3** (horizontal-scroll tabs on mobile)

That's a meaningful redesign in one pass without bloating the app further.

---

### Tell me which to do

Reply with letters/numbers (e.g. "A1, A2, B1, C2, D3") or just say **"do the recommended set"** and I'll start.
