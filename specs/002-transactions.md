# 002 — Transactions: Data Model & Manual Entry

**Status:** implemented
**Depends on:** 000, 001

## User stories

- As a user, I can log an expense (amount, category, date, optional note) so
  it's captured for later analysis.
- As a user, I can log income the same way, so I see money coming in as well
  as going out.
- As a user, I can edit or delete a transaction I previously entered, to fix
  mistakes.
- As a user, I can see a list of my transactions, most recent first, to
  review what I've logged.

## Requirements

- A transaction is either `expense` or `income` — one `type` field, one
  collection, not two.
- Fields: amount, type, category, date, optional note, createdAt/updatedAt.
- **Amounts stored as whole integers**, not floats. Chilean pesos (CLP —
  the only currency in v1, per spec 000) have no minor unit in circulation,
  so there are no "cents" to store; an integer peso count avoids
  floating-point rounding errors while matching how CLP is actually used
  (amounts are always whole numbers, e.g. `$15.990`, never `$15.990,50`).
- Categories: a fixed starter set (Food, Transport, Housing, Utilities,
  Entertainment, Health, Shopping, Income, Other) plus user-defined custom
  categories, persisted per account.
- Data lives under `users/{uid}/transactions/{id}` — scoped per account
  (v1 is single-user, per spec 000).
- Firestore security rules restrict all reads/writes to the owning `uid`.
- List view sorted by transaction `date` descending (not `createdAt` —
  someone logging yesterday's coffee today should see it slot into
  yesterday).
- **The date field is a native date-picker popup** (`DateTimePicker`),
  not a typed `YYYY-MM-DD` text field — the original text-field decision
  was flagged in this spec's own Verification results as "worth
  revisiting for real usability once this ships to a device," and a real
  device user confirmed it's not usable. Platform-native picker UI
  (wheel/calendar sheet) on iOS/Android; an HTML `<input type="date">` on
  web.
- Single currency in v1 (per spec 000) — no currency field needed yet.
- Requires a signed-in `uid` (spec 001) — `users/{uid}` must already exist.

### Amendment (2026-09-22): a dedicated Categories screen, with delete

Real gap found using the app: categories were only manageable inline
from the transaction form's "+ New" chip — no way to see the full
custom-category list at a glance, and no way to delete one. Categories
matter enough (they're the thing both transactions *and* budgets, spec
007, key off) to get their own screen, not stay buried inside another
one.

