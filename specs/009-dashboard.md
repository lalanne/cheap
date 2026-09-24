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

(The 002 amendment below added a fifth tab, `Categories`, before this
was cut back down — see the 2026-09-23 amendment right after this
section for the current, three-tab state.)

### Amendment (2026-09-23): three tabs, not five — `Log` / `Manage` / `Dashboard`

Five top-level tabs (`Transactions`, `Categories`, `Budgets`, `Debts`,
`Dashboard`) turned out to be too many for what are mostly small,
related data-entry screens — flagged by the user, explored as three
grouping options on a design canvas (single merged tab; `Spending`/`Plan`
by theme; split by how often you touch it), and resolved on the third:
**group by frequency of use, not by domain.**

- **`Log`** (renamed from `Transactions`, same screen/testID
  `transactions-screen` — unchanged) — the thing done daily. The
  existing inline "+ New" category chip already covers quick category
  creation while logging; unaffected by this amendment.
- **`Manage`** (new) — `Categories`, `Budgets`, and `Debts` together,
  the things touched occasionally, not daily. `≥900px` (spec 006's
  breakpoint, same one the dashboard's second row uses): three columns
  side by side. Below that, or native: stacked full-width in the same
  order (Categories, Budgets, Debts) — same responsive pattern as this
  spec's own budgets/KPI and donut/trend/debts rows, reused rather than
  inventing a second convention.
- **`Dashboard`** — unchanged, stays its own tab; explicitly kept
  separate from the consolidation (it's a different mode — deciding,
  not managing/entering data).

**Implementation shape:** `CategoriesScreen.tsx`/`BudgetsScreen.tsx`/
`DebtsScreen.tsx` each split into a content-only `*Panel` component (no
own `Screen` wrapper, no independent scroll region — same list/form
markup, same testIDs, just not top-level anymore) plus `ManageScreen.tsx`,
which composes the three panels inside one `Screen`/`ScrollView`, mirroring
how `DashboardScreen` already composes multiple cards inside a single
`Screen` rather than nesting several. The old top-level
`CategoriesScreen`/`BudgetsScreen`/`DebtsScreen` components are retired
(nothing renders them standalone anymore) — their `__tests__` files move
to `CategoriesPanel.test.tsx`/`BudgetsPanel.test.tsx`/`DebtsPanel.test.tsx`
with the same assertions, just against the panel directly.

No change to any store, repository, Firestore rule, or validation logic
in specs 002/007/008 — this is purely a navigation/layout amendment.

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
9. **Given** a signed-in user, **when** they open the app, **then**
   exactly three tabs are shown — `Log`, `Manage`, `Dashboard` — not
   five (amendment 2026-09-23).
10. **Given** a signed-in user on the `Manage` tab, **when** the viewport
    is `≥900px`, **then** Categories, Budgets, and Debts render as three
    columns side by side; **when** it's narrower or native, **then** they
    stack full-width in the same order — and every existing
    add/edit/delete behavior for each (specs 002/007/008) keeps working
    unchanged.

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
| 9 — three tabs, not five | Component | `App.test.tsx`: assert `tab-transactions`/`tab-manage`/`tab-dashboard` exist and `tab-categories`/`tab-budgets`/`tab-debts` no longer do. |
| 10 — Manage tab composes the three panels, responsively | Component | `ManageScreen.test.tsx` (narrow/native: stacked, no wide-row testID) + `ManageScreen.wideWeb.test.tsx` (mocked wide: three-column row testID present) — same split-file pattern as this spec's own criterion 5; `CategoriesPanel`/`BudgetsPanel`/`DebtsPanel` tests carry over their existing add/edit/delete assertions unchanged. |

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

**Amendment (2026-09-23) — three tabs, not five:** implemented as
described in the Decisions section's amendment above. `CategoriesScreen`/
`BudgetsScreen`/`DebtsScreen` retired; their content now lives in
`CategoriesPanel`/`BudgetsPanel`/`DebtsPanel` (no own `Screen` wrapper),
composed by new `src/screens/ManageScreen.tsx`. `App.tsx`'s tab switcher
is down to `transactions` (labeled "Log") / `manage` / `dashboard`.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 9 — three tabs, not five | ✅ | `App.test.tsx`: asserts `tab-transactions`/`tab-manage`/`tab-dashboard` exist, `tab-categories`/`tab-budgets`/`tab-debts` don't. |
| 10 — Manage tab, responsive | ✅ | `ManageScreen.test.tsx` (narrow: all three panels present, no `manage-wide-row`) + `ManageScreen.wideWeb.test.tsx` (mocked wide: `manage-wide-row` present); `CategoriesPanel.test.tsx`/`BudgetsPanel.test.tsx`/`DebtsPanel.test.tsx` carry over every prior add/edit/delete assertion unchanged, now against the panel directly. |

179 tests pass (up from 174 — old `CategoriesScreen`/`BudgetsScreen`/
`DebtsScreen` test files replaced 1:1 by the panel equivalents, plus new
`ManageScreen`/`ManageScreen.wideWeb`/`App.test.tsx` coverage), `tsc
--noEmit` clean, `npx expo export -p web` builds (325 modules, 1.5MB).

**Bug found live (2026-09-24), criterion 7 — donut segments weren't
actually proportional.** Real gap: `DashboardScreen.tsx`'s `<Circle>`
rendering hardcoded `strokeDasharray` to the full circumference for
*every* segment (`` `${2 * Math.PI * DONUT_RADIUS}` ``), completely
ignoring `seg.dashLength` — `computeDonutSegments`'s math was correct
and unit-tested (criterion 7's original test), but nothing checked that
the *component* actually applied it. Every circle drew as a complete
ring, stacked on top of each other; only the last one or two painted on
top ended up visible at all, so a user with 13 categories saw two solid
color blocks with no relation to actual spend, instead of up to 13
proportional arcs (colors cycling per spec 003's fixed order, so some
adjacent-by-index categories do share a color — expected — but the
*sizes* were never right).

Fixed: `strokeDasharray={`${seg.dashLength} ${2 * Math.PI *
DONUT_RADIUS}`}` — dash length is the segment's own share, gap is the
full circumference (more than enough to prevent the pattern repeating
before the arc completes). Regression test added to
`DashboardScreen.test.tsx`: renders two known-amount categories, reads
each arc's `strokeDasharray` off its `dashboard-donut-arc-${category}`
testID (new — one per arc, needed to query react-native-svg's `<Circle>`
directly since this RNTL version has no `UNSAFE_getByType`), and asserts
it matches `[dashLength, circumference]` (react-native-svg normalizes
the dasharray string into an array of numeric strings). 180 tests pass,
`tsc --noEmit` clean, web export builds.

**Lesson:** a pure function's math being unit-tested doesn't prove the
component wired it up — this needed a component-level assertion on the
actual rendered prop, not just on `computeDonutSegments`'s output in
isolation. Same class of gap CLAUDE.md's TDD rule exists to catch;
worth remembering for any other spot where a pure function's result
gets passed into a visual prop rather than displayed as text.
