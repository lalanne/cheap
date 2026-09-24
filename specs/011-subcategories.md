# 011 — Subcategories

**Status:** implemented
**Depends on:** 002 (transactions/categories), 007 (budgets — spend now
rolls up subcategories too, 2026-09-25 amendment), 009 (dashboard — the
donut this spec changes)

## User stories

- As a user, I want to see how much I spent on Food overall, but also
  break that down into Groceries, Uber Eats, and Restaurants, so I know
  what's actually driving that number.

## Decisions

- **One level of nesting only.** A category either has no parent, or has
  a parent that itself has no parent — no sub-subcategories. Kept simple
  deliberately: the "add category" parent picker only ever offers
  starter categories and existing *top-level* custom categories, which
  structurally prevents deeper nesting or cycles without needing extra
  validation.
- **A subcategory is a custom category with a `parentCategory`.** Same
  document, same collection (`users/{uid}/categories`) — not a new
  collection, not a new concept. A **starter category can be a parent**
  (the motivating example, Food, is one) but can never itself *be* a
  subcategory — it's a static app constant, not a document (spec 002),
  so there's nothing to attach a parent to.
- **`parentCategory` is a plain name string, like everything else here.**
  Matches spec 002's explicit decision that `Transaction.category` and
  `Budget.category` are plain strings, not foreign keys — same reasoning:
  no referential integrity to maintain, no cascade needed on delete (see
  below).
- **Transactions still store a single flat `category` string — the leaf.**
  A transaction logged against "Uber Eats" stores `category: "Uber Eats"`,
  never `"Food"` and never both. Roll-up into the parent's total happens
  at read time (a new pure function), not at write time — so nothing
  about `Transaction`'s shape or spec 002's data model changes.
- ~~Budgets do NOT roll up subcategory spend (v1) — a real, explicit
  gap.~~ **Reversed 2026-09-25 — see the amendment below.** This
  shipped exactly the confusion flagged here: the real account's Food
  budget bar showed $88,450 while the same month's donut showed
  $541,041 for Food, because the bar read raw (unrolled) spend and the
  donut read rolled-up spend. Real user report, not a hypothetical.
- **Deleting a parent doesn't cascade or clean up its former children —
  same precedent as spec 002's category delete.** A subcategory whose
  parent was deleted keeps its own `parentCategory` string, now
  dangling. The roll-up function's fallback: a subcategory whose parent
  name doesn't match any current category (starter or custom) is
  treated as its own top-level bucket — it doesn't disappear or crash,
  it just stops being folded into anything.
- **Drill-down via tap, on the legend row — not the arc.** Chosen over
  hover (native has no hover; this needs to work identically on phone
  and web) and over showing everything at once in a nested ring (harder
  to read proportions on a thin outer ring, blank wherever a category
  has no subcategories) — see the design canvas both were compared
  against. A legend row for a category *with* subcategories gets a
  chevron and a hint ("N subcategories"); tapping it swaps the donut and
  legend to that category's own breakdown, with a "← All categories" link
  back. A category with no subcategories behaves exactly as it does
  today — no new affordance, nothing tappable.
- **`computeDonutSegments` (spec 009) is unchanged.** It already just
  takes a flat `Record<string, number>` — the new roll-up function
  produces that shape for the top-level ring, and a second new function
  produces it for a drilled-in parent's subcategory ring. Same rendering
  code serves both.

## Data model

```
users/{uid}/categories/{categoryId}   // custom categories only
  name: string
  type: "expense" | "income" | "both"
  parentCategory: string | null   // NEW — a starter category's name, or
                                   // an existing top-level custom
                                   // category's name; null = top-level
  createdAt: timestamp
```

No change to `users/{uid}/transactions` or `users/{uid}/budgets` — both
keep storing a single flat `category: string` (the leaf), per Decisions
above. No Firestore rules change: the existing
`users/{uid}/categories/{categoryId}` rule (`allow read, write: if
isOwner(uid)`) already covers the new field.

`CategoryRepository.create(name, type, parentCategory)` — `parentCategory`
required (pass `null` for a top-level category), not optional, so every
call site has to make the choice explicitly rather than silently
defaulting.

## New pure functions

- `rollUpCategoryTotals(totals, categories)` — given
  `categoryTotalsForMonth`'s output (spec 009) and the current category
  list, returns a new `Record<string, number>` where each subcategory's
  amount has been added into its parent's entry and the subcategory key
  removed. A subcategory whose parent no longer resolves to any current
  category stays as its own top-level entry (the dangling-parent
  fallback above).
