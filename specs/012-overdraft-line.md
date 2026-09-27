# 012 — Overdraft Line

**Status:** implemented
**Depends on:** 000, 001, 002 (interest/fees create regular expense
transactions), 003 (primitives/tokens), 008 (this is a debt with its own
shape — see "Why not a plain Debt"), 009 (shell banner, dashboard debt KPI)

## Purpose

The author has an overdraft line (*línea de crédito / sobregiro*) attached
to their checking account and uses it constantly. When checking runs short
the bank tops it up automatically, and what was drawn becomes a debt that
charges interest until it's repaid. This spec makes that line a first-class,
very visual thing in the app: how much of it is in use, what it's costing,
how much is owed until zero — and an unmissable signal the moment it goes
from unused to used.

## User stories

- As a user, I see at a glance how much of my line I'm using (and how much
  is left), as a big visual gauge, not a number buried in a list.
- As a user, I see what the line is costing me: interest and fees charged
  this month, what carrying the current balance will cost, and the total
  I've paid to use it.
- As a user, I see how much I owe on it and roughly when it reaches zero at
  the payment pace I plan to keep.
- As a user, the app tells me clearly, everywhere, as soon as I start using
  the line, and warns me as I approach the limit.
- As a user, logging a draw, a repayment, or a charge takes one tap and a
  number — I'll do it a lot.

## Why not a plain `Debt` (spec 008)

A spec 008 debt is a balance that only goes down (`logPayment`). This one
goes up and down constantly and has its own cost. Modelling it as a running
balance edited by hand loses exactly what the author wants to see (draw
history, cost over time, "since when"). So the line is a **ledger of
events**, and the balance is derived from it.

## Requirements

### Money rules (what is and isn't spending)

- A **draw** (bank tops up checking from the line) is **not income** and
  creates **no transaction** — the purchases it covered are already logged
  as ordinary expenses.
- A **repayment** of principal is **not an expense** and creates **no
  transaction** — same reason, it would double-count.
- **Interest** and **fees** *are* real spending: logging one atomically
  (a) adds a balance-increasing event and (b) creates a normal `expense`
  transaction in the category `Overdraft interest & fees` (created on demand,
  appears in the category list like any other). Both succeed or neither does
  (same `runTransaction` pattern as spec 008's `logPayment`).
- Interest/fees increase what's owed (the bank charges them to the line).

### Data: a singleton line + an event ledger

```
users/{uid}/overdraft/line            (single doc)
  limit: integer                 // whole CLP, approved line size
  monthlyRate: number            // % per month on the used balance (e.g. 1.9)
  plannedMonthlyPayment: integer | null   // whole CLP, drives the payoff estimate
  createdAt, updatedAt: timestamp

users/{uid}/overdraftEvents/{eventId}
  type: 'draw' | 'payment' | 'interest' | 'fee'
  amount: integer                // whole CLP, always > 0
  date: date                     // same date convention as transactions (002)
  note: string | null
  transactionId: string | null   // set for interest/fee: the linked expense
  createdAt: timestamp
```

- **Balance is derived, never stored:**
  `balance = Σ(draw + interest + fee) − Σ(payment)`. No drift, and
  deleting a wrong event fixes it. Existing debt on the line at first use is
  entered as a `draw` dated the opening day with note "Opening balance".
- Events are **immutable** (no edit): a mistake is deleted and re-logged.
  Deleting an `interest`/`fee` event atomically deletes its linked expense.
- Same per-account scoping and rules pattern as budgets/debts/transactions.

### Derived values (pure functions, unit-testable)

- `balance`, `available = limit − balance` (may be negative), `usedPercent`.
- **Status:** `unused` (balance 0) · `in-use` (0 < used < 75% of limit) ·
  `high` (≥ 75%) · `over-limit` (balance > limit). A draw that takes the
  balance past the limit is **allowed** (the bank may let it happen; the app
  reflects reality) and shown as `over-limit`, never blocked.
- **`inUseSince`:** replay events in date order; the date the balance last
  went from 0 to > 0 (cleared when it returns to 0). Drives "in overdraft
  since 12 Sep · 13 days".
- **Cost:** `interestThisMonth`, `feesThisMonth` (calendar month, per spec
  000), `totalCost` (all-time interest + fees), and
  `projectedMonthlyInterest = balance × monthlyRate / 100` — an estimate
  labelled "at current balance"; the *charged* figures come only from logged
  events, never invented.
- **Payoff** (needs `plannedMonthlyPayment` P, monthly rate r = rate/100,
  balance B): B = 0 → done · P ≤ B·r → "your payment doesn't cover the
  interest — the balance won't shrink" · r = 0 → ⌈B/P⌉ months · else
  n = ⌈−ln(1 − r·B/P) / ln(1 + r)⌉ months, with estimated remaining interest
  ≈ P·n′ − B, where n′ is the *unrounded* n (rounding first would overstate
  it, since the last payment is smaller than P). Unlike spec 008's deliberately simple estimate, interest *is*
  the point here, so this one accounts for it. No P set → prompt to set one,
  no estimate shown.
- `percentCleared = 1 − balance / peakBalanceSinceInUse` (progress back to
  zero within the current use; 100% when back to 0).

### Visual design (the point of this spec)

Built from spec 003 primitives/tokens and spec 009's approach (plain
`View`s; SVG only where a shape needs it). No new chart library.

