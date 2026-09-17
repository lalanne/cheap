# 000 — Product Overview & Stack

**Status:** approved

## Vision

A personal expense/income tracker. The goal isn't just logging transactions —
it's understanding where money goes clearly enough to make real financial
decisions: what to cut, what's creeping up, whether this month is better or
worse than last, and what to change to save more.

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
| Dashboard: spend by category, spend over time, income vs. expense | Multi-currency (see below — CLP only in v1) |
| Basic savings insight (top categories, month-over-month change, simple "where to cut" callouts) | Shared/family budgets, multi-user households |
| Auth (Google + email/password, spec 001) + cross-device sync (phone + web) | Recurring-transaction automation/reminders |
| | Budgeting goals / envelope budgeting |
| | Export (CSV/PDF) |

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
  nice-to-have add-on). The charting library must work acceptably on both
  React Native and web from one implementation (no maintaining two); spec
  003 fixes the chart color palette, the library choice itself is decided
  when dashboard work starts.
