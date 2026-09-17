# 002 — Transactions: Data Model & Manual Entry

**Status:** approved
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
- Single currency in v1 (per spec 000) — no currency field needed yet.
- Requires a signed-in `uid` (spec 001) — `users/{uid}` must already exist.

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
6. **Given** a user wants a category outside the starter set, **when** they
   create a custom category with a name, **then** it's selectable
   immediately and persists across app restarts.
7. Firestore security rules reject any read/write to
   `users/{uidA}/transactions/*` from a client authenticated as `uidB`.

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

Unit/component tests run against mocked Firebase (matching `da2`'s
`src/**/__tests__/` pattern); rules tests run against the local emulator
(matching `firebase/tests/**` + `jest.rules.config.js`), never a real
project.