1. **Usage gauge (hero):** a large segmented bar, used vs. limit, fill color
   by status (unused = neutral, in-use = amber, high = orange,
   over-limit = red — red stays reserved for this critical state, per spec
   003; amber/orange are new status tokens to add there), with "Used $X of $Y · Z%" and "Available $A"
   under it. The 75% threshold is marked on the bar.
2. **Cost row (three cards):** *Charged this month* (interest + fees, with
   the split), *Carrying cost* (`projectedMonthlyInterest`, "at current
   balance"), *Total paid to use the line* (`totalCost`).
3. **Road to zero:** balance owed, `percentCleared` progress bar, planned
   payment, and the payoff sentence ("clears in ~7 months, ≈ $X more in
   interest" or the doesn't-cover-interest warning).
4. **Balance history:** a step line of the balance over the last 6 months
   (SVG polyline over the replayed events), so a rising vs. falling trend
   reads instantly.
5. **Actions + recent events:** four one-tap buttons — *Log draw*, *Log
   payment*, *Log interest*, *Log fee* — each opens a one-field form
   (amount, date defaulting to today, optional note); below, the event list,
   newest first, with delete.

### Telling the user "you're starting to use it"

- A **persistent banner in the app shell** (visible on every tab) whenever
  status ≠ `unused`: "You're in overdraft — $X used of $Y (Z%) · since 12
  Sep". It escalates in style at `high` and `over-limit`. Copy per status:
  just started (in-use, since today) "You're now using your overdraft";
  in-use "In overdraft · 62% of your line"; high "Getting close to your
  limit · 78%" (with the amount left); over-limit "Over your limit by $X".
  All carry `$used of $limit` and "since <date>".
- The moment a logged draw takes the balance from 0 to > 0, the form's
  confirmation says so explicitly ("You're now using your overdraft").
- Crossing 75% and crossing the limit show a distinct warning on the
  confirmation and in the banner.
- **What the app can and can't know:** with no bank sync (spec 000), the app
  learns about a draw only when the user logs it (Decisions #1).

### Where it lives

- Its own top-level **`Overdraft`** tab (decided 2026-09-25, option A on the
  design canvas), between `Log` and `Manage`: `Log` / `Overdraft` / `Manage`
  / `Dashboard`. Heavy daily use justifies one tap away. This amends spec
  009's three-tab shell to four (see the 009 amendment) and adds the status
  tokens to spec 003 (see the 003 amendment).
- **Dashboard (009):** the "total debt remaining" KPI includes the line's
  balance, and the debt section shows the line as a compact row linking to
  the tab. The dashboard does not duplicate the visuals.
- First run (no line yet): the tab shows a short setup form — limit,
  monthly rate, optional planned payment, optional opening balance.

## Acceptance criteria

1. **Given** no line, **when** the user sets it up (limit, monthly rate,
   optional planned payment, optional opening balance), **then** the
   `overdraft/line` doc exists (and an "Opening balance" draw event if one
   was given), persisting across restarts.
2. **Given** events, **then** `balance`, `available`, and `usedPercent` are
   derived correctly from `Σ(draw+interest+fee) − Σ(payment)`, including
   zero events and balance > limit.
3. **Given** a balance and limit, **then** status is `unused` at 0,
   `in-use` below 75%, `high` from 75% up to the limit, `over-limit` above
   it (boundaries exact).
4. **Given** a sequence of events over time, **then** `inUseSince` is the
   date the balance last rose from 0, is cleared when the balance returns to
   0, and restarts on the next draw.
5. **Given** a user logs a draw, **then** a `draw` event is created and **no**
   transaction is created; likewise a `payment` creates an event and **no**
   transaction.
6. **Given** a user logs interest or a fee, **then** the event **and** an
   `expense` transaction (category `Overdraft interest & fees`) are created
   together, or neither is; and deleting that event deletes the linked
   transaction together with it.
7. **Given** an amount that is zero, negative, or non-integer, or a payment
   greater than the current balance, **when** the user tries to log it,
   **then** it's rejected with an inline validation error. A draw beyond the
   limit is **accepted** and results in `over-limit`.
8. **Given** the cost inputs, **then** `interestThisMonth`, `feesThisMonth`,
   `totalCost` come only from logged events (calendar-month boundary), and
   `projectedMonthlyInterest = balance × monthlyRate / 100` rounded to whole
   CLP.
9. **Given** balance B, rate r, and planned payment P, **then** the payoff
   result is: done at B = 0; the doesn't-cover-interest state when
   P ≤ B·r; ⌈B/P⌉ when r = 0; otherwise the amortized month count and
   remaining-interest estimate; and "set a planned payment" when P is null.
10. **Given** status ≠ `unused`, **then** the shell banner is shown on every
    tab with used amount, percent, and `inUseSince`, styled by status; at
    `unused` it is absent. A draw that takes the balance 0 → > 0 shows the
    "now using your overdraft" confirmation; crossing 75% or the limit shows
    the matching warning.
11. **Given** the Overdraft tab with data, **then** it renders the gauge (with
    the 75% mark and status color), the three cost cards, the road-to-zero
    section, the 6-month balance history, and the event list; with a line but
    no events it shows an explanatory empty state, not a blank/crashed
    section.
12. **Given** the dashboard, **then** its total-debt KPI includes the line's
    balance and the debt section shows a compact line row.
13. Firestore rules reject any read/write to `users/{uidA}/overdraft/*` and
    `users/{uidA}/overdraftEvents/*` from a client authenticated as `uidB`.
14. **Given** the app shell, **then** four tabs exist — `tab-transactions`,
    `tab-overdraft`, `tab-manage`, `tab-dashboard` — and pressing
    `tab-overdraft` shows the Overdraft screen.
15. **Given** an existing line, **when** the user edits its limit, monthly
    rate, or planned payment, **then** the line doc updates, every derived
    value recomputes from the new settings, and **no** event is created. The
    "set a planned payment" prompt on the road-to-zero card opens this form.

## Out of scope

- Bank sync / auto-detecting draws (spec 000) — the user logs draws.
- Push/OS notifications (the banner and confirmations are in-app only).
- Editing events (delete and re-log), and automatic interest accrual — the
  *charged* interest is whatever the statement says, entered by the user.
- Daily-interest / day-count precision; multiple overdraft lines; tracking a
  checking-account balance (spec-level "accounts" is still out for v1).
- Suggestions-engine rules for the line (e.g. "you paid $X in interest
  this year") — a natural follow-up in spec 009's suggestions once real data
  exists.

## Decisions (2026-09-25)

1. **Draws are logged by the user.** No checking-balance tracking, no
   inference: one tap on *Log draw* is how the app learns you started using
   the line (any alternative would also need typing, with no bank sync).
2. **The rate is monthly**, as on the statement. Fixed monthly commissions
   are handled as `fee` events the user logs.
3. **Warning threshold stays fixed at 75%.**
4. **The line's balance counts in the dashboard's total-debt KPI** (criterion 12).
5. **Own top-level tab**, compared against "under Manage" and "Dashboard
   hero" on a design canvas; the visuals in "Visual design" follow option A.

## Open questions

None.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1 — setup | Unit | Store/repository test: create line (+ opening draw), assert persisted fields. |
| 2 — derived balance | Unit | Pure function tests: mixed events, empty, balance > limit. |
| 3 — status boundaries | Unit | Pure function tests at 0, 74/75%, 100%, > 100%. |
| 4 — `inUseSince` | Unit | Pure function tests: single use, cleared at 0, restarted, out-of-order dates. |
| 5 — draw/payment create no transaction | Unit | Store test: assert no transaction repo call. |
| 6 — interest/fee atomic with expense; delete cascades | Unit + Integration | Store test with mocked repo rejection (neither applied); emulator test of the `runTransaction` pair and cascading delete, like spec 008's `logPayment`. |
| 7 — validation | Unit | Validator tests: zero/negative/non-integer/over-balance payment rejected; over-limit draw accepted. |
| 8 — cost figures | Unit | Pure function tests incl. month boundary and rounding. |
| 9 — payoff math | Unit | Pure function tests: B=0, P≤B·r, r=0, normal amortization, P null. |
| 10 — banner + confirmations | Component | Mounted shell with mocked store across statuses; form confirmation copy for 0→>0, 75%, limit. |
| 11 — Overdraft tab renders | Component | Mounted with mocked data: each section present; empty-state case. |
| 12 — dashboard includes the line | Component | `DashboardScreen` test: KPI sum includes line balance; compact row present. |
| 13 — cross-user isolation | Integration (Firebase emulator) | `rules-unit-testing`: uidB denied on uidA's line and events. |
| 14 — four tabs | Component | `App.test.tsx`: assert the four tab testIDs exist and pressing `tab-overdraft` renders the Overdraft screen (replaces 009's three-tab assertion). |
| 15 — edit line settings | Unit + Component | Store test: `updateLine` delegates to the repo and creates no event; native repo test: `updateDoc` on the line doc only; `OverdraftScreen` test: settings form (and the set-planned-payment prompt) saves via `updateLine`. |

## Verification results

Implemented 2026-09-25, tests first (the whole suite was red for the right
reason — missing modules, a missing status token, default-deny rules — before
any implementation).

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1 — setup | ✅ | `overdraftStore.test.ts` (`setupLine` → `saveLine`); `firestoreOverdraftRepository.native.test.ts` (line doc + optional "Opening balance" draw in one transaction); `OverdraftScreen.test.tsx` (setup form, optional fields, validation). |
| 2 — derived balance | ✅ | `overdraftMath.test.ts` — `balanceOf`/`availableOf`/`usedPercent`. |
| 3 — status boundaries | ✅ | `overdraftMath.test.ts` — exact at 1.499.999 / 1.500.000 / 2.000.000 / 2.000.001. |
| 4 — `inUseSince` | ✅ | `overdraftMath.test.ts` — single use, cleared at 0, restarted, out-of-order, same-day tie by `createdAt`. |
| 5 — draw/payment create no transaction | ✅ | `overdraftStore.test.ts` (never `logCharge`) + repo test (no `transactions` path, no `runTransaction`). |
| 6 — interest/fee atomic with expense; delete cascades | ✅ | Repo test: one `runTransaction` stages the event and the expense (`transactionId` = that expense's id); `deleteEvent` deletes both, a draw alone; not-found deletes nothing. Store test: rejection propagates. |
| 7 — validation | ✅ | `OverdraftScreen.test.tsx` — 0/negative/non-integer/blank rejected, payment > balance rejected, draw past the limit accepted. |
| 8 — cost figures | ✅ | `overdraftMath.test.ts` — `costSummary` (month boundary), `projectedMonthlyInterest`. |
| 9 — payoff math | ✅ | `overdraftMath.test.ts` — done / no-plan / not-covering (incl. equal) / r = 0 / amortized (5 months, ≈ $63.630) / one month. |
| 10 — banner + confirmations | ✅ | `OverdraftBanner.test.tsx` (absent, just started, in-use, high, over-limit, styles by status, tap); `App.test.tsx` (banner on every tab, tap opens the tab); `OverdraftScreen.test.tsx` (started / crossed-75% / over-limit confirmations); `usageTransition` in `overdraftMath.test.ts`. |
| 11 — Overdraft tab renders | ✅ | `OverdraftScreen.test.tsx` — gauge (fill, status color, 75% mark, over-limit cap), cost cards, road to zero, history, event list newest first, empty state. |
| 12 — dashboard includes the line | ✅ | `DashboardScreen.test.tsx` — KPI sum, compact row, no empty state when only the line is in use, no row when absent/unused. |
| 13 — cross-user isolation | ✅ | `firebase/tests/overdraft.rules.test.ts`, 19/19 rules tests passing against the local emulator. |
| 14 — four tabs | ✅ | `App.test.tsx`. |
| 15 — edit line settings | ✅ | Store test (no event created), repo test (`updateDoc` on the line only), `OverdraftScreen.test.tsx` (prefilled form, set-planned-payment prompt). |

**What shipped:** `src/overdraft/` (`types`, `overdraftMath`,
`overdraftStore`, `store`, `format`, `providers/firestoreOverdraftRepository.{native,web}`),
`src/components/OverdraftBanner.tsx` + `StatusIcon.tsx`,
`src/screens/OverdraftScreen.tsx`, `colors.status.*` in `src/theme/tokens.ts`,
`firestore.rules` for the two new collections, a fourth tab and the banner in
`App.tsx`, and the overdraft balance in `DashboardScreen`'s total-debt KPI and
debt section.

354 unit/component tests pass, 19 Firestore rules tests pass, `tsc --noEmit`
clean. Staying at `implemented`, not `verified`: not yet checked against the
running app on a device or in the browser (and the `.web` repository has no
test of its own, like every other `.web` repository here).

## Amendment (2026-09-25, approved): the monthly rate is optional

**Why:** the author may not know the line's monthly rate (it's on a
statement or the contract, not always to hand). Requiring it forces a
made-up number, and `0` as a placeholder is a silent lie: carrying cost
shows `$0 / mo` and the payoff estimate claims "≈ $0 more in interest".
Unknown should look unknown. Everything that comes from logged events
(gauge, banner, charged-this-month, total paid, history) never needed the
rate and is unchanged.

### Requirements

- `monthlyRate` becomes `number | null`. `null` means *unknown*; `0` still
  means a real 0% rate. A line doc with a missing field reads as `null`;
  existing docs with a numeric rate are unaffected.
- **Setup and settings:** the rate field is optional. Blank saves `null`;
  a non-blank value that isn't a number is still rejected. In settings the
  user can clear a previously entered rate (blank → `null`) or set one, at
  any time; neither creates an event.
- **Carrying cost:** with an unknown rate, `projectedMonthlyInterest` is
  *unknown* (not `0`). The *Carrying cost* card shows an "Add your rate to
  see this" prompt that opens the settings form, instead of `$0 / mo`. A
  real rate of `0` still shows `$0 / mo`.
- **Payoff with an unknown rate** (planned payment P, balance B > 0): the
  interest can't be estimated, so the result is a lower bound: *at least*
  ⌈B/P⌉ months, not counting interest, with a prompt to add the rate for a
  real estimate. No P set → still "set a planned payment"; B = 0 → still
  done. The "payment doesn't cover the interest" warning needs a rate, so it
  never appears while the rate is unknown.
- **Confirmations:** with an unknown rate, the *now using* and *crossed
  75%* confirmations drop the carrying-cost sentence and keep the rest of
  the copy ("Balance $180.000, 9% of your $2.000.000 line.").
- **Dashboard row:** for an unknown rate the row shows the balance only (no
  "~N mo", since that estimate is interest-free and would mislead).
- Impact on existing pieces (for implementation, not new behavior):
  `OverdraftLine.monthlyRate`, `NewOverdraftLineInput`, `OverdraftLinePatch`,
  `projectedMonthlyInterest`, `overdraftPayoff` (new result kind for the
  lower bound), the native/web repositories (`?? null` on read), and the
  setup/settings forms.

### Acceptance criteria

16. **Given** the setup form with the rate left blank, **when** the user
    saves (with a valid limit), **then** the line is created with
    `monthlyRate: null`; a non-blank, non-numeric rate is still rejected
    with the inline error; a numeric rate (including `0`) saves as entered.
17. **Given** an unknown rate, **then** `projectedMonthlyInterest` is
    unknown (distinct from `0` for a real 0% rate), and the Carrying cost
    card shows the "add your rate" prompt (which opens the settings form)
    instead of `$0 / mo`; the charged-this-month and total-paid cards are
    unchanged.
18. **Given** an unknown rate, a planned payment P, and a balance B > 0,
    **then** the payoff result is the lower bound ⌈B/P⌉ months excluding
    interest, shown as "at least" with the add-your-rate prompt; with no P
    it is still `no-plan`; at B = 0 it is still `done`; the
    doesn't-cover-interest warning is never shown.
19. **Given** an unknown rate, **then** the *now using* and *crossed 75%*
    confirmations omit the carrying-cost sentence and are otherwise
    unchanged; and the dashboard's overdraft row shows the balance only.
20. **Given** the settings form, **when** the user clears the rate or sets
    one, **then** the line doc updates to `null` or the number, derived
    values recompute, and no event is created.

### Addendum (2026-09-25): the field must say it's optional

Found on the deployed web app: the rate was optional in behavior but the
label read "Monthly rate (%)", so it looked required. Requirement: in both the
setup and settings forms the rate field is labelled **"Monthly rate, %
(optional)"** (matching "Planned monthly payment (optional)"), and the setup
form's intro tells the user they can leave it blank and add it later.

21. **Given** the setup form or the settings form, **then** the rate field is
    labelled "Monthly rate, % (optional)", and the setup form says the rate
    can be left blank and added later.

Verification: `OverdraftScreen` component tests for both forms' labels and the
setup hint.

### Addendum (2026-09-26): a "Line terms" card shows the settings

Found in use: once the rate is entered it is not visible anywhere on the
Overdraft tab (only inside the settings form, and once in a confirmation).
Chosen from three options on a design canvas (rate in the header / on the
carrying-cost card / a terms card): **a "Line terms" card**.

- A card titled **Line terms**, directly under the usage gauge (after any open
  log or settings form), with three rows: **Limit**, **Monthly rate**,
  **Planned payment**, and one **Edit** button that opens the settings form.
  It replaces the "Edit settings" link in the screen header.
- The rate row shows the rate as entered ("3.45%"; a real `0` shows "0%").
  An unknown rate shows **"Not set · Add"** as a button that opens the
  settings form. An unset planned payment does the same.
- The card shows whenever a line exists, including with no events.

22. **Given** a line, **then** the Overdraft tab shows a Line terms card with
    the limit, the monthly rate ("Not set · Add" when unknown, "0%" for a
    real zero) and the planned payment ("Not set · Add" when unset); its Edit
    button, and each "Not set · Add" button, open the settings form; the
    header no longer carries a separate "Edit settings" link.

Verification: `OverdraftScreen` component tests for each state above.

### Addendum (2026-09-27): a wide-web layout (option C)

Found in use: on a wide browser window the Overdraft tab used the same
560px-capped single column as narrow/native (spec 003's default `Screen`
cap), leaving most of the window empty. Chosen from three options on a
design canvas (two columns / dashboard-style rows / a fixed rail with a
scrolling main area): **option C**, following spec 009's existing
`useWideWeb()` (`≥900px` web) pattern.

- `≥900px` web only (native and narrow/mobile web are unchanged): the
  screen renders through `Screen`'s `wide` cap (spec 006, same as the
  Dashboard/Manage wide layouts) in a fixed **left rail** (gauge, Log
  draw/payment/interest/fee, Line terms) beside a **scrolling right column**
  (cost cards, Road to zero, balance history, activity). Below `900px`
  (including narrow web) the existing single-column layout is unchanged.
- The activity list becomes a **table** only at this width, gaining a
  **Balance after** column: the derived balance immediately after each
  event, newest first (same order as the existing list). Computed from the
  already-loaded event history, nothing new stored.
- No new data, no new store/repository methods — this is a rendering-only
  change, same category as spec 006 and spec 009's own wide-web amendments.

23. **Given** the Overdraft tab at `≥900px` on web, **then** the gauge,
    logging actions, and Line terms render in a fixed left rail, and the
    cost cards, road to zero, balance history and activity render in a
    right column, both within one screen (no page-level scroll of the rail
    itself); below `900px`, and on native at any width, the existing
    single-column layout is unchanged.
24. **Given** the wide layout, **then** the activity table includes a
    Balance after column whose values are the running balance immediately
    after each event, consistent with the event order (newest first).

Verification: `OverdraftScreen` component tests (narrow/native, matching
spec 009's own split) plus an `OverdraftScreen.wideWeb.test.tsx` (mocked
`useWideWeb() === true`), same pattern as `DashboardScreen.wideWeb.test.tsx`.

### Out of scope

- A helper that estimates the rate from a logged interest charge and the
  balance carried that month (e.g. $23.560 on ~$1.240.000 ≈ 1.9%). Tempting,
  but the balance moves through the month, so the figure is approximate and
  could be mistaken for the bank's rate. Revisit only if not knowing the
  rate turns out to be a recurring problem.

### Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 16 — setup without a rate | Component + Unit | `OverdraftScreen` test: blank rate saves `monthlyRate: null` via `setupLine`; `abc` still rejected; `0` saved as `0`. Native repo test: `saveLine` writes `monthlyRate: null`. |
| 17 — carrying cost unknown | Unit + Component | `overdraftMath` test: `projectedMonthlyInterest(balance, null)` is `null`, `(balance, 0)` is `0`. `OverdraftScreen` test: prompt shown and opens settings for `null`; `$0 / mo` for `0`; other cost cards unchanged. |
| 18 — payoff lower bound | Unit + Component | `overdraftMath` test: unknown rate with P → lower-bound kind with ⌈B/P⌉; no-P → `no-plan`; B = 0 → `done`. `OverdraftScreen` test: "at least" copy and prompt; no not-covering warning. |
| 19 — confirmations and dashboard row | Component | `OverdraftScreen` test: started / crossed-75% copy without the carrying-cost sentence. `DashboardScreen` test: row shows balance only. |
| 20 — clear or set the rate | Unit + Component | Store/repo tests: `updateLine` accepts `monthlyRate: null` and creates no event; `OverdraftScreen` test: blank rate in settings saves `null`. Repo read maps a missing field to `null`. |

### Verification results (amendment)

Implemented 2026-09-25, tests first: 12 new tests failed on assertions
(not just missing modules) before any code changed.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 16 — setup without a rate | ✅ | `OverdraftScreen.test.tsx` (blank → `null`, `0` → `0`, `abc` still rejected, limit still required); repo test (`saveLine` writes `null`/`0`). |
| 17 — carrying cost unknown | ✅ | `overdraftMath.test.ts` (`null` vs `0`); `OverdraftScreen.test.tsx` (prompt opens settings, no `$0 / mo`; a real 0% still shows `$0 / mo`; other cost cards unchanged). |
| 18 — payoff lower bound | ✅ | `overdraftMath.test.ts` (`at-least` ⌈B/P⌉, no `not-covering`, `no-plan`/`done` unchanged); `OverdraftScreen.test.tsx` ("at least" copy + prompt). |
| 19 — confirmations and dashboard row | ✅ | `OverdraftScreen.test.tsx` (both confirmations drop the carrying-cost sentence); `DashboardScreen.test.tsx` (row shows balance only). |
| 20 — clear or set the rate | ✅ | Store test (`updateLine` with `null`, no event); repo tests (`updateDoc` passes `null`; a missing field reads as `null`); `OverdraftScreen.test.tsx` (blank clears, prefill blank, sets a number). |

378 unit/component tests pass, 19 Firestore rules tests pass, `tsc --noEmit`
clean. Still `implemented`, not `verified` (not yet exercised in the running app).
