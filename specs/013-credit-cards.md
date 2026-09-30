# 013 — Credit Cards (CLP)

**Status:** implemented
**Depends on:** 000 (v1 scope — CLP only, this spec stays inside that; a
second card in USD is an explicit future spec, not this one), 001, 002
(this spec's 2026-09-29 amendment: an optional `cardId` on an expense),
003, 008 (a card is not a `Debt` — see "Why not spec 008's Debt"), 009
(Manage panel, dashboard KPI/debt row), 012 (shares its revolving-balance
payoff math, extracted to a common module — see Requirements)

## Purpose

The author pays with a credit card (today a CLP one; a USD international
card is planned as a follow-up spec) and wants to see, per card, how much
of the limit is used and roughly how long it takes to clear at the
minimum payment — without double-entering every purchase, and without
losing the category detail a purchase already carries.

## User stories

- As a user, I add a credit card (name, limit, minimum payment, optionally
  a monthly interest rate) and see it listed.
- As a user, logging a purchase on my card is the same thing as logging
  any other expense — I just also say which card paid for it.
- As a user, I log a payment against a card and see its balance go down.
- As a user, I see each card's balance, how much room is left, and roughly
  when it clears at the minimum payment.

## Why not a separate ledger (unlike spec 012's overdraft)

Spec 012's overdraft line needed its own event ledger because a *draw*
isn't spending — the purchase it covers was already logged separately, as
an ordinary expense from checking. Logging the draw too would double-count
it.

A credit card purchase has no such double: the swipe **is** the spending,
and nothing else records it. So a purchase doesn't need a parallel
ledger — it needs to be exactly what it already is, an ordinary `expense`
transaction (spec 002), just tagged with which card paid for it. A card's
balance is then simply the sum of the expenses tagged with it, minus what's
been paid off — no dual-write, no cascade-delete to keep in sync, and
editing or deleting a tagged expense (already supported by spec 002)
"just works" because the balance is a live sum, not a duplicated figure.

The one thing a purchase genuinely isn't is a **payment** — paying the
statement is not new spending, so (like an overdraft repayment) it creates
no transaction and needs its own small record.

## Why not spec 008's `Debt`

A `Debt`'s balance only goes down (`logPayment` decreases it and logs the
payment as the expense). A card's balance goes up with every purchase and
down with every payment — the reverse shape, and `Debt`'s `percentPaid`
already stops making sense once a revolving balance is paid down and spent
back up again (the same reason spec 012 didn't reuse `Debt` either).

## Requirements

### A `CreditCard` entity

```
users/{uid}/creditCards/{cardId}
  name: string              // e.g. "Visa CLP" — shown wherever the card is picked
  limit: integer            // whole CLP, approved credit limit
  minimumPayment: integer   // whole CLP, statement minimum — also the
                             // assumed monthly payment in the payoff estimate
  monthlyRate: number | null  // % per month on the carried balance; null =
                             // unknown, same convention as spec 012's
                             // 2026-09-25 amendment (not the same as a real 0%)
  createdAt, updatedAt: timestamp
```

Same per-account scoping/rules pattern as `debts`/`budgets`/`overdraft`.
More than one card is supported from the start (a USD card is coming), but
this spec's own screens and math assume CLP throughout.

### Tagging a purchase — spec 002's amendment

- The expense form (only the expense form — see spec 002's amendment) gains
  an optional **Paid with** picker: "None" (today's default, unchanged) or
  one of the user's cards. Saving sets the transaction's `cardId`
  accordingly; nothing else about creating, editing, categorizing, or
  aggregating that transaction changes.
- A card's **balance** is derived, never stored: `balance(card) =
  Σ(expense transactions where cardId = card.id) − Σ(payments where cardId
  = card.id)`. Editing a tagged transaction's amount, or deleting it,
  changes the balance automatically — it's a live query, not a copy.

### Payments — a small ledger, like spec 012's

```
users/{uid}/creditCardPayments/{paymentId}
  cardId: string
  amount: integer   // whole CLP, always > 0
  date: date         // same convention as transactions (002)
  note: string | null
  createdAt: timestamp
```

A payment is **not** an expense and creates **no** transaction (paying off
purchases already logged would double-count them) — same reasoning as an
overdraft repayment. Payments are immutable (delete and re-log a mistake).

### Derived values (pure functions, extracted to a shared module)

- `balance`, `available = limit − balance`, `usedPercent`.
- **Status:** `in-use` (below 75% of limit) · `high` (≥ 75%) ·
  `over-limit` (balance > limit) — no `unused` tier and **no persistent
  banner**: unlike the overdraft, using a credit card is the normal,
  expected way to spend, not a signal something's gone short. A status
  color/badge shows on the card's own row (Manage panel, dashboard) at
  `high`/`over-limit`; nothing shows shell-wide. A purchase that pushes
  the balance past the limit is **allowed**, not blocked (same stance as
  spec 012 — the app reflects what happened, not what a bank permits).
- `projectedMonthlyInterest = balance × monthlyRate / 100`, `null` when
  the rate is unknown (never `0`).
- **Payoff**, at the minimum payment: **reuse spec 012's
  `overdraftPayoff`/`projectedMonthlyInterest`, extracted from
  `src/overdraft/overdraftMath.ts` into a shared, feature-agnostic module**
  (e.g. `src/finance/revolvingPayoff.ts`) that both specs import — the math
  (amortized months and remaining interest at a known rate; an
  interest-free lower bound when the rate is unknown; "doesn't cover the
  interest"; done at zero) is identical, and keeping two copies would let
  them drift. This spec does the extraction; spec 012's own behavior is
  unchanged (covered by its existing tests, which move with the code).
- **Out of scope: a "charged this month" / "total paid" cost history**
  (unlike spec 012's cost cards). Those need to know *which* tagged
  expenses were interest/fees versus ordinary purchases, which this spec
  deliberately doesn't distinguish (a category is enough). Revisit only if
  that history turns out to matter in practice — see Out of scope.

### Where this is set

- A **Credit Cards panel** under the `Manage` tab (spec 009), alongside
  Categories/Budgets/Debts — occasional setup and payments, not a daily
  action (daily purchase-logging already happens on the `Log` tab, per
  the amendment above). Add-card form: name, limit, minimum payment,
  optional monthly rate. Per card: balance, available, status badge,
  payoff estimate, Log payment, Edit, Delete.
- **Dashboard (009):** each card's balance is added to the total-debt KPI,
  and the debt section gets one compact row per card (balance and payoff
  estimate), same treatment as the overdraft line.
- If a card is currently tracked as a spec 008 `Debt`, moving it here is a
  manual step (delete the `Debt`, add a `CreditCard`) — no automatic
  migration (see Out of scope).

## Acceptance criteria

1. **Given** no cards, **when** the user adds one (name, limit, minimum
   payment, optional monthly rate), **then** a `CreditCard` document is
   created and appears in the Manage panel, persisting across restarts.
2. **Given** a card, **when** the user logs an expense and picks it as
   "Paid with", **then** the transaction's `cardId` matches it; leaving it
   as "None" keeps `cardId` null — same criteria as spec 002's own
   amendment.
3. **Given** expenses tagged to a card and payments logged against it,
   **then** `balance = Σ(tagged expenses) − Σ(payments)`, and editing or
   deleting a tagged expense changes the balance accordingly, with no
   separate update needed.
4. **Given** a card's balance and limit, **then** status is `in-use` below
   75%, `high` from 75% up to the limit, `over-limit` above it (exact
   boundaries); a purchase that pushes the balance over the limit is
   accepted, never blocked.
5. **Given** a payment amount that's zero, negative, non-integer, or
   greater than the current balance, **when** the user tries to log it,
   **then** it's rejected with an inline validation error (reusing spec
   008's `validatePaymentAmount`); a payment creates no transaction.
6. **Given** a card's balance, rate and minimum payment, **then** the
   payoff result matches spec 012's `overdraftPayoff` exactly (done /
   no-plan is unreachable here since minimum payment is always set /
   not-covering / interest-free lower bound when the rate is unknown /
   amortized months and remaining interest otherwise) — proven by both
   specs' tests passing against the one extracted module.
7. **Given** the Manage panel, **then** each card shows its balance,
   available room, status badge, and payoff sentence; a newly added card
   with no activity shows a zero balance, not an error.
8. **Given** the dashboard, **then** its total-debt KPI includes every
   card's balance and the debt section shows one compact row per card.
9. Firestore security rules reject any read/write to
   `users/{uidA}/creditCards/*` and `users/{uidA}/creditCardPayments/*`
   from a client authenticated as `uidB`.

## Out of scope

- **USD / any second currency** — the whole point of splitting this from
  the international card; see spec 000's CLP-only constraint (unchanged by
  this spec) and the planned follow-up.
- **Statement/due-date cycle and reminders** — decided against for v1
  (balance + minimum payment + rate is enough for the payoff estimate);
  revisit only if paying on time turns out to need the app's help, not
  just the bank's own reminders.
- **A retrospective "interest & fees paid" cost history** — see Derived
  values above; would need distinguishing charge-type expenses from
  purchases, deliberately not modeled here.
- **Automatic migration from a spec 008 `Debt`** — manual, one-time, by
  the user; not worth the code for a single-user app's one-time move.
- **A shell-wide "you're using it" banner** like the overdraft's — normal
  card use isn't a warning sign; see Derived values above.
- Multiple currencies' worth of category/budget aggregation logic — this
  spec's cards are CLP, so nothing about spec 002's aggregation changes.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1 — create a card | Unit | Store/repository test: add a card, assert it persists with the given fields. |
| 2 — tagging a purchase | Unit + Component | Covered primarily by spec 002's own amendment tests (criteria 16–17); this spec's tests only check the card picker is populated from `creditCards` and the balance math consumes the result correctly. |
| 3 — derived balance, live | Unit | Pure function tests: balance from a mixed set of tagged transactions and payments; re-run after simulating an edit/delete of a tagged transaction, assert the balance changes with no extra write. |
| 4 — status boundaries, over-limit allowed | Unit | Pure function tests at 0, 74/75%, 100%, >100%; a store test asserting a card-tagged transaction is accepted past the limit. |
| 5 — payment validation | Unit | Reuses `validatePaymentAmount` — tests assert it's called the same way as spec 008's debt payments; store test asserts no transaction is created. |
| 6 — payoff math matches spec 012 | Unit | Both `src/overdraft/__tests__/overdraftMath.test.ts` and a new `src/finance/__tests__/revolvingPayoff.test.ts` pass against the one extracted module — a regression in one is a regression in both. |
| 7 — Manage panel renders | Component | `CreditCardsPanel` test: balance/available/status/payoff shown; zero-activity card shows zero, not an error. |
| 8 — dashboard includes cards | Component | `DashboardScreen` test: KPI sum includes every card's balance; one compact row per card. |
| 9 — cross-user isolation | Integration (Firebase emulator) | `rules-unit-testing`: uidB denied on uidA's cards and payments. |

## Verification results

Implemented 2026-09-29, tests first (each new file's tests failed on a
missing module or a real assertion before any implementation code).

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1 — create a card | ✅ | `creditCardsStore.test.ts` (`addCard` → `cards.create`); `firestoreCreditCardRepository.native.test.ts` (writes under the uid, unset rate stored as `null`). |
| 2 — tagging a purchase | ✅ | Covered by spec 002's own criteria 16–17; this spec's `TransactionsScreen`/`CreditCardsPanel` tests confirm the picker's cards come from `creditCards` and the balance math consumes `cardId` correctly. |
| 3 — derived balance, live | ✅ | `creditCardMath.test.ts` — mixed transactions/payments, ignores other cards/income/untagged, and an edited or deleted transaction changes the result with no extra write (no cascade-delete needed, unlike spec 012). |
| 4 — status boundaries, over-limit allowed | ✅ | `creditCardMath.test.ts` — exact at 1.499.999/1.500.000/2.000.000/2.000.001; `CreditCardsPanel.test.tsx` shows no badge below 75%, a badge from 75% up. |
| 5 — payment validation | ✅ | `CreditCardsPanel.test.tsx` + `firestoreCreditCardPaymentRepository.native.test.ts` — reuses spec 008's `validatePaymentAmount`; a payment writes only to `creditCardPayments`, never `transactions`. |
| 6 — payoff math matches spec 012 | ✅ | Extracted to `src/finance/revolvingPayoff.ts`; `overdraftMath.ts` re-exports it under its old names, and its existing test file passes unchanged — same module, both specs. |
| 7 — Manage panel renders | ✅ | `CreditCardsPanel.test.tsx` — balance/available/status/payoff shown; a fresh card with no activity shows `$0`, not an error; wired into `ManageScreen` (both layouts) alongside Categories/Budgets/Debts. |
| 8 — dashboard includes cards | ✅ | `DashboardScreen.test.tsx` — KPI sum includes every card's balance, combines correctly with debts and the overdraft line, one compact row per card. |
| 9 — cross-user isolation | ✅ | `firebase/tests/creditCards.rules.test.ts`, 22/22 rules tests passing against the local emulator. |

**What shipped:** `src/creditCards/` (`types`, `creditCardMath`,
`creditCardsStore`, `store`, `providers/firestoreCreditCard{,Payment}Repository.{native,web}`),
`src/finance/revolvingPayoff.ts` (extracted from `src/overdraft/overdraftMath.ts`,
which now re-exports it), `src/screens/CreditCardsPanel.tsx` (in `ManageScreen`),
`cardId` on `Transaction`/`NewTransactionInput` plus a "Paid with" picker in
`TransactionsScreen` (spec 002's amendment), `firestore.rules` for the two
new collections, and the dashboard's total-debt KPI/debt-section integration.

461 unit/component tests pass, 22 Firestore rules tests pass, `tsc --noEmit`
clean, web export builds. Staying at `implemented`, not `verified`: not yet
exercised in the running app.
