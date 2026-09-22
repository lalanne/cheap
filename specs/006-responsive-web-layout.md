# 006 — Responsive Web Layout

**Status:** implemented (deployed; manual browser resize check pending — see Verification results)
**Depends on:** 002 (transactions), 003 (design system), 005 (web deployment — the deploy this styles)

Direction chosen from the canvas (2026-09-21): **"B — Master-detail
split"** — a persistent list column and a persistent form panel, both
visible at once on a wide window, instead of the form replacing the list.

## Problem

Spec 005 deployed the exact mobile layout, unscaled, to a browser —
correct as a first cut, but on a real desktop window it looks like "the
iOS app stretched to fit the screen" (the user's own words): `Screen`'s
content has no width cap, so every field — the amount input, the date
field, the Save button — stretches edge-to-edge across the full browser
width, and the add/edit form *replaces* the transaction list entirely
(a full-screen takeover that makes sense on a phone, not in a wide
window with room for both).

## User stories

- As a user on a desktop browser, the transaction list and the add/edit
  form are both visible at once, side by side — not one replacing the
  other.
- As a user on a wide window, form fields use the extra width sensibly
  (Amount and Date side by side) instead of each stretching to fill an
  oversized single column.
- As a user on a phone (or a narrow browser window), nothing changes —
  the exact current mobile experience keeps working.

## Requirements

### A width breakpoint, not a phone/desktop content fork

One new hook, `useWideWeb()` (`src/theme/useWideWeb.ts`): `Platform.OS
=== 'web' && useWindowDimensions().width >= 900`. `cheap` has no sidebar
nav to fit (unlike `da2`'s spec 012, which needed 960px for a 232px
sidebar) — 900px comfortably fits a ~400px list column + a form panel
without cramping. Resizing the browser crosses it live
(`useWindowDimensions` is reactive). Every existing mobile/native code
path stays exactly as it is; the wide-web layout is a new branch next to
it, not a replacement.

### `TransactionsScreen`: list and form as persistent columns (`≥` breakpoint only)

- Below the breakpoint (or on native): **exactly today's behavior** —
  the form, when open, replaces the list entirely.
