# 007 — Category Budgets

**Status:** approved
**Depends on:** 000 (v1 scope — budgets moved in-scope), 001, 002 (transactions/categories this measures against)

## User stories

- As a user, I set a monthly spending limit for a category (e.g. Food:
  $250.000), so I know before the month gets away from me.
- As a user, I see how much I've actually spent in a category this month
  against its limit, and whether I'm over.
- As a user, a category with no limit set just doesn't show a budget —
  budgets are opt-in per category, not a forced default.

## Requirements

### A standing monthly limit, not a budget-per-month history

- One `monthlyLimit` per category, set once, applied every calendar month
  until changed — **not** a separate budget record per month. Full
  envelope budgeting (rollover of unspent amounts, sub-envelopes) is
  explicitly out of scope per spec 000; this is the simplest thing that
  gives a real "am I on track" answer.
- Actual spend is computed, not stored: sum of that category's `expense`
  transactions whose `date` falls in the current calendar month, the same
  client-side aggregation approach spec 000 already commits to for charts.
- A category with no `Budget` document simply has no budget — the
  dashboard (spec 009) skips it, it's never shown as "$0 / $0".

### Data ownership and rules

- `users/{uid}/budgets/{budgetId}` — same per-account scoping and
  Firestore rules pattern as `transactions`/`categories` (spec 002):
  `allow read, write: if isOwner(uid)`.
- One budget per category name (enforced client-side: setting a budget
  for a category that already has one updates it in place, not a
  duplicate).

### Where this is set

- A small dedicated "Budgets" list/form, not folded into the transaction
  form — setting a limit is a separate, infrequent action from logging a
  transaction. Reuses spec 003's primitives (`Input`, `Button`, `Card`),
  no new design-system work.
- Not part of this spec: the dashboard view that *shows* budget-vs-actual
  progress bars (spec 009) — 007 is the data model and the screen to set
  a limit; 009 is where it's visualized.

## Data model

```
users/{uid}/budgets/{budgetId}
  category: string     // matches a starter-set or custom category name
  monthlyLimit: integer  // whole CLP, same convention as transactions.amount
  createdAt: timestamp
  updatedAt: timestamp
```

## Acceptance criteria

1. **Given** a category with no budget, **when** a user sets a monthly
   limit for it, **then** a `Budget` document is created and the limit
   persists across app restarts.
2. **Given** a category that already has a budget, **when** the user sets
   a new limit for the same category, **then** the existing document is
   updated in place — no duplicate budget for the same category.
3. **Given** a budget and some expense transactions in that category this
   month, **then** the computed actual-spend total only includes
   transactions dated in the current calendar month, `expense` type, that
   category.
4. **Given** an amount of zero, negative, or non-integer, **when** the
   user tries to save a budget limit, **then** the save is rejected with
   an inline validation error (reusing spec 002's `validateAmount`).
5. **Given** a budget, **when** the user deletes it, **then** the category
   goes back to having no budget (not a "$0 limit").
6. Firestore security rules reject any read/write to
   `users/{uidA}/budgets/*` from a client authenticated as `uidB`.

## Out of scope

- Full envelope budgeting (rollover, sub-envelopes) — per spec 000.
- The dashboard's budget-vs-actual visualization — spec 009.
- Budget periods other than calendar-month (weekly, custom ranges).
- Notifications/alerts when a budget is crossed — the dashboard/
  suggestions (spec 009) surface this passively, not via push/email.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1, 2 — create/update in place | Unit | Store/repository test: set budget for a new category, then again for the same category, assert one document, latest value. |
| 3 — actual-spend computation scoped correctly | Unit | Pure function test: given a transaction list and a category/month, assert only matching `expense` transactions in the current month are summed. |
| 4 — validation | Unit | Reuses `validateAmount`'s existing test coverage; a new test confirms the budget form wires it the same way spec 002's transaction form does. |
| 5 — delete removes the budget, not zeroes it | Unit | Store/repository test: delete path, category has no budget afterward. |
| 6 — cross-user isolation | Integration (Firebase emulator) | `rules-unit-testing`: authed as `uidB`, attempt read/write on `uidA`'s budgets, expect denial. |

Unit/component tests against mocked Firebase (matching spec 002's
pattern); rules tests against the local emulator, never a real project.