- New `CategoriesScreen` — reachable from its own tab, list of custom
  categories with add/delete, same list+form pattern as
  `BudgetsScreen`/`DebtsScreen`. The existing inline "+ New" chip in
  `TransactionsScreen`'s category picker stays too — this is additive,
  not a replacement for the quick-add-while-logging flow.
  **(Superseded 2026-09-23 — see spec 009's amendment):** the standalone
  tab was cut back down as part of a five-tab-to-three consolidation;
  the same list/add/delete UI now lives as `CategoriesPanel`, composed
  into the `Manage` tab alongside `BudgetsPanel`/`DebtsPanel`, not on
  its own screen. Nothing about criterion 9's behavior changed, only
  where it's reached from.
- `CategoryRepository` gains `delete(id): Promise<void>` — no Firestore
  rules change needed (`users/{uid}/categories/{categoryId}`'s existing
  `allow read, write: if isOwner(uid)` already covers delete).
- **Starter categories (Food, Transport, …) are not deletable** — they're
  a static app constant, not a Firestore document (see Data model), so
  there's nothing to delete; `CategoriesScreen` only lists and offers
  deletion for custom (stored) categories.
- Deleting a category does **not** touch transactions or budgets that
  already reference its name by string — spec 002's data model was
  never a foreign-key relationship (category is a plain `string` on both
  `Transaction` and `Budget`), so a deleted category simply stops being
  offered as a picker option going forward; existing records keep
  showing their category name as plain text, same as if a starter
  category were renamed in spirit only. No cascade, no orphan cleanup
  needed.

## Data model

```
users/{uid}/transactions/{transactionId}
  type: "expense" | "income"
  amount: integer          // whole CLP; always positive; sign implied by `type`
  category: string         // starter-set key, or a custom category id
  date: timestamp          // user-specified transaction date
  note: string | null
  createdAt: timestamp
  updatedAt: timestamp

users/{uid}/categories/{categoryId}   // custom categories only —
  name: string                        // starter set is a static app constant
  type: "expense" | "income" | "both"
  createdAt: timestamp
```

`CategoryRepository`: `subscribe`, `create(name, type, parentCategory)`
(gained `parentCategory` — spec 011), (added 2026-09-22) `delete(id)`,
and (added 2026-09-24) `update(id, name, parentCategory)`. Deleting and
editing are only ever offered for a document in this collection — the
starter set has no `id` to act on.

## Acceptance criteria

1. **Given** a signed-in user on the "add transaction" screen, **when** they
   enter an amount, pick a type and category, and save, **then** a new
   document is created under `users/{uid}/transactions` with the correct
   fields, and it appears in their transaction list.
2. **Given** an amount of zero, negative, blank, or with decimal digits
   (e.g. `1500.50`), **when** they try to save, **then** the save is
   rejected with an inline validation error and no document is created.
3. **Given** an existing transaction, **when** the user edits its
   amount/category/date/note and saves, **then** the same document is
   updated in place (no duplicate) and `updatedAt` changes.
4. **Given** an existing transaction, **when** the user deletes it, **then**
   it disappears from the list and the document no longer exists.
5. **Given** a user picks a date other than today, **when** they save,
   **then** the transaction is sorted into the list by that date, not by
   `createdAt`.
8. **Given** a user opens the date field, **when** they interact with it,
   **then** a native date-picker popup appears (not a keyboard/text
   field), and picking a date sets the transaction's date to that value.
6. **Given** a user wants a category outside the starter set, **when** they
   create a custom category with a name, **then** it's selectable
   immediately and persists across app restarts.
7. Firestore security rules reject any read/write to
   `users/{uidA}/transactions/*` from a client authenticated as `uidB`.
9. **Given** a custom category with no budget/transaction dependency
   enforced, **when** the user deletes it from `CategoriesScreen`,
   **then** the document is removed and it no longer appears as a picker
   option in the transaction form, the budget form, or `CategoriesScreen`
   itself — while any transaction/budget that already used its name is
   untouched.
10. **Given** a custom category, **when** the user taps its row and
    renames it, **then** the category document's name changes and every
    transaction/budget that referenced the old name now references the
    new one — not left stale (amendment 2026-09-24).
11. **Given** a top-level custom category with subcategories, **when**
    editing it, **then** no parent picker is offered — it can't be
    re-parented while it still has children (spec 011's one-level cap).
    **Given** a subcategory, **then** it can always change parent
    (including back to top-level), since it can never itself have
    children.
12. **Given** the transaction list, **when** it renders, **then**
    transactions are grouped into sections by calendar month (most
    recent month first), each headed by its month name + year and that
    month's total spend (expense transactions only, matching the
    Dashboard's "Spend" language) — transactions within a month keep
    their existing date-descending order (criterion 5) beneath it
    (amendment 2026-09-25).
13. **Given** the app on web, **when** the user scrolls past a month's
    transactions, **then** that month's header stays pinned at the top
    until the next month's header reaches it. **Given** native, **then**
    headers are not pinned (React Native's style system has no `sticky`
    position) but remain grouped and labeled identically.
14. **Given** the transaction list on narrow/native with at least one
    transaction, **then** no page-level "Add" button appears — each
    month's header instead carries its own add button, opening the same
    form with the same defaults (today's date, expense, first category)
    as before; it is not aware of which month's header it was pressed
    from (amendment 2026-09-25).
15. **Given** zero transactions, **when** the screen renders with the
    form closed, **then** an empty-state message appears with its own
    Add button (there being no month header to attach one to yet), and
    pressing it opens the same add-transaction form as always.

## Out of scope

- Recurring transactions, bank sync, multi-currency (all deferred per 000).
- The dashboard/charts that consume this data — separate spec.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1, 5 — create, sorted by date | Component/unit | Form submit handler test + list-sort logic test. |
| 2 — validation rejects invalid amounts | Unit | Validation function: zero/negative/blank/decimal amount cases. |
| 3 — edit updates in place | Unit | Store/repository test: edit path writes to same doc id, `updatedAt` changes. |
| 4 — delete removes the doc | Unit | Store/repository test: delete path, doc no longer in local state. |
| 6 — custom categories persist | Component/unit | Create category → available in picker → reload → still there (mocked persistence). |
| 7 — cross-user isolation | Integration (Firebase emulator) | `rules-unit-testing`: authed as `uidB`, attempt read/write on `uidA`'s transactions, expect denial. |
| 8 — native date-picker popup | Component/unit | Render form, open date field, fire the picker's `onChange`, assert the selected date is used on save. |
| 9 — delete a custom category | Unit + component | Store/repository test: delete path, doc no longer in local state; `CategoriesScreen` test: deleted category disappears from its own list; existing transactions/budgets referencing it are unaffected (they store a plain string, not a reference). |
| 10 — rename cascades to transactions/budgets | Unit | Repository tests: `renameCategoryInTransactions`/`renameCategoryInBudgets` query-and-batch-update the matching docs. Store/component test: `CategoriesPanel` edit → rename calls both cascades when the name changed, neither when only the parent changed. |
| 11 — re-parent blocked for a category with children | Component | `CategoriesPanel` test: editing a top-level category with subcategories renders no parent picker; editing a subcategory always shows one, including a "None" option. |
| 12 — grouped by month, most recent first | Unit + component | `groupByMonth.test.ts`: transactions across several months split into the right groups, in the right order, each with the correct expense-only total. `TransactionsScreen` test: month header text and per-month row order rendered from real store data. |
| 13 — sticky on web, plain grouping on native | Component | `TransactionsScreen` test: the month header's style includes `position: 'sticky'` when `Platform.OS` is `'web'`, and does not on the native default — actual pinned-while-scrolling behavior needs a manual browser pass (no browser automation available), same caveat as every other visual-only behavior in this app. |
| 14 — no page-level Add, per-month Add instead | Component | `TransactionsScreen` test: with transactions present, `add-transaction-button` (the old page-level testID) is absent; a per-month button (`add-transaction-button-${year}-${month}`) opens the form with the same defaults as before. |
| 15 — empty-state Add for a brand-new account | Component | `TransactionsScreen` test: zero transactions renders an empty-state message and `add-transaction-button`; pressing it opens the form. |

Unit/component tests run against mocked Firebase (matching `da2`'s
`src/**/__tests__/` pattern); rules tests run against the local emulator
(matching `firebase/tests/**` + `jest.rules.config.js`), never a real
project.

## Verification results

All rows pass: 61 unit/component tests (`npx jest`, up from 43 after spec
001) and 10 Firestore rules tests against the local emulator (`npm run
test:rules` — 5 new, covering `users/{uid}/transactions` and
`users/{uid}/categories`). `tsc --noEmit` is clean; `npx expo export -p
web` builds (1.4MB, up from 680KB — `firebase/firestore` added on top of
`firebase/auth`).

`firestore.rules`'s extension (adding the `transactions`/`categories`
subcollection rules) was deployed to the real `lalanne-cheap-tracker`
project. I did not repeat a full live smoke test for this spec — the new
rules reuse the exact same `isOwner()`/`signedIn()` functions the auth
spec's live smoke test already cross-checked against production, just
applied to a different path pattern, and the emulator suite exercises
both the allow and deny cases directly against the identical rules file
that's now deployed. A live end-to-end write (as a real, *verified*
account) remains unexercised, since verifying an account needs a real
inbox and a clicked link, which nothing here can automate.

**Real gaps, not silently skipped:**
- ~~No dashboard/charts~~ — **resolved**: spec 009 shipped the dashboard.
- ~~The date field is a plain `YYYY-MM-DD` text input, not a calendar
  picker~~ — **resolved 2026-09-18**: a real device user confirmed typing
  a date is unusable; replaced with `@react-native-community/datetimepicker`
  (native popup on iOS/Android, `<input type="date">` on web). See
  criterion 8.
- I could not click through the running app in a browser — no browser
  automation tool was available in this environment. Confirmed via the
  full automated suite and a successful web export instead.

**Amendment (2026-09-23) — criterion 9, dedicated Categories screen with
delete:** real gap found using the app: categories were only manageable
inline from the transaction form's "+ New" chip, no way to see the full
list or delete one. Added `CategoryRepository.delete(id)` (native + web,
no Firestore rules change needed — the existing
`users/{uid}/categories/{categoryId}` rule already covers delete) and a
new `CategoriesScreen`: lists starter categories (no delete — they're a
static constant, not a stored document) and custom categories (with
delete), plus the same add-a-category form the inline flow already had.
Reachable from a new `Categories` tab in `App.tsx` (now 5 tabs:
Transactions/Categories/Budgets/Debts/Dashboard). 174 tests pass (up
from 168), 16 rules tests pass, `tsc --noEmit` clean, web export builds.
The inline "+ New" chip in `TransactionsScreen` stays too — additive,
not a replacement for quick-add-while-logging.

### Amendment (2026-09-24): edit an existing category (rename + re-parent)

Real gap: a custom category could be created and deleted, but never
edited — a typo in a category name, or deciding after the fact that
"Groceries" should nest under "Food" (spec 011), meant delete-and-recreate,
which loses the connection to every transaction/budget that already used
the old name (spec 002's data model is a plain string, not a foreign key
— deleting and recreating gets a *different* string in every sense that
matters here).

- **New `CategoryRepository.update(id, name, parentCategory)`** — updates
  the category doc's `name` and `parentCategory` fields.
- **Renaming cascades to every transaction and budget currently using the
  old name — the one deliberate exception to "plain string, no cascade."**
  Spec 002's original decision (category as a plain string) was about not
  maintaining referential integrity on *delete* — cheap, because a
  deleted category's old transactions/budgets keep meaning what they always
  meant (the string is stable). A *rename* is different: leaving old
  transactions/budgets on the stale name after a rename doesn't preserve
  meaning, it silently orphans them — a budget on the old name would
  start tracking nothing, and the category picker would offer only the
  new name going forward. Renaming without the cascade would make "edit"
  actively misleading rather than merely limited, so this is the one
  place a plain-string design needs an explicit bulk update instead of
  none at all.
  - `TransactionRepository` gains `renameCategoryInTransactions(oldName,
    newName)` — query `users/{uid}/transactions` where `category ==
    oldName`, batch-update matching docs.
  - `BudgetRepository` gains `renameCategoryInBudgets(oldName, newName)`
    — same shape, at most one matching doc (spec 007: one budget per
    category).
  - Orchestrated from `CategoriesPanel` (already the one place composing
    both `useTransactionsStore` and `useBudgetsStore`, via `ManageScreen`
    — spec 009's amendment): on save, `transactionsStore.updateCategory`
    (doc rename + transactions cascade) runs first, then
    `budgetsStore.renameCategoryInBudgets` if the name actually changed.
    Not touched: debts — a debt's auto-created transactions use the
    debt's own name (spec 008), never a picked category, so category
    renames have no bearing there.
- **Re-parenting a top-level category that currently has subcategories is
  blocked** — giving it a parent while it still has children would put
  those children two levels deep, violating spec 011's one-level cap. The
  edit form simply doesn't offer a parent picker for a category with
  children (must stay top-level); a subcategory (which can never have
  children, by construction — see spec 011) can always freely change
  parent, including back to "None" to become top-level.
- **Starter categories remain not editable** — still a static app
  constant, not a stored document, unchanged from criterion 9's
  amendment.
- **UI**: tapping a custom category's row (not its delete button) opens
  the same add/edit form pre-filled with its current name and parent —
  same single-form-two-modes pattern `BudgetsPanel` already established
  for budgets.
- No Firestore rules change — same collection, same `isOwner` rule; the
  cascade writes are plain authenticated writes to the user's own
  `transactions`/`budgets` subcollections, already covered.

**Result:** ✅ criteria 10/11. `firestoreCategoryRepository.native.test.ts`
(`update`), `firestoreTransactionRepository.native.test.ts` and
`firestoreBudgetRepository.native.test.ts` (`renameCategoryIn*`, both the
matching-docs and no-match-no-op cases), `transactionsStore.test.ts`
(`updateCategory` cascades to transactions only when the name changed),
`budgetsStore.test.ts` (`renameCategoryInBudgets`), and
`CategoriesPanel.test.tsx` (edit form pre-fill, rename + re-parent save
paths, the budgets cascade firing only on a real name change, the parent
picker hidden for a category with children and always present for a
subcategory, starter categories still not editable). 214 tests pass (up
from 207), `tsc --noEmit` clean, `npx expo export -p web` builds.

Staying at `implemented`, not `verified`, for the same reason as spec
001: `verified` means checked against the running app, and that hasn't
happened yet on a real device/browser.

### Amendment (2026-09-25): group the transaction list by month

New requirement: the flat, ungrouped transaction list gets hard to scan
once there's more than a month or two of history. Explored three
groupings on a design canvas (a plain divider; a header with a monthly
spend total, meant to stay pinned while scrolling; a header with a full
income/expense/net recap card) — picked the middle one.

- **Grouping is a pure function, `groupTransactionsByMonth`**
  (`src/transactions/groupByMonth.ts`) — takes the already
  date-descending-sorted `transactions` array (criterion 5) and buckets
  it into `{ year, month, totalSpent, transactions }[]`, most recent
  month first. It does **not** sort internally — it relies on the
  caller's precondition that the input is already sorted, same
  assumption `last6MonthsExpense`/`categoryTotalsForMonth` (spec 009)
  already make about their inputs. `totalSpent` sums only `expense`
  transactions, matching the Dashboard's "Spend" language (spec 009) —
  not net, so it lines up with what "Spend, last 6 months" already
  means elsewhere in the app.
- **Per-row dates drop from a full ISO string to "Mon D"** (e.g. "Sep
  22") — once the month is already named once in the section header,
  repeating the full year/month on every single row is redundant and
  noisier to scan. A direct consequence of adding the header, not a
  separate, unrelated tweak.
- **Sticky is web-only, by design — not a compromise nobody agreed to.**
  True cross-platform "pinned while scrolling" needs either React
  Native's `SectionList` (its `stickySectionHeadersEnabled`) or a
  restructure of the shared `Screen` component (every screen in the app
  wraps its content in `Screen`'s own `ScrollView`; nesting a
  `SectionList` inside that ScrollView is the exact
  "VirtualizedLists should never be nested inside plain ScrollViews"
  anti-pattern React Native warns about). CSS `position: sticky` on the
  month header `View`, applied only when `Platform.OS === 'web'`
  (react-native-web forwards it straight through to real CSS; React
  Native's native style system has no `sticky` value for `position` at
  all — it would silently do nothing there even if set), gets the exact
  same visual result on web with none of that restructuring, at the cost
  of no pinning on native. Same shape of platform tradeoff as spec 009's
  hover-to-reveal amendment (web-only, because native has no hover
  either) — flagged here for the same reason, not slipped in quietly.
  Every month's transactions are still grouped and labeled identically
  on native, just without the pin.
- **Applies to both the narrow and wide-web layouts unchanged** — the
  wide layout's list column (spec 006) renders the same grouped sections,
  just narrower; no separate wide-specific version needed.

**Result:** ✅ criteria 12/13. `groupByMonth.test.ts` (unit): grouping
order, expense-only `totalSpent`, within-month order preserved, empty
input. `TransactionsScreen.test.tsx` (component): month header text +
spend total from real store data, header/row render order across
months, abbreviated per-row dates (no full ISO string left visible),
`position: 'sticky'` present on the header's style when `Platform.OS`
is `'web'` and absent on the native default. 227 tests pass (up from
218), `tsc --noEmit` clean, `npx expo export -p web` builds. Actual
pinned-while-scrolling behavior in a real browser is unverified — no
browser automation available, same standing gap as every other
visual-only behavior in this app.

### Amendment (2026-09-25): the Add button moves beside each month, not the page

Continuation of the same "a month column in the Log" design canvas as
spec 006's companion amendment — picked differently per platform: the
rail (spec 006) for wide web, folding Add into the existing sticky
month header for narrow/native.

- **The page-level "Add" button is removed on narrow/native.** Each
  month header (already sticky on web since the 2026-09-24 amendment)
  gains a small "+" button, testID `add-transaction-button-${year}-${month}`
  — distinct per month, since there can be several on screen for a long
  history and testIDs must stay unique.
- **Deliberately not month-aware.** Tapping any month's "+" opens the
  exact same form with the exact same defaults (today's date, expense,
  first category) as the old page-level button always did — it does not
  pre-fill a date inside that section's month. A smarter version of this
  is a real, separate feature (and a real design question — first of the
  month? Last transaction's date? Today, clamped into that month?), not
  something to guess at silently while relocating a button.
- **Real gap fixed as a side effect, not scope creep — the empty-account
  case.** With the page-level button gone, an account with zero
  transactions would otherwise have *no* way to add a first one (there's
  no month header yet to attach a "+" to). A dedicated empty state (see
  criterion 15) fills that gap; `add-transaction-button` (the original,
  singular testID) now lives there exclusively, which is also exactly
  the state every existing "creates a transaction" test already uses
  (`mockStore()` with no transactions) — those tests keep passing
  unchanged.

**Result:** ✅ criteria 14/15. `TransactionsScreen.test.tsx` gained three
tests: no `add-transaction-button` once at least one transaction exists;
a month's own `add-transaction-button-${year}-${month}` opens the form
with the same defaults as before; zero transactions shows a "no
transactions yet" message with its own `add-transaction-button`, which
opens the form and saves correctly. All 8 pre-existing tests pass
unchanged — every one of them exercises the empty-transactions case to
open the add form, which is exactly where `add-transaction-button` still
lives. 235 tests pass (up from 227), `tsc --noEmit` clean, web export
builds.

### Amendment (2026-09-29, approved): an optional card on an expense — spec 013

Spec 013 (credit cards) needs to know which transactions were paid on a
card, without inventing a second place to log spending (see that spec's
"Why not a separate ledger" for the reasoning). This amendment is the
minimal hook it needs.

- `Transaction` and `NewTransactionInput`/`UpdateTransactionInput` gain an
  optional `cardId: string | null` — which credit card (if any) paid for
  this expense. `null`/absent means paid another way (cash, debit,
  whatever) — unchanged from today, and every existing transaction reads
  as `null`.
- **Only valid on an `expense`.** The form only offers a card picker when
  logging or editing an expense; an `income` transaction's `cardId` is
  always `null`. Not a rules-enforced constraint (v1 has none of those on
  field shapes) — the UI simply never offers it, same trust level as the
  rest of this app's client-side validation.
- No other change to how a transaction is created, edited, deleted or
  aggregated — `cardId` is inert to every existing screen and computation
  until spec 013's own code reads it.

16. **Given** the expense form, **when** a card is picked, **then** the
    saved transaction's `cardId` matches it; left unpicked, `cardId` is
    `null`. **Given** the income form, **then** no card picker is offered
    and `cardId` is always `null`.
17. **Given** an existing transaction, **when** it's edited to add, change
    or clear its card, **then** only `cardId` changes — amount, category,
    date and note are unaffected.

Verification: unit tests on `NewTransactionInput`/`UpdateTransactionInput`
handling in the store and both `.native`/`.web` repositories (mirroring
the existing amount/category/date field tests); a `TransactionsScreen`
component test for the picker appearing only on the expense form.