- At `≥` the breakpoint: the list (left column, ~400px) and the form
  panel (right column, filling the remaining width) render
  **simultaneously**, always. The "Add" button still opens the form
  (same state transition as today — `formOpen`/`editingId`); tapping a
  row still opens it for editing in the same panel. When no form is
  open, the right column shows a calm empty state ("Select **Add**, or
  a transaction, to see it here.") instead of collapsing to nothing.
- Inside the form panel at `≥` the breakpoint only, Amount and Date
  render in a two-column row instead of stacked — the one place this
  spec changes field layout, not just chrome. Every other field
  (category chips, note) stays a single column; two fields is enough to
  use the width without inventing a form-builder grid system.
- No change to `handleSave`, validation, the store, or any Firestore
  code — this is rendering only, exactly like `da2`'s spec 012.

### Universal fix: cap content width regardless of breakpoint

`Screen` gets a max content width on web (560px, centered) whenever
`Platform.OS === 'web'`, independent of `useWideWeb()`. This alone fixes
`SignInScreen` and `VerifyEmailScreen` (which get no bespoke wide-web
treatment) and is what makes the *narrow*-but-still-a-browser case (a
half-width window, a phone's browser) look intentional instead of
stretched — matches `da2` spec 012's identical "universal `Screen` cap"
requirement.

## Data model

None. No store, repository, or Firestore rules changes.

## Acceptance criteria

1. **Given** a browser window `< 900px` wide, **then** `TransactionsScreen`
   renders pixel-for-pixel what spec 002 already shipped (form replaces
   list) — this spec changes nothing below the breakpoint.
2. **Given** a window `≥ 900px` and the form closed, **then** the
   transaction list renders in a left column and the right column shows
   the empty-state prompt, not nothing.
3. **Given** a window `≥ 900px`, **when** "Add" is pressed or a
   transaction row is tapped, **then** the form opens in the right
   column while the list stays visible and interactive in the left
   column (not replaced).
4. **Given** a window `≥ 900px` and the form open, **then** Amount and
   Date render side by side in one row, not stacked.
5. **Given** `SignInScreen` or `VerifyEmailScreen` on web at any width,
   **then** content is capped at a readable width and centered — not
   stretched edge to edge.
6. **Given** the same interactions on native (iOS/Android) or a narrow
   web window, **then** behavior is identical to before this spec — no
   regression to the existing mobile flow.
7. **Given** `npx tsc --noEmit` and `npx jest`, **then** both stay green.

## Out of scope

- Any navigation chrome (sidebar, tabs) — `cheap` has exactly one
  screen after sign-in, so there's nothing to navigate between, unlike
  `da2`'s spec 012 (which needed a sidebar for 4 destinations).
- A tablet-specific (mid-width) layout — the breakpoint is a hard on/off,
  matching `da2`'s spec 012 decision.
- Reworking the chip row, note field, or any field beyond Amount/Date
  into a grid.
- Keyboard shortcuts, hover states beyond what `Pressable`'s web output
  gives for free, or other desktop-specific interaction polish.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1, 6 — narrow/native unchanged | Component/unit | `TransactionsScreen` tests re-run with `useWideWeb` mocked `false` (the existing suite, untouched — proves no regression). |
| 2, 3, 4 — wide-web list+form columns, empty state, Amount/Date row | Component/unit | New `TransactionsScreen` tests with `useWideWeb` mocked `true`: list stays rendered while the form is open; empty state shows when it isn't; both panels are queryable at once. |
| 5 — `Screen` width cap on web | Unit | `Screen` test: `Platform.OS` mocked `'web'`, asserts the content container's style includes the max-width/centering. |
| 7 — no regressions | Automated | `npx tsc --noEmit`, `npx jest`. |

Manual, in a browser (after automated tests pass): resize the deployed
app across 900px and confirm the criteria above at
https://lalanne-cheap-tracker.web.app.

## Verification results

Deployed 2026-09-21.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1, 6 — narrow/native unchanged | ✅ | `TransactionsScreen.test.tsx` (the pre-existing suite, untouched) passes unmodified — `useWideWeb()` returns `false` under the test environment's default `Platform.OS`, exercising the exact same code path as before this spec. |
| 2 — list + empty state when closed | ✅ | `TransactionsScreen.wideWeb.test.tsx`: list rows and `wide-empty-state` both render; `transaction-form` absent. |
| 3 — list stays visible next to the open form | ✅ | Same file: after pressing Add, both the list row and `transaction-form` are present simultaneously; `wide-empty-state` is gone. |
| 4 — Amount/Date in one row | ✅ | `amount-date-row` contains both `amount-input` and `date-input` (checked via `within()`). |
| 5 — `Screen` width cap (sign-in/verify-email) | ✅ | `Screen.test.tsx`: on `Platform.OS === 'web'`, the content container's style includes `maxWidth: 560`, `alignSelf: 'center'`, `width: '100%'` — applies to every screen through `Screen`, including `SignInScreen`/`VerifyEmailScreen`, with no per-screen change needed. |
| 7 — no regressions | ✅ | 23 suites / 100 tests pass; `tsc --noEmit` clean. |

**What shipped:**
- `src/theme/useWideWeb.ts` — `Platform.OS === 'web' && useWindowDimensions().width >= 900`.
- `Screen.tsx` — unconditional web width cap (`webContent` style), independent of the breakpoint.
- `TransactionsScreen.tsx` — restructured into shared pieces (`typeToggle`, `amountField`, `dateField`, `categorySection`, `noteAndActions`, `rows`) assembled two ways: the untouched narrow/native JSX, and a new `isWideWeb` branch rendering a persistent `wideListColumn` + `wideFormColumn` (with an `amountDateRow` two-column cell inside the form) instead of the list/form replacing each other.
- No store, repository, or Firestore rules changes.

**Still open:** the manual browser resize pass (crossing 900px live, confirming the "Add"/row-click transitions look right at the actual deployed URL) hasn't been done yet — same "no browser-automation tool available" limitation as specs 001/005. Staying at `implemented`, not `verified`, until that's checked against the running app.