- `subcategoryTotalsFor(totals, categories, parentName)` — given the
  same inputs plus a parent's name, returns a `Record<string, number>`
  of just that parent's direct subcategories and their raw (unrolled)
  amounts — the input to the drilled-in donut.
- Both live in `src/dashboard/categoryRollup.ts`, pure, independently
  unit-testable, no Firestore/React dependency — same pattern as
  `src/dashboard/aggregation.ts`.

## Acceptance criteria

1. **Given** the "add category" form, **when** the user optionally picks
   a parent (a starter category or an existing top-level custom
   category), **then** the new category is created with that
   `parentCategory` and is immediately selectable everywhere a category
   is picked (transaction form, budget form), same as any other category.
2. **Given** a category with subcategories, **when** viewed in the
   Manage tab's Categories panel, **then** its subcategories are listed
   nested beneath it (indented), each still individually deletable, same
   as a top-level custom category.
3. **Given** transactions logged against a subcategory, **when** the
   dashboard's "Where it went" donut renders, **then** that
   subcategory's spend is folded into its parent's slice (`
   rollUpCategoryTotals`) — the parent's slice reflects direct +
   subcategory spend, and the subcategory itself never appears as a
   separate top-level slice.
4. **Given** a category with subcategories, **when** the user taps its
   legend row, **then** the donut and legend swap to that category's own
   subcategory breakdown (`subcategoryTotalsFor`), with a "← All
   categories" link that returns to the top-level view.
5. **Given** a category with no subcategories, **when** its legend row
   is rendered, **then** no chevron/hint appears and tapping it does
   nothing — unchanged from today.
6. **Given** a parent category is deleted, **when** its former
   subcategories' spend is rolled up afterward, **then** they appear as
   their own top-level slice(s) instead of disappearing or crashing (the
   dangling-parent fallback).
7. **Given** `npx tsc --noEmit` and `npx jest`, **then** both stay green.
8. **Given** a budget set on a category with subcategories, **when** the
   dashboard renders that budget's progress bar or a budget-overrun
   suggestion fires for it, **then** the spend shown/evaluated is the
   *rolled-up* total (direct + every subcategory) — the same number the
   donut shows for that category, not a smaller, direct-only figure
   (amendment 2026-09-25).

## Out of scope

- More than one level of nesting (a subcategory of a subcategory) — see
  Decisions.
- Drill-down via tapping the donut arc itself (only the legend row is
  tappable in v1) — the arc still shows the spec 009 hover label on web,
  unchanged.
- Any change to `Transaction`'s or `Budget`'s data model — both still
  store a single flat category string.
- Bulk re-parenting or renaming a category (moving an existing
  subcategory to a different parent) — delete and recreate for now.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1 — create with a parent | Unit + component | Store test: `addCategory` passes `parentCategory` through to the repo. `CategoriesPanel` test: pick a parent in the add form, assert `addCategory` called with it. |
| 2 — nested display in Categories panel | Component | `CategoriesPanel` test: a subcategory renders indented under its parent's row, its own delete button still works. |
| 3 — roll-up into the parent's slice | Unit | `categoryRollup.test.ts`: `rollUpCategoryTotals` — subcategory amount added to parent, subcategory key absent from the result. |
| 4 — drill-down on tap, with a way back | Component | `DashboardScreen.test.tsx`: tap a legend row with subcategories, assert the donut/legend swap to `subcategoryTotalsFor`'s data; tap "← All categories", assert it swaps back. |
| 5 — no affordance for a childless category | Component | `DashboardScreen.test.tsx`: a category with no subcategories renders no chevron/hint; tapping its row is a no-op (no state change). |
| 6 — dangling-parent fallback | Unit | `categoryRollup.test.ts`: a subcategory whose `parentCategory` matches nothing in the category list appears as its own key in the rolled-up result, not folded into anything and not dropped. |
| 7 — no regressions | Automated | `npx tsc --noEmit`, `npx jest`. |
| 8 — budgets/suggestions use rolled-up spend | Unit + component | `DashboardScreen.test.tsx`: a budget on "Food" with subcategory transactions shows the rolled-up total in its bar, matching the donut's Food slice; a budget-overrun suggestion fires/doesn't fire based on the rolled-up percent, not the direct-only one. |

## Verification results

