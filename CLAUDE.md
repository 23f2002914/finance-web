# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

```bash
cd /home/shrini/shrini/finance-web
python3 app.py        # starts Flask dev server on http://localhost:5000
```

To kill the server: `pkill -f "python3 app.py"` or `lsof -ti:5000 | xargs kill -9`

## Architecture

Single-file Flask backend (`app.py`) + vanilla JS frontend. No build step, no package manager.

```
app.py              — Flask app, SQLite init, all API routes
finance.db          — SQLite database (created on first run)
templates/index.html — Single-page app shell (all tabs in one HTML file)
static/app.js       — All frontend logic (tab routing, fetch calls, DOM rendering)
static/style.css    — All styles (CSS custom properties, no framework)
```

### Database tables

| Table | Purpose |
|---|---|
| `bank_accounts` | Dynamic accounts (Bank/Wallet/Cash types) |
| `account_openings` | Per-(month, account) opening balances — UNIQUE(month, account) |
| `expenses` | Expenses with `payment_method` (UPI/Card-Debit/Card-Credit/Cash/Net Banking/Cheque) |
| `income_entries` | Income with same payment_method options |
| `transfers` | Internal transfers between own accounts; method defaults to IMPS |
| `debts` | Monthly snapshot of personal debts (Snapmint, Ani, etc.) |
| `subscriptions` | Recurring subscriptions with active/inactive status |
| `_seeded` | One-time seed guard — prevents sample data from re-inserting after user deletes it |

### Balance formula

`closing = opening + income + transfers_in − expenses − transfers_out`

Computed by `acc_summary(conn, month=None)` in `app.py`. Pass a month string (`"Jul 2026"`) for monthly view, or `None` for all-time totals.

### Seeding pattern

Sample data is inserted exactly once using `_seeded` table as a permanent flag. Check `seeded(key)` before inserting, call `mark(key)` after. Never use `SELECT COUNT(*) = 0` as the guard (breaks when user deletes data).

### Frontend conventions

- `api(path, opts)` — thin `fetch` wrapper in `app.js`, throws on non-OK responses
- `loadAccounts()` — fetches `/api/accounts/list`, stores in `_accounts` global, must be called before any account dropdown is populated
- `populateAccountSel(selId, selected)` — fills a `<select>` from `_accounts`
- `acctBadge(name)` — returns colored badge HTML for an account name; colors assigned from `ACC_COLORS` array cycling by insertion order via `_accColorMap`
- `pmBadge(pm)` — colored badge for payment method
- `inr(n)` — formats number as ₹ with `en-IN` locale
- `month_key(m)` — converts `"Jul 2026"` → `"202607"` for chronological sorting (same logic in Python and JS)
- Tab switching: click handlers on `nav button[data-tab]` call `renderTab(name)` which dispatches to per-tab render functions

### API endpoints

All endpoints under `/api/`. Pattern: `GET` lists, `POST` creates, `PUT /<id>` updates, `DELETE /<id>` deletes.

- `/api/accounts`, `/api/accounts/list` (active only, for dropdowns)
- `/api/account-openings`
- `/api/transfers`
- `/api/income-entries`
- `/api/expenses`
- `/api/debts`
- `/api/subscriptions`
- `/api/dashboard` — summary cards + chart data + per-account balances
- `/api/report?month=<month>` — full monthly breakdown including transfers and payment×category matrix
- `/api/months` — sorted list of all months with data
