# 009 — Dashboard

**Status:** implemented (amended 2026-10-10: criteria 13–17; amended 2026-10-11: criteria 18–23, budgeted vs. income, issue #15; 2026-10-15 draft: criteria 24–32, budget gauge, issue #36)
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
11. **Given** the dashboard on web, **when** the mouse hovers a donut
    segment, **then** that category's name and spend amount appear in
    the donut's center; **when** the mouse leaves, **then** the center
    clears. **Given** native, **then** nothing changes — no hover
    handler is attached (amendment 2026-09-24).
12. **Given** the "Spend, last 6 months" trend chart, **when** the user
    taps a bar, **then** the "Where it went" donut and its legend switch
    to that bar's month (rolled-up per spec 011), the tapped bar is
    visually marked as selected, and any active drill-down resets to the
    top-level view. Budgets, suggestions, and the KPI stack are
    unaffected — they always reflect the current month (amendment
    2026-09-25).

13. **Given** a month other than the current one is selected, **when** the
    dashboard renders, **then** the spent/saved KPIs and the budgets list
    show that month's figures (budget spend against each limit, using
    that month's rolled-up totals), and their labels name the month
    (amendment 2026-10-10).
14. **Given** a month other than the current one is selected, **then** the
    total-debt KPI and the debt section show each debt's **balance at the
    end of that month** (definition in the amendment below), including
    the overdraft line and credit cards, and the section title names the
    month.
15. **Given** a past month is selected, **when** the user taps the current
    month's bar, **then** every section returns to current-month data
    (same as criterion 12's existing "way back").
16. **Given** a selected month before any debt, card, or the overdraft
    line existed (or with no transactions/payments at all), **then** the
    sections show their empty states with the month named, not zeros
    pretending to be data and never an error.
17. **Given** a selected month, **then** the suggestions feed is
    unaffected — it always reflects the current month.
18. **Given** one or more budgets and income in the viewed month, **then**
    the budgets card shows, above the per-category list, a "Budgeted" row:
    the total of all budget limits, that month's income, and
    `round(totalBudgeted / income × 100)%`, with a progress bar sized like
    the per-category bars (`min(percent, 1)` of the track).
19. **Given** total budgeted exceeds income, **then** the percentage shows
    its real value (e.g. 112%), the bar is full, and it renders in the
    over color — the same treatment as an over-limit category bar.
20. **Given** budgets exist but the viewed month has zero income, **then**
    the row shows the budgeted total and "No income recorded in {month}",
    with no percentage and no bar — never a division by zero, `Infinity%`
    or `NaN%`.
21. **Given** no budgets, **then** the row is absent and the card's
    existing "No budgets set yet." empty state is unchanged.
22. **Given** a month other than the current one is selected, **then** the
    row uses that month's income against the budget limits as they are
    today, and its label names the month (criterion 13's `— {Mon}`
    convention).
23. **Given** budgets on both a parent category and one of its
    subcategories, **then** the total counts only the parent's limit for
    that subtree (its rolled-up spend already includes the subcategory),
    so a commitment is never counted twice.
24. **Given** at least one budget, **then** the budget-gauge card renders a
    semicircle with one segment per budgeted category (after the criterion-23
    ancestor rule), each segment's angular width proportional to its
    `monthlyLimit` share of the total budgeted, in spec 003's chart color order. Segments are ordered by limit descending,
    ties alphabetical (as the donut's amendment of 2026-10-05).
25. **Given** the viewed month's spend, **then** each segment is filled in
    proportion to `min(spent / limit, 1)`, and the center reads
    "Spent {X} of {Y} budget", where X counts only budgeted categories (rolled
    up per spec 011) and Y is the total budgeted.
26. **Given** a category over its limit, **then** its segment is full and
    marked in the over color, its list row shows the real `spent / limit`
    (e.g. `$205 / $200`) in the over color, and the center figure is not
    capped.
27. **Given** spend in a category with no budget, **then** it takes no arc
    and is excluded from the center figure, and the list ends with an
    "Unbudgeted" row showing the total of that spend.
28. **Given** more than 5 budgeted categories, **then** the list shows the 5
    with the highest `spent / limit` first (over-budget always visible) with
    a "Show more" control that expands to all and "Show less" that collapses.
29. **Given** no budgets, **then** the gauge card shows the existing "No
    budgets set yet." empty state and no arc.
30. **Given** a selected month (criteria 13–16), **then** the gauge uses that
    month's spend against today's limits, and its title names the month.
31. **Given** web, **when** the mouse hovers a segment, **then** the center
    shows that category's name and `spent / limit`; it clears on leave.
    Native attaches no handler (as criterion 11).

## Out of scope

- Multi-debt payoff *strategy* (avalanche/snowball ordering) — per spec
  008's own out-of-scope line.
- A savings-rate lookback longer than one prior month — see Decisions.
- ~~Any chart interaction beyond static display (tapping a bar to
  filter, a date-range picker, etc.)~~ **Reversed 2026-09-25 — see
  criterion 12:** tapping a trend bar now re-targets the donut. Still
  out of scope: any *other* interaction (a date-range picker, tapping
  the donut itself to filter the trend, etc.).
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
| 11 — donut hover-to-reveal (web only) | Component | `DashboardScreen.test.tsx`: `Platform.OS` set to `'web'`, `fireEvent(circle, 'mouseEnter')`/`'mouseLeave'` on a `dashboard-donut-arc-*` testID, assert the center label appears/clears with the right category and amount; a native-default test asserts no hover label ever appears (no handler attached). |
| 13 — spent/saved KPIs and budgets follow the month | Component | `DashboardScreen.test.tsx`: select a non-current bar, assert KPI values and each budget's spend/percent come from that month (distinct from the current month's in the fixture), labels carry the month suffix. |
| 14 — debt KPI + section show month-end balances | Unit + Component | Pure `debtBalanceAsOf`/`cardBalanceAsOf`/`overdraftBalanceAsOf` tests (see specs 008/012/013 addenda); component test asserts the KPI sum and each row use the as-of figures and the title names the month. |
| 15 — back to the current month | Component | Select a past bar, tap the last bar, assert KPIs/budgets/debt equal their initial (current-month) values. |
| 16 — empty states for months with no data | Component | Select a month earlier than every debt's `createdAt` and with no transactions; assert the empty-state copy renders with the month named. |
| 17 — suggestions unaffected | Component | Select a past bar; assert the suggestions feed is identical to before selecting. |
| 18 — budgeted vs. income row | Unit + Component | Pure `budgetedVsIncome(budgets, categories, income)` test (total, percent rounding); `DashboardScreen.test.tsx`: assert `dashboard-budgeted-vs-income` shows total, income, percent, and bar width. |
| 19 — over 100% | Unit + Component | Pure test: 112% not clamped; component asserts bar width is full and the over color is applied. |
| 20 — zero income | Unit + Component | Pure test returns "no income" (no percent); component asserts the "No income recorded" copy and no percent text/bar. |
| 21 — no budgets | Component | Render with empty budgets; row testID absent, `dashboard-budgets-empty` still present. |
| 22 — follows the selected month | Component | Select a past bar whose income differs from the current month's; assert the row's income/percent change and the label carries the month suffix. |
| 23 — no parent/child double-count | Unit | Pure test: budgets on "Food" and "Food > Restaurants" count only Food's limit; an unrelated category still adds. |
| 12 — tap a trend bar to retarget the donut | Component | `DashboardScreen.test.tsx`: tap a non-current `dashboard-trend-bar-*`, assert the donut legend shows that month's rolled-up amounts (not the current month's); assert budgets/KPIs unchanged; assert an active drill-down clears; tap a different bar, assert it re-targets again. |
| 24 — segment sizing | Unit | Pure `gaugeSegments(budgets, spend, radius)`: widths sum to the half circumference, proportional to limit; skips child under budgeted ancestor. |
| 25 — fill + center | Unit + Component | Pure fill ratio test; `DashboardScreen.test.tsx` asserts the rendered dash props and the center copy. |
| 26 — over budget | Unit + Component | Ratio clamps at 1; component asserts over color and unclamped `spent / limit` text. |
| 27 — unbudgeted spend | Unit + Component | Spend of an unbudgeted category is in "Unbudgeted" total only, not the arc or center. |
| 28 — Show more | Component | 7 budgets: 5 rows ordered by usage, expand/collapse. |
| 29 — no budgets | Component | Empty copy present, no arc testID. |
| 30 — month selection | Component | Select a past bar; spend differs from current month; title carries suffix. |
| 31 — hover (web) | Component | Same pattern as criterion 11. |
| 32 — view toggle | Component | Default shows the gauge; pressing `dashboard-view-share` shows the donut and legend; existing donut tests (7, 11, 12, spec 011) first press the toggle. |

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

Criterion 11 (donut hover, below) implemented and verified in the same
pass as this fix.

### Amendment (2026-09-24): hover-to-reveal category on the donut (web only)

New requirement: hovering a donut segment shows that category's name
and spend amount in the donut's center hole (currently always empty);
moving off clears it back to empty.

- **Web only** — hover has no touch/native equivalent, so this changes
  nothing on native. Gated by `Platform.OS === 'web'`: the
  `onMouseEnter`/`onMouseLeave` handlers are only attached to each
  `<Circle>` on web.
- **react-native-svg forwards unrecognized props straight to the DOM
  node** on web (confirmed by reading its `prepare()` source: unknown
  props pass through via a `...rest` spread, untouched) — so
  `onMouseEnter`/`onMouseLeave` work at runtime even though they aren't
  in `Circle`'s TypeScript prop types. Handled with one typed cast on
  the `Circle` reference for this usage, rather than `as any`-ing every
  prop individually.
- New acceptance criterion 11 (see Acceptance criteria section above).

**Result:** ✅. `DashboardScreen.test.tsx` gained two tests: one with
`Platform.OS` set to `'web'` firing `mouseEnter`/`mouseLeave` on a
`dashboard-donut-arc-*` testID and asserting the center label's category
+ amount appear and clear; one on the native default asserting no hover
label ever appears (no handler attached). 182 tests pass (up from 180),
`tsc --noEmit` clean, web export builds.

### Amendment (2026-09-25): tap a trend bar to retarget the donut at that month

New requirement, reversing this spec's original "no chart interaction"
out-of-scope line: tapping a bar in "Spend, last 6 months" swaps the
"Where it went" donut over to that month instead of always showing the
current month.

- **Selection state: `{ year, month } | null`**, `null` meaning "current
  month" (the default, unchanged behavior). Tapping a bar sets it;
  there's no separate "clear" control — tapping the current month's own
  bar (always the last one) is the way back, same as tapping any other
  bar.
- **Only the donut card moves — budgets, suggestions, and the KPI stack
  stay on the current month.** The user's request was specifically about
  the pie chart; changing what a budget bar or a suggestion means based
  on a clicked trend bar would be a much bigger, confusing behavior
  change nobody asked for. `categorySpend`/`rolledUpTotals` (current
  month, feeding budgets/suggestions/KPIs) and the donut's own reference
  date are computed separately.
- **Selecting a month resets any active drill-down** (spec 011) back to
  the top-level view — simpler and more predictable than trying to
  preserve "drilled into Food" across a month change where Food's
  subcategory mix may look completely different.
- **The donut card's title reflects the selected month** when it isn't
  the current one (e.g. "Where it went — Aug"), combined with the
  drill-down category name when both apply (e.g. "Food — where it went
  — Aug"), so it's never ambiguous which month is on screen.
- **The selected bar is visually marked** (existing `trendBar`/
  `trendLabel` styles get a selected variant) so it's clear which
  month's data the donut is currently showing.

**Result:** ✅ criterion 12. `DashboardScreen.test.tsx`: tapping a
non-current trend bar swaps the donut's legend amounts to that month's
rolled-up totals (distinct from the current month's, in the test data);
the budgets section and KPI stack stay unchanged; the tapped bar's label
turns accent/bold (selected) and the previously-selected one reverts;
tapping a different bar afterward re-targets again; an active drill-down
clears on a month change. 218 tests pass (up from 215), `tsc --noEmit`
clean, `npx expo export -p web` builds.

### Amendment (2026-09-25, implemented): four tabs — `Log` / `Overdraft` / `Manage` / `Dashboard`

Spec 012 (overdraft line) adds a top-level `Overdraft` tab, between `Log`
and `Manage`, because the line is used daily and needs one-tap access to
Log draw / Log payment. Chosen over "under Manage" and "Dashboard hero" on
a design canvas. The three-tab rule above ("group by frequency of use")
still holds: `Overdraft` is a daily-use surface, like `Log`.

- Criterion 9 becomes: `tab-transactions`, `tab-overdraft`, `tab-manage`,
  `tab-dashboard` exist; `tab-categories`/`tab-budgets`/`tab-debts` still
  don't.
- The dashboard's "total debt remaining" KPI includes the overdraft
  balance, and its debt section shows the line as a compact row (spec 012,
  criterion 12).

### Amendment (2026-10-05, implemented): sort the donut by amount, highest first

Found in use: the "Where it went" ring and its legend had no defined order
— `computeDonutSegments` just took `Object.entries()` of whatever record
it was given, which (via `categoryTotalsForMonth`'s walk over transactions,
newest first) put categories in "most recently transacted," not "most
spent." The whole point of this section is "which category is costing me
the most" — the segment at 12 o'clock and the top legend row should be
that category.

- `computeDonutSegments` now sorts its entries by amount descending before
  building segments, ties broken alphabetically by category name (a
  stable order, not whatever `Object.entries()` happened to return). This
  is the one function both the ring and its legend are built from, so
  there's no separate place to apply the same sort twice.
- Applies to the drilled-in subcategory ring the same way — it's the same
  function, fed `subcategoryTotalsFor`'s output instead.
- No change to `categoryTotalsForMonth`/`rollUpCategoryTotals` themselves,
  and no new criterion (this sharpens criterion 7's existing "spend-by-
  category ring" requirement, not a new behavior).

**Result:** ✅. `donutSegments.test.ts` gained tests: segments and their
colors follow amount-descending order regardless of input order; equal
amounts tie-break alphabetically. 467 tests pass (up from 463), `tsc
--noEmit` clean.

### Amendment (2026-10-10, draft): the month selection scopes the whole dashboard (issue #17)

Reverses part of the 2026-09-25 amendment's "Only the donut card moves"
decision. In use, tapping a trend bar while the debt and expense sections
kept showing today made the screen mix two months. Now one selection drives
every figure on the screen **except the suggestions feed**.

- **Selection state is unchanged** — `{ year, month } | null`, `null` =
  current month. One value feeds everything below; no per-section state.
- **Follows the selected month:** the donut (already), the budgets list,
  the spent/saved KPIs, the total-debt KPI, and the debt section.
- **Does not follow:** the suggestions feed. Suggestions are advice about
  *now* (debt pace at today's balance, this month's overrun vs. last
  month); re-deriving them for a past month would produce stale advice
  presented as current. Criterion 17.
- **Labels:** each section title/KPI label takes the same `— {Mon}` suffix
  the donut title already uses (`DashboardScreen.tsx`'s `monthLabels`) when
  a non-current month is selected; "this month" wording ("Spent this
  month", "Budgets this month") is replaced by the suffix form so it is
  never ambiguous.

#### Debt: "debt for month X" = the balance at the end of month X

(Decided 2026-10-10.) Not payments made in the month — the running balance
as of the last instant of month X. For the current month this is simply
today's balance, so the default view is unchanged. Each debt kind
reconstructs it from the history it already has — details in each spec's
2026-10-10 addendum:

| Kind | As-of balance | Exactness |
|------|---------------|-----------|
| Debt (008) | `currentBalance` + payments logged *after* month X | Approximate — see 008 addendum |
| Overdraft line (012) | its event ledger filtered to `date ≤ end of X` | Exact |
| Credit card (013) | tagged expenses and payments filtered to `date ≤ end of X` | Exact |

The total-debt KPI is the sum of these three for the selected month.
Entities that did not exist yet at the end of month X (a debt's
`createdAt` after it; a card with no activity yet; a line with no events
yet) are left out, not shown as zero.

#### Empty states for past months

A month with nothing to show renders the section's existing empty-state
copy, extended with the month ("No debts recorded as of Aug."), rather
than zeros or a blank card. Criterion 16.

#### Resolved from the issue's open questions

1. Debt definition → balance at month end (above).
2. Past months with no data → empty state naming the month.
3. Visual cue → `— {Mon}` suffix on every month-scoped section.
4. Budgets → follow the month; suggestions → stay on the current month.

**Status of this amendment:** approved and implemented (2026-10-10). Specs 008, 012, 013 were reopened
for their addenda and are `implemented` again with it.

**Results (2026-10-10):** ✅ criteria 13–17, test-first (new tests confirmed
failing before the code). `DashboardScreen.test.tsx` — new describe block
covering each criterion; the 2026-09-25 criterion-12 test no longer asserts
that budgets/KPIs stay on the current month (that decision is reversed
above). Pure functions: `debtBalanceAsOf` (`payoffMath.test.ts`),
`balanceAsOf` (`overdraftMath.test.ts`), `cardBalanceAsOf`
(`creditCardMath.test.ts`), `startOfNextMonth` (`monthBounds.test.ts`).
491 tests pass, `tsc --noEmit` clean. Not yet checked in the running app.

### Amendment (2026-10-11, implemented): total budgeted vs. monthly income (issue #15)

New aggregate the per-category bars can't answer: "how much of my income
have I committed across all budgets combined?" One row at the top of the
budgets card; the per-category list below is unchanged.

- **What it shows:** `Σ monthlyLimit` over `Budget` documents, the viewed
  month's income (`monthlyTotals(...).income`, already computed as
  `viewTotals`), and their ratio as a percentage plus a progress bar —
  same track + fill `View` pattern as the existing bars, no new dependency.
- **Placement:** inside the existing budgets card (title "Budgets this
  month" / "Budgets — Aug"), above the per-category list. Not a fourth KPI
  tile: the KPI stack is spent / saved / debt *outcomes*; this is a
  *plan*, and sits with the other plan data.
- **Follows the month selection** (#17, criterion 22): income is the viewed
  month's. Limits are not versioned per month — a `Budget` has one
  `monthlyLimit` — so a past month is compared against today's limits.
  This is the same simplification the per-category bars already make.
- **Pure function** `budgetedVsIncome(budgets, categories, income)` in
  `src/dashboard/aggregation.ts` returns `{ totalBudgeted, income,
  percent | null }` (`percent` null when income is 0); the component only
  formats it, so the edge cases are unit-tested rather than inferred from
  rendering.
- **Subcategories (criterion 23):** a parent budget is compared against
  rolled-up spend (spec 011), so a child budget under it is already
  inside the parent's limit. Summing both would overstate the commitment.
  Rule: skip a budget whose category has an ancestor that also has a
  budget.
- **No schema, repository, rule, or store change.** Read-only, computed
  in memory from stores already loaded.

#### Resolved in review (2026-10-11)

1. **Double-count rule (criterion 23)** → skip a budget whose ancestor is
   also budgeted. Accepted as recommended; the cost (a stricter child
   budget is invisible in this number) is understood.
2. **Over-100% color** → keep the existing over-limit color
   (`colors.chart[1]`, orange), as in the approved mockup's "Over income"
   board. No separate warning tone.
3. **Suggestions** → no new "you've budgeted more than you earn" rule.
   Out of scope, not deferred to a follow-up.

**Status of this amendment:** approved 2026-10-11 (visual reviewed on the
design canvas: normal, over income, zero income, past month) and
implemented the same day.

**Results (2026-10-11):** ✅ criteria 18–23, test-first (the 12 new tests
confirmed failing — `budgetedVsIncome` did not exist — before any code;
criterion 21 passed from the start, being unchanged behavior). Pure
function `budgetedVsIncome` in `src/dashboard/aggregation.ts`
(`aggregation.test.ts`: total and rounding, no clamp above 100%, null
percent on zero income, no budgets, parent/child skip, orphan child still
counted). `DashboardScreen.test.tsx` — new describe block, one test per
criterion 18–23. The criterion 13 test's month-label assertion was narrowed
to the exact card title (`Budgets — {Mon}`), since the new row legitimately
names the month too. 504 tests pass, `tsc --noEmit` clean. Not yet checked
in the running app.

### Amendment (2026-10-15, draft): budget gauge replaces the "Where it went" donut as the main chart (issue #36)

The donut answers "what share of my spend is each category" with no notion
of a budget. The reference (a budgeting app) answers "how much of my budget
have I used, and where" at a glance. Mockups A/B/C are in the issue.

**Proposed decisions** (recommendations, to be confirmed or changed in
review of this diff; nothing is implemented):

| # | Question | Proposal |
|---|----------|----------|
| 1 | Direction | **A. Segmented semicircle gauge** + list. Closest to the reference; reuses the donut's `strokeDasharray` math on a half circle (a new pure `gaugeSegments`, next to `donutSegments.ts`). C is the fallback if A reads poorly on narrow screens. |
| 2 | Replace or sit beside | The gauge takes the donut's slot and becomes the default. The donut stays as a second view in the same card ("Budget" / "Share of spend" toggle), so the share view and the spec 011 drill-down are not lost. |
| 3 | Segment sizing | By **budget share**, as in the reference. Spend share is what the donut already shows. |
| 4 | Spend without a budget | No arc and out of the center figure; one "Unbudgeted" row at the end of the list (criterion 27), so the total is never hidden. |
| 5 | Over budget | Fill capped at the segment, segment and row in the over color (`colors.chart[1]`), real numbers in the text (criterion 26). Overflow would distort the other segments' widths. |
| 6 | Trend-bar selection | Still applies unchanged: the gauge is month-scoped like the rest (criteria 13–16, 30). Limits are today's, as in the budgets card. Criterion 12's donut retargeting remains true for the donut view. |
| 7 | Hover / tap / icons / Show more | Web hover as criterion 11; no native handler. **No category icons in v1**: the app has no icon data on categories, so adding them needs a data-model change, which is its own spec. Show more as criterion 28. |
| 8 | Rendering | `react-native-svg`, already a dependency; no new library. |

**Overlap to settle:** the existing Budgets card (per-category bars, plus the
criterion-18 budgeted-vs-income row) shows the same spent/limit as the
gauge's list. Proposal: keep the Budgets card as is for now and revisit
merging them after the gauge is seen in use; merging is a separate decision.

**Status of this amendment:** approved 2026-10-15 (decisions above accepted
as proposed; Budgets card kept as is). Criteria 24–32 are being implemented
test-first; the spec stays `implemented` for 1–23 until they are verified. Prerequisite from the issue, #34 and #35 (budget lines not showing
paid amounts), is closed.
