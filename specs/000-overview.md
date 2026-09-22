# 000 — Product Overview & Stack

**Status:** approved

## Vision

A personal finance tool focused on **saving money** — not just logging
transactions. Four things it's specifically for:

1. **Tracking** expenses and income clearly enough to see where money
   actually goes.
2. **Budgets** — set a spending limit per category, see actual spend
   against it, know before the month gets away from you.
3. **Debt** — track what's owed (loans, credit cards), minimum payments,
   and payoff progress, not just treat debt payments as another expense
   line with no larger context.
4. **Suggestions** — turn 1–3 into concrete calls: which category is over
   budget, which debt to prioritize paying down, what's creeping up
   month over month, what to cut.

Everything else (categories, charts, the dashboard) exists in service of
these four — a feature that doesn't help someone save money, pay down
debt, or make a better financial decision is out of scope until it does.

## Target users

A single individual managing their own finances. No household/shared-account
concept in v1 (decided — revisit only if multi-user demand shows up later).

## Platform strategy

- **Android + iOS + Web, all in v1** — unlike a phased pilot, this ships to
  all three from day one since it's a single-user tool with no rollout risk
  to coordinate.
- Framework: **Expo (React Native) + TypeScript**, one codebase, web via
  `react-native-web`. Same as `da2`.

## Backend stack (decision)

**Firebase** (Auth + Firestore), matching `da2`.

Rationale:
- Firestore listeners give real-time sync across devices (phone + web) for
  free — log an expense on your phone, see it on the web dashboard
  instantly.
- No custom API server → fastest path to a working app.
- Already the proven stack from `da2` — no new setup risk.

Trade-off accepted: Firestore has no native aggregation/rollup queries, and
this app is chart-heavy (spend-by-category, trends over time). v1 computes
aggregates client-side over a bounded query range (e.g. current month/year);
revisit with scheduled Cloud Functions rollups only if that gets slow.

## v1 scope

| In | Out (later) |
|----|-------------|
| Manual entry of expenses and income (amount, category, date, note) | Bank/card sync (Plaid or similar) |
| Predefined + custom categories | Receipt OCR / auto-extraction |
| **Category budgets** — a monthly limit per category, tracked against actual spend, with an over-budget state | Multi-currency (CLP only in v1) |
| **Debt tracking** — a debt/loan entity (balance, minimum payment, interest rate optional) with payoff progress, separate from a regular expense category | Shared/family budgets, multi-user households |
| Dashboard: spend by category, spend over time, income vs. expense, budget-vs-actual, debt payoff progress | Recurring-transaction automation/reminders |
| **Savings & debt suggestions** — top categories, month-over-month change, budget overruns, which debt to prioritize, simple "where to cut" callouts | Full envelope budgeting (rollover between periods, sub-envelopes) |
| Auth (Google + email/password, spec 001) + cross-device sync (phone + web) | Export (CSV/PDF) |

Budgets and debt tracking are new structural scope beyond what's
implemented so far (spec 002 only models `expense`/`income` transactions)
— each gets its own spec before any code, same as everything else here.

## Cross-cutting constraints

- **Currency: Chilean pesos (CLP) only in v1** (decided). CLP has no minor
  unit in circulation (ISO 4217 defines it with 0 decimal digits), which
  changes how amounts are stored — see spec 002. No currency field, no
  conversion, no formatting for other currencies until multi-currency is
  actually scoped.
- **Privacy:** financial data is private to the account owner; no
  third-party data sharing.
- **Language:** English for v1 (decided).
- **Testing:** same TDD discipline as `da2` — failing test first, every
  change ships with a regression test (see root `CLAUDE.md`).
- **Visual system:** every screen is built from the shared design-system
  primitives and tokens defined in spec 003 (`src/theme/`) — no raw colors,
  spacing, or type values in screen code. Built before 001/002's screens
  (see `specs/README.md`'s Build order).
- **Visualization:** charts are core to the product's value (not a
  nice-to-have add-on) — and specifically in service of the vision above:
  "where does my money go" charts are a means to budgets/debt/savings
  decisions, not the end goal by themselves. The charting library must
  work acceptably on both React Native and web from one implementation
  (no maintaining two); spec 003 fixes the chart color palette, the
  library choice itself is decided when dashboard work starts.
