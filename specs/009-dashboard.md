# 009 — Dashboard

**Status:** implemented
**Depends on:** 002 (transactions), 003 (design system), 006 (wide-web
layout pattern this reuses), 007 (budgets), 008 (debt tracking)

Layout chosen from the canvas (2026-09-22): **Option D** — a suggestions
feed leads, the full budget list and spent/saved/debt KPIs share a row
below it (KPIs stacked vertically), then category breakdown + 6-month
trend + debt payoff anchor the bottom row.

## Purpose

Everything spec 000's vision update was written for: turn tracking +
budgets + debt into concrete "what to do" suggestions, on one screen.

## Decisions

### Navigation: a four-tab switcher, not a router

`cheap` has had exactly one screen after sign-in until now (spec 006
explicitly called this out as *why* it needed no sidebar). Adding a real
second screen needs *some* way to reach it — a full navigation library
(React Navigation etc.) is more than a handful of screens justify.
**Revised from this spec's original draft** (which named only
`Transactions`/`Dashboard`): specs 007 and 008 also shipped
`BudgetsScreen`/`DebtsScreen` with no way to reach them, explicitly
deferring that to this spec. A user can't set a budget or track a debt
— the data this dashboard exists to visualize — without reaching those
screens too, so the switcher covers all four: `Transactions` /
`Budgets` / `Debts` / `Dashboard`. Same pill-toggle pattern already
established (`SignInScreen`'s sign-in/create-account tabs,
`TransactionsScreen`'s Expense/Income toggle) — local component state in
`App.tsx`, no new dependency, barely more code than a two-tab version.

### Charts: plain `View`/`StyleSheet`, except the donut

Most of the approved mockup is achievable with plain flexbox Views,
which already render identically on native and web (spec 000's "one
implementation" requirement, trivially satisfied):
- Progress bars (budgets, debt payoff): a track `View` + a fill `View`
  sized by `width: '<percent>%'`.
- The 6-month trend: vertical bars sized by `height`.
- KPI tiles, suggestion cards: plain `Text`/`View`, matching every other
  screen in the app.

**"Where it went" keeps its real donut** (decided over the
zero-dependency segmented-bar alternative). CSS `conic-gradient` (how the
mockup drew it) is web-only, no React Native equivalent, so this needs
`react-native-svg` — one new dependency, already a well-established
cross-platform choice (native + web via `react-native-web`'s SVG
support; the same library most React Native charting libraries build on
top of). Implementation: a ring built from stacked `<Circle>` elements
(one per category) using the standard `strokeDasharray`/
`strokeDashoffset` technique — each segment's dash length is its share
of the total, offset by the cumulative share of segments before it,
rotated so the first segment starts at 12 o'clock. No arc-path trig
needed. The dash-length/offset math per segment is a small pure function,
independently unit-testable from the actual SVG rendering.

### Suggestions: the 3 rules from the earlier design discussion

Confirmed rule-based, not AI-generated (see the privacy/cost/testability
discussion when this was first raised) — pure functions over data this
spec already computes, each independently unit-testable:

1. **Budget overrun** — any category where `spend / limit > 1.0`, one
   suggestion per over-budget category, sorted by how far over.
2. **Debt pace** — for each debt with `minimumPayment > 0`:
   `monthsToPayoff` (spec 008) at the current minimum payment, plus what
   *doubling* the minimum payment would do
   (`currentBalance / (minimumPayment * 2)`) — a simple, explainable
   "what if" rather than an open-ended optimizer.
3. **Savings rate vs. last month** — `(income − expense) / income` for
   the current month compared to the same figure for the *previous*
   calendar month (not a 6-month best-of lookback, which needs
   multi-month history this spec doesn't otherwise require — a smaller,
   still-meaningful version of what the mockup's copy implied; a longer
   lookback is a natural future extension, not this spec's job).

A month with no income (`income === 0`) skips rule 3 rather than
dividing by zero.

## Requirements

### Monthly aggregation (pure functions, no new queries)

- `cheap`'s stores already hold every synced transaction/budget/debt for
  the account (spec 002/007/008) — the dashboard computes aggregates
  in-memory from what's already loaded, no new Firestore queries, per
  spec 000's accepted client-side-aggregation tradeoff.
- Per-category, per-month expense sums; total income/expense per month;
  the last 6 calendar months for the trend chart.

### The dashboard screen

- Suggestions feed (0 rows shown if no rules currently fire — not an
  empty-state error, just nothing to flag).
- Full budget list (every category with a `Budget`, spec 007) + KPI
  stack (spent / saved / total debt remaining this month), side by side
  at `≥` the spec 006 breakpoint, stacked as two full-width sections in
  order on narrow/native.
- Category breakdown (donut), 6-month trend, debt payoff list — three
  columns at `≥` the breakpoint, stacked full-width in the same order
  below it on narrow/native.
- Empty states: no budgets set → the budget section says so instead of
  rendering nothing; no debts → same for the debt section; a category
  with spend but no budget doesn't appear in the budget list at all
  (spec 007).

## Acceptance criteria

1. **Given** a signed-in user, **when** they switch to the Dashboard tab,
   **then** they see the layout described above, computed from their
   real transactions/budgets/debts.
2. **Given** a category over its budget this month, **then** a
   corresponding suggestion appears in the feed, and that category's
   progress bar renders in the over-budget color.
3. **Given** a debt with a minimum payment, **then** its payoff
   suggestion shows both the current-pace estimate and the
   doubled-payment estimate, matching `monthsToPayoff`'s formula (spec
   008).
4. **Given** this month's and last month's income/expense, **then** the
   savings-rate suggestion compares them correctly, and is absent
   entirely when this month's income is zero.
5. **Given** a window `< 900px` (spec 006's breakpoint) or native,
   **then** every dashboard section stacks full-width in a single column,
   in the same order as the wide layout.
6. **Given** no budgets, no debts, or neither, **then** the dashboard
   still renders correctly with the appropriate empty states — never a
   crash or a blank section with no explanation.
7. **Given** this month's per-category expense totals, **then** the
   donut's segments are proportional to each category's share of total
   spend (each segment's `strokeDasharray`/`strokeDashoffset` computed
   correctly, cumulative offsets summing to a full circle) — using spec
   003's fixed chart color order, not reassigned per render.
8. **Given** `npx tsc --noEmit` and `npx jest`, **then** both stay green.

## Out of scope

- Multi-debt payoff *strategy* (avalanche/snowball ordering) — per spec
  008's own out-of-scope line.
- A savings-rate lookback longer than one prior month — see Decisions.
- Any chart interaction beyond static display (tapping a bar to filter,
  a date-range picker, etc.).
- Editing budgets/debts from the dashboard itself — that stays on their
  own screens (specs 007/008); the dashboard is read-only.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1 — dashboard renders from real data | Component | Mounted with mocked store data across transactions/budgets/debts, assert each section's content matches. |
| 2 — over-budget suggestion + bar color | Unit + component | Pure function test for the budget-overrun rule; component test asserts the over-budget style is applied. |
| 3 — debt pace suggestion math | Unit | Pure function test, reusing spec 008's `monthsToPayoff`, asserting the doubled-payment branch. |
| 4 — savings-rate suggestion, zero-income edge case | Unit | Pure function tests: normal comparison, and the zero-income skip case. |
| 5 — narrow/native single-column stacking | Component | `useWideWeb` mocked `false`, assert single-column order (same pattern as spec 006's tests). |
| 6 — empty states | Component | Render with empty budgets/debts arrays, assert the empty-state copy renders, not a blank or crashed section. |
| 7 — donut segment math | Unit | Pure function test: given category totals, assert each segment's dash length/offset and that offsets sum to the full circumference. |
| 8 — no regressions | Automated | `npx tsc --noEmit`, `npx jest`. |

Manual, in a browser (after automated tests pass): resize across 900px
and confirm the layout at the deployed URL, same process as specs
005/006.

## Verification results

Implemented 2026-09-22.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1 — renders from real data | ✅ | `DashboardScreen.test.tsx` — mounted with mocked stores, assert suggestion/budget/debt content matches the input data. |
| 2 — budget-overrun suggestion + bar color | ✅ | `suggestions.test.ts` (rule math) + `DashboardScreen.test.tsx` (a 158%-over category produces both `suggestion-budget-*` and the matching progress-bar text). |
| 3 — debt-pace suggestion math | ✅ | `suggestions.test.ts` + `DashboardScreen.test.tsx`: current-pace and doubled-pace months both shown, reusing spec 008's `monthsToPayoff`. |
| 4 — savings-rate suggestion, zero-income edge case | ✅ | `suggestions.test.ts`: normal comparison and the zero-income skip. |
| 5 — narrow/native single-column stacking | ✅ | `DashboardScreen.test.tsx` (no wide-row wrappers under default test `Platform.OS`) + `DashboardScreen.wideWeb.test.tsx` (wide rows present with `useWideWeb` mocked `true`) — same split-file pattern as spec 006. |
| 6 — empty states | ✅ | `DashboardScreen.test.tsx`: empty budgets/debts render explanatory text, not a blank/crashed section. |
| 7 — donut segment math | ✅ | `donutSegments.test.ts` — dash length proportional to share, cumulative negative offset, lengths sum to the full circumference, spec 003's chart color order (cycling past 5 categories). |
| 8 — no regressions | ✅ | 168 tests pass, `tsc --noEmit` clean, `npx expo export -p web` builds (324 modules, 1.5MB). |

**What shipped:**
- `src/dashboard/{aggregation,suggestions,donutSegments}.ts` — pure
  functions, no new Firestore queries (spec 000's accepted client-side
  aggregation tradeoff): per-category/per-month expense sums, 6-month
  trend, the 3 suggestion rules, and the donut's
  `strokeDasharray`/`strokeDashoffset` math.
- `react-native-svg` — the one new dependency, for the real donut kept
  per feedback over the zero-dependency segmented-bar alternative.
- `src/screens/DashboardScreen.tsx` — Option D's layout: suggestions
  feed, then a wide-row (budgets list + KPI stack) or stacked
  full-width pair on narrow/native, then a second wide-row (donut,
  trend, debt payoff) or stacked full-width trio.
- **Navigation, revised from this spec's original two-tab draft**: `App.tsx`
  gained a 4-tab switcher (Transactions/Budgets/Debts/Dashboard), not
  just Transactions/Dashboard — `BudgetsScreen`/`DebtsScreen` (specs
  007/008) had no way to reach them otherwise, and a dashboard
  visualizing budgets/debts is only useful once a user can actually set
  some. See this spec's Decisions section for the full rationale.

168 unit/component tests pass (up from 148), `tsc --noEmit` clean,
`npx expo export -p web` builds successfully.

Staying at `implemented`, not `verified` — the manual browser resize
pass (specs 005/006's established process) hasn't been done yet.