Implemented 2026-09-24.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1 — create with a parent | ✅ | `transactionsStore.test.ts`: `addCategory` passes `parentCategory` through. `CategoriesPanel.test.tsx`: pick a parent chip, `addCategory` called with it; defaults to `null` when none picked. |
| 2 — nested display in Categories panel | ✅ | `CategoriesPanel.test.tsx`: a subcategory renders inside its parent's `category-group-*` container (starter-parented and custom-top-level-parented both covered), delete still works on the nested row. |
| 3 — roll-up into the parent's slice | ✅ | `categoryRollup.test.ts` (unit) + `DashboardScreen.test.tsx` (component): Groceries + Uber Eats fold into Food's legend amount; neither appears as its own top-level row. |
| 4 — drill-down on tap, with a way back | ✅ | `DashboardScreen.test.tsx`: tap Food's legend row → donut/legend swap to `subcategoryTotalsFor`'s data, `dashboard-donut-back` appears; tap it → swaps back to the top-level view. |
| 5 — no affordance for a childless category | ✅ | `DashboardScreen.test.tsx`: tapping Housing's row (no subcategories) is a no-op — no chevron/hint rendered, no `onPress` attached. |
| 6 — dangling-parent fallback | ✅ | `categoryRollup.test.ts` + `DashboardScreen.test.tsx`: a subcategory whose parent no longer exists (`Deleted Parent`) shows as its own top-level slice, not dropped or misfiled. |
| 7 — no regressions | ✅ | 199 tests pass (up from 182), `tsc --noEmit` clean, `npx expo export -p web` builds. |

### Amendment (2026-09-25): budgets/suggestions now use rolled-up spend

Real bug, reported live: the account's Food budget bar showed $88,450
(direct-only spend) while the same month's donut showed $541,041 for
Food (rolled up). Same category, two different numbers on the same
screen — exactly the confusion this spec's original Decisions section
predicted and deliberately deferred, now confirmed as a real problem
rather than a hypothetical.

- `DashboardScreen.tsx` now computes `rolledUpTotals` *before*
  `computeSuggestions` and passes that (not raw `categorySpend`) both
  into `computeSuggestions` and into the budgets section's per-budget
  `spend` lookup. The donut's own totals were already rolled up — no
  change there.
- Raw `categorySpend` is still kept and still used for one thing: the
  donut's drill-down (`subcategoryTotalsFor` needs each subcategory's
  own unrolled amount to show its individual slice).
- `BudgetsPanel` itself is unaffected — it never displayed spend, only
  the monthly limit, so there was nothing to fix there.
- `src/budgets/computeCategorySpend.ts` (spec 007) is untouched — it's
  dead code as far as the dashboard is concerned (imported in
  `DashboardScreen.tsx` but never called; superseded by
  `dashboard/aggregation.ts`'s `categoryTotalsForMonth` when spec 009
  shipped). Not removed here — out of scope for a bug fix, noted for a
  future cleanup pass.

**Result:** ✅ criterion 8. `DashboardScreen.test.tsx` gained a test: a
budget on "Food" ($60,000 limit) with a direct Food transaction
($30,000) plus a Groceries subcategory transaction ($40,000) shows
$70,000/$60,000 (117%, over) in its bar and fires a budget-overrun
suggestion — both of which raw (direct-only, $30,000/$60,000, under)
would have missed entirely. Existing criterion-2 test (spec 009, a
childless category over budget) still passes unchanged. Full suite
green, `tsc --noEmit` clean, web export builds.

**What shipped:**
- `src/transactions/types.ts` — `Category.parentCategory: string \| null`; `CategoryRepository.create` gained a required third `parentCategory` param.
- `src/transactions/providers/firestoreCategoryRepository.{native,web}.ts` — write/read the new field.
- `src/transactions/transactionsStore.ts` — `addCategory(name, type, parentCategory)`.
- `src/dashboard/categoryRollup.ts` — `rollUpCategoryTotals`, `subcategoryTotalsFor`, pure and independently tested.
- `src/screens/CategoriesPanel.tsx` — add form gained a "Parent category (optional)" chip picker (starter categories + top-level custom categories only, never an existing subcategory); list restructured into per-top-level-category groups with nested, individually-deletable subcategory rows.
- `src/screens/DashboardScreen.tsx` — donut now renders `rollUpCategoryTotals`'s output at the top level; a legend row for a category with subcategories gets a chevron + count and is tappable, swapping the donut/legend to `subcategoryTotalsFor`'s data with a "← All categories" back link. The existing hover-to-reveal feature (spec 009 amendment) works unchanged against whichever ring is currently shown. `categorySpend` (raw, unrolled) stays exactly as before for budgets/suggestions — the explicit "budgets don't roll up" gap from this spec's Decisions.
- No Firestore rules change (same collection, existing `isOwner` rule already covers the new field) — not re-run against the emulator, matching spec 002's amendment precedent for a field-only addition.

Staying at `implemented`, not `verified` — no manual browser pass yet, same as every other spec here.
