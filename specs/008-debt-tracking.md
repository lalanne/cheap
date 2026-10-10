# 008 — Debt Tracking

**Status:** draft (amended 2026-10-10 — criterion 8 pending; issue #17)
**Depends on:** 000 (v1 scope — debt tracking moved in-scope), 001, 002 (a
logged payment creates a regular expense transaction)

## User stories

- As a user, I record what I owe (a credit card, a loan) — the balance, a
  minimum payment, and optionally an interest rate — so debt is tracked
  as its own thing, not just an anonymous expense line.
- As a user, I log a payment against a debt and see the balance go down
  and the payoff progress move — the payment still shows up as a normal
  expense too, so my spend totals stay accurate.
- As a user, I see roughly how long a debt takes to clear at my current
  payment pace.

## Requirements

### A `Debt` entity, separate from a category

- `users/{uid}/debts/{debtId}` — same per-account scoping and rules
  pattern as `budgets`/`transactions`/`categories`.
- Fields: `name`, `originalAmount`, `currentBalance`, `minimumPayment`,
  optional `interestRate`. Balance and payments are whole CLP integers,
  same convention as everywhere else in this app (spec 002).

### Logging a payment ties an expense transaction to the debt

- A **"Log payment"** action on a debt: takes an amount, and atomically
  (a) creates a normal `expense` transaction (category: the debt's own
  name, e.g. `"Credit Card"` — appears in the starter/custom category
  list the same as any other) and (b) decreases that debt's
  `currentBalance` by the same amount. This is the one place a
  transaction and a debt update happen together — everywhere else in the
  app they're independent.
- `currentBalance` can also be edited directly (a plain "Edit debt"
  action, no transaction created) — for corrections, or for balance
  changes this app doesn't model yet (e.g. accrued interest). Direct
  edits are explicitly *not* logged as transactions.
- A debt reaching `currentBalance` of `0` is **not** auto-deleted — it
  stays in the list, shown as paid off; deleting it is a separate,
  explicit user action.

### Payoff estimate — simple, not amortization

- `monthsToPayoff = currentBalance / minimumPayment` (integer months,
  rounded up), computed, never stored. Deliberately ignores
  `interestRate` for v1 — a true amortization schedule (compounding
  interest, the case where a minimum payment doesn't even cover monthly
  interest) is real complexity with real edge cases, and the simple
  estimate is what the approved dashboard mockup (spec 009, Option D)
  actually shows ("clears in ~14 months at the current pace"). Revisit
  only if the simple estimate turns out to be misleading in practice.
- `percentPaid = (originalAmount − currentBalance) / originalAmount`.

### Where this is set

- A small dedicated "Debts" list/form, same pattern as spec 007's
  budgets screen — not folded into the transaction form. Reuses spec
  003's primitives, no new design-system work.
- Not part of this spec: the dashboard's debt-payoff visualization
  (progress bars, the "clears in ~14 months" suggestion) — spec 009.

## Data model

```
users/{uid}/debts/{debtId}
  name: string              // e.g. "Credit Card", "Car Loan" — also used as the linked transaction's category
  originalAmount: integer   // whole CLP, starting balance when first tracked
  currentBalance: integer   // whole CLP, remaining balance
  minimumPayment: integer   // whole CLP, monthly minimum payment
  interestRate: number | null  // optional annual %, stored but not used in v1's payoff estimate
  createdAt: timestamp
  updatedAt: timestamp
```

## Acceptance criteria

1. **Given** no debts, **when** a user adds one (name, original amount,
   current balance, minimum payment), **then** a `Debt` document is
   created and appears in their debt list, persisting across restarts.
2. **Given** a debt, **when** the user logs a payment of a valid amount,
   **then** a new `expense` transaction is created in that debt's
   category **and** the debt's `currentBalance` decreases by that amount
   — both succeed together, or neither does.
3. **Given** a debt, **when** the user directly edits its balance,
   **then** `currentBalance` updates and **no** transaction is created.
4. **Given** a debt's `currentBalance` and `minimumPayment`, **then**
   `monthsToPayoff` and `percentPaid` are computed correctly, including
   the edge case `currentBalance === 0` (0 months, 100% paid).
5. **Given** a payment amount that's zero, negative, non-integer, or
   greater than the current balance, **when** the user tries to log it,
   **then** the save is rejected with an inline validation error.
6. **Given** a debt reaches a zero balance, **then** it stays visible in
   the list (marked paid off), and is only removed if the user explicitly
   deletes it.
7. Firestore security rules reject any read/write to
   `users/{uidA}/debts/*` from a client authenticated as `uidB`.
8. **Given** a debt and a month X (2026-10-10 addendum below), **then**
   `debtBalanceAsOf(debt, transactions, X)` returns `currentBalance` plus
   the sum of this debt's logged payments dated after the end of X, or
   `null` when the debt's `createdAt` is after the end of X; for the
   current month it equals `currentBalance`.

## Out of scope

- True amortization / interest-compounding payoff math — see the payoff
  estimate rationale above.
- Automatic interest accrual (balance growing on its own over time).
- Payoff strategy recommendations (avalanche vs. snowball ordering across
  multiple debts) — that's a spec 009 suggestions-engine concern once
  there's real multi-debt data to reason about, not this spec's.
- Linking a debt to a specific external account/lender integration (no
  bank sync in v1, per spec 000).

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1 — create a debt | Unit | Store/repository test: add a debt, assert it persists with the given fields. |
| 2 — logging a payment creates a transaction and updates the balance together | Unit | Store test: log payment → assert both a new transaction (correct category/amount/type) and the debt's decreased balance; a failure in either half leaves neither applied (mocked repo rejection test). |
| 3 — direct balance edit creates no transaction | Unit | Store test: edit balance directly, assert no transaction was created. |
| 4 — payoff math, including the zero-balance edge case | Unit | Pure function tests for `monthsToPayoff`/`percentPaid` across normal and edge-case inputs. |
| 5 — payment validation | Unit | Validation function tests: zero/negative/non-integer/over-balance amounts all rejected. |
| 6 — paid-off debt stays visible | Unit | Store test: balance reaches 0, debt remains in state until explicit delete. |
| 7 — cross-user isolation | Integration (Firebase emulator) | `rules-unit-testing`: authed as `uidB`, attempt read/write on `uidA`'s debts, expect denial. |
| 8 — balance as of a month end | Unit | Pure `debtBalanceAsOf` tests: current month = `currentBalance`; payments after X added back, payments on/before X ignored; month-end boundary (last day, 23:59 local); `createdAt` after X → `null`; zero payments after X. |

Unit/component tests against mocked Firebase (matching specs 002/007's
pattern); rules tests against the local emulator, never a real project.

## Verification results

Implemented 2026-09-22.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1 — create a debt | ✅ | `debtsStore.test.ts` + `DebtsScreen.test.tsx`. |
| 2 — logging a payment: transaction + balance together | ✅ | `firestoreDebtRepository.native.test.ts` — `logPayment` runs inside a single `runTransaction`: reads the debt's current balance *from inside* the transaction (not cached state, avoiding a race between concurrent payments), writes the linked expense doc and the decreased balance together; a "debt not found" rejection leaves neither write applied. |
| 3 — direct balance edit creates no transaction | ✅ | `debtsStore.test.ts` + `DebtsScreen.test.tsx`: `editBalance` calls only `repo.updateBalance`, never `repo.logPayment`. |
| 4 — payoff math, zero-balance edge case | ✅ | `payoffMath.test.ts` — `monthsToPayoff`/`percentPaid`, including `currentBalance === 0` and `minimumPayment === 0`. |
| 5 — payment validation | ✅ | `validatePaymentAmount.test.ts` — wraps `validateAmount`, adds the over-balance check. |
| 6 — paid-off debt stays visible | ✅ | `debtsStore.test.ts` + `DebtsScreen.test.tsx`: balance reaching 0 keeps the debt in state/list (shown "Paid off"), removed only on explicit delete. |
| 7 — cross-user isolation | ✅ | `firebase/tests/debts.rules.test.ts`, 16/16 rules tests passing against the local emulator (transactions + categories + budgets + debts). |

**What shipped:**
- `src/debts/types.ts`, `payoffMath.ts`, `validatePaymentAmount.ts`,
  `debtsStore.ts` (deferred `startSync()`, same pattern as every other
  store in this app), `store.ts`.
- `src/debts/providers/firestoreDebtRepository.{native,web}.ts` — plain
  `addDoc`/`updateDoc`/`deleteDoc` for `create`/`updateBalance`/`delete`
  (no atomicity needed there, so no reason to pay for it); `logPayment`
  is the one method using `runTransaction`, since it's the one place two
  collections must change together.
- `firestore.rules` gained `users/{uid}/debts/{debtId}`.
- `src/screens/DebtsScreen.tsx` — add-debt form, and per-debt
  Log Payment / Edit Balance / Delete actions, reusing existing
  primitives.
- `App.tsx` now also calls `startDebtsSync()` in the same deferred
  `useEffect` as transactions/budgets.

**Not yet reachable from the app** — same reason as spec 007's
`BudgetsScreen`: navigation is spec 009's job.

148 unit/component tests pass, 16 Firestore rules tests pass
(`npm run test:rules`); `tsc --noEmit` clean.

Staying at `implemented`, not `verified` — nothing to click through in
the running app until spec 009 wires up navigation.

### Addendum (2026-10-10, draft): balance as of a month end (spec 009, issue #17)

The dashboard's month selection needs "what did I owe at the end of month
X". A `Debt` stores only `currentBalance`, so the past is reconstructed by
**adding back the payments logged after X**: those are the expense
transactions this spec's `logPayment` creates in the debt's category
(spec 008, "Logging a payment"), so no new stored data is needed.

- `debtBalanceAsOf(debt, transactions, X)` =
  `currentBalance + Σ amount of expense transactions in category debt.name
  dated after the last day of X`; `null` if `debt.createdAt` is after the
  end of X (the debt did not exist yet). Pure function in
  `src/debts/payoffMath.ts`'s neighborhood, no new queries.
- **Known approximation:** direct balance edits (criterion 3) are
  deliberately not logged, and renaming a debt changes the category its
  payments match. Reconstruction therefore reflects *logged payments only*;
  a month that preceded a manual correction shows the corrected history.
  Accepted for v1 — logging balance edits as events is the exact fix and is
  out of scope here (it would turn `Debt` into spec 012's ledger model).
