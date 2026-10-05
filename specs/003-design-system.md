# 003 — Design System & Visual Language

**Status:** implemented
**Depends on:** 000

## Decision

**"Calm Ledger"** — chosen from three look-and-feel options mocked up and
presented for comparison (sign-in + dashboard screens for each, chart colors
validated colorblind-safe and held constant across all three so the
comparison was about UI skin, not chart readability).

Rationale: a money app needs to be trusted and legible before it's
distinctive. A serif headline on a neutral, toned-down ground gets that
without feeling cold or generic — the two runners-up (a warm/friendly
skin, a dark/techy skin) are recorded as rejected directions, not deleted
ideas, in case dark mode gets scoped later (see Out of scope).

## Visual language

- **Palette**
  - Page background: `#F7F5F1`
  - Surface/card: `#FFFFFF`, 1px border `rgba(11,11,11,0.08)`, 14px radius
  - Primary ink: `#1B1B18`
  - Secondary ink: `#6B6A63`; muted: `#8A8880`
  - Accent (primary actions, active states, links): `#0F6B5C` (teal).
    Alternate shades a user could pick in-app later: `#155E52`, `#3A6EA5`,
    `#8A6D3B` — same role, not separate meanings.
  - Status: income/positive uses `#0F7A3D` (success green); expense amounts
    use primary ink, not red — red is reserved for a genuinely critical
    state (e.g. over-budget), not used anywhere in v1 yet.
- **Typography**: display/headings in **Fraunces** (serif, 500–600 weight);
  body/UI text in **Public Sans** (400–600). Numeric amounts use
  `font-variant-numeric: tabular-nums` wherever they sit in a column
  (transaction list rows) so digits align.
- **Chart colors**: the validated categorical order from the dataviz
  skill's reference palette — blue `#2a78d6`, orange `#eb6834`, aqua
  `#1baf7a`, yellow `#eda100`, magenta `#e87ba4` (first five slots of the
  fixed, colorblind-safe adjacency order). Never reordered, never reused
  for anything but category identity — spec 002's category color mapping
  is fixed to this order.
- **Shape/components**: 14px radius on cards, 10px on inputs/buttons,
  hairline borders over shadows, generous whitespace, no gradients, no
  emoji, no fake status bars.
- **Reference mockups**: the two `Calm*` artboards on the shared look-and-feel
  canvas (`CalmLogin.dc.html`, `CalmDashboard.dc.html`) are the source of
  truth for spacing and composition, not just color.

## Requirements

- Colors, spacing, radii, and type scale live in one theme/tokens module
  (`src/theme/`) — no raw hex or px literals for themed values in screen
  code.
- Fonts (Fraunces, Public Sans) are loaded once at app start via Expo's
  font-loading API, gated behind a splash/loading state — no screen ever
  renders with the fallback system font.
- Every screen is composed from a small set of shared primitives (`Button`,
  `Card`, `Input`, `StatTile`, etc.) built against these tokens — no
  one-off styles per screen.
- **Every top-level screen renders inside a shared `Screen` primitive**,
  not a raw `View`: it accounts for safe-area insets (so content never
  collides with the status bar, the notch, or iOS's TestFlight banner —
  found missing only once tested on a real device, spec 004) and wraps
  content in a keyboard-avoiding scroll view (found missing the same way
  — a form's later fields, and its own Save/Cancel buttons, were
  unreachable once the keyboard covered them, with no way to dismiss it).
  This was skipped in specs 001/002's first pass because the simulator
  build never actually launched (spec 004's environment limitation) — the
  gap was invisible until a real device surfaced it.
- **A segmented toggle's selected state must be a background fill, not a
  text-color change alone.** The Expense/Income toggle on the
  transactions form originally only changed text color between selected
  and unselected tabs — a real device user reported the highlight was
  "too dim, I barely can see what I selected." Fixed with a solid
  `colors.accent` fill + `colors.onAccent` text on the selected tab
  (`onAccent`/`accent` already existed as tokens; this just applies them
  consistently to every segmented control, not just the sign-in/sign-up
  toggle that already did this).

## Acceptance criteria

1. **Given** the theme module, **when** any screen renders, **then** it
   references only named tokens (`colors.*`, `spacing.*`, `radius.*`) — no
   inline hex/px literals for themed values appear in screen code.
2. **Given** a cold app start, **when** fonts haven't finished loading,
   **then** a splash/loading state is shown — no screen renders text in the
   fallback system font.
3. **Given** a shared primitive (e.g. `Button`, `Card`) used on two
   different screens with the same props, **then** it renders identically
   — no per-screen override of a themed property.
4. **Given** any top-level screen, **when** it renders on a device with
   safe-area insets (notch, status bar, TestFlight banner), **then** its
   content starts below those insets, not underneath them.
5. **Given** a form screen, **when** the on-screen keyboard is open over a
   field, **then** the remaining fields and the screen's action buttons
   stay reachable by scrolling, and the keyboard can be dismissed without
   leaving the screen.

## Out of scope

- Dark mode ("Ledger Dark", the rejected option C) — not built in v1.
  Tokens are structured so a second theme could be added later without a
  rewrite, but nothing dark ships now.
- Any third-party component library — the primitives are this project's
  own, built on these tokens.

## Verification plan

This spec is mostly static/config, not behavior — no security-rules or
E2E layer applies.

| Criterion | Layer | How |
|-----------|-------|-----|
| 1 — no raw values in screen code | Lint / review | An ESLint rule (or, failing that, manual review before merge) flags hex colors / raw px outside `src/theme/`. |
| 2 — splash gate until fonts load | Unit/component | Test: app root renders a loading state while `useFonts` is pending, main content only once resolved. |
| 3 — shared primitives render identically | Unit/component | Same primitive + same props on two call sites → same computed style, asserted directly rather than by eye. |
| 4 — content respects safe-area insets | Unit/component | `Screen` test: mocked `useSafeAreaInsets` returning non-zero insets, assert the content container's padding reflects them. |
| 5 — keyboard-avoiding scroll | Unit/component | `Screen` test: renders its children inside a `ScrollView`/`KeyboardAvoidingView` with `keyboardShouldPersistTaps="handled"` — proven by structure/props, not a real keyboard (RNTL can't drive one). Manual, real device: confirmed by the bug report that prompted this amendment; re-confirm after the fix ships. |

**Amendment (2026-09-18):** added the `Screen` primitive requirement and
criteria 4–5 after real-device testing (spec 004) surfaced both gaps —
the status bar/TestFlight banner overlapping the "Transactions" header,
and no way to reach a form's Save button or dismiss the keyboard once it
was open. Every screen built so far (`SignInScreen`, `VerifyEmailScreen`,
`TransactionsScreen`) used a raw `View` container; migrating them to
`Screen` is part of landing this amendment, not a follow-up.

**Implemented same day.** `react-native-safe-area-context` installed
(a native module — needs a new build, not just an OTA update);
`SafeAreaProvider` wraps `App.tsx`; all three screens migrated to
`Screen`. All 78 tests pass (5 new: `Screen.test.tsx`), `tsc --noEmit`
clean. One test-infra fix needed along the way: every screen test now
renders through `Screen` → `useSafeAreaInsets`, which throws without a
`SafeAreaProvider` in context — added `jest.setup.js` (this project's
first) globally mocking the library via its own official
`react-native-safe-area-context/jest/mock` (note: it's a single
`export default {...}`, so the mock factory needs `.default`, not the
bare `require()` result). Real-device re-verification of criteria 4–5
pending the next TestFlight build.

### Amendment (2026-09-25, implemented): warning and critical status tokens

Spec 012 needs a graded status scale for the overdraft gauge and banner.
Red stays reserved for the genuinely critical state (over the limit), as
above; amber and orange cover the two earlier steps. Status is always also
carried by an icon and wording, never color alone.

| Role | Text/icon | Tone background | Tone border |
|------|-----------|-----------------|-------------|
| Notice (in use) | `#A16207` (dark text `#5C3F04`) | `#FBF3DC` | `#EBD79A` |
| Warning (high, ≥75%) | `#C2410C` (dark text `#7C2D0A`) | `#FCE8DC` | `#F2C2A4` |
| Critical (over limit) | `#B91C1C` (dark text `#7F1D1D`) | `#FBE1E1` | `#F0B3B3` |

Added to `src/theme/tokens.ts` as `colors.status.*` when spec 012 is
implemented; no screen uses raw hex for these.

### Amendment (2026-10-04, implemented): the tab bar had no top safe-area padding

Found on a real device (TestFlight build 7): the top tab bar (`Log` /
`Overdraft` / `Manage` / `Dashboard`, added by spec 009's 2026-09-23
amendment) was covered by the status bar/TestFlight banner — the same
class of bug this spec's 2026-09-18 amendment already fixed for every
screen's own content via the `Screen` primitive, but the tab bar sits in
`App.tsx` above/outside every individual `Screen`, so that fix never
reached it.

- `App.tsx`'s tab bar now gets `insets.top + spacing.sm` as its top
  padding, read via `useSafeAreaInsets()` in a new `MainApp` component —
  a separate component was required because the hook only resolves real
  values for a descendant of `SafeAreaProvider`, and `App()` itself builds
  its content as a *sibling* of that provider, not inside it.

**Result:** ✅. `App.test.tsx` gained a regression test (mocked non-zero
insets, same pattern `Screen.test.tsx` already uses) asserting the tab
bar's `paddingTop` is at least the inset. 462 tests pass (up from 461),
`tsc --noEmit` clean. Shipped in TestFlight build 8.

### Amendment (2026-10-05, implemented): the tab bar's active indicator

The 2px bottom-underline active indicator didn't read well in practice (user
feedback after TestFlight build 8). Replaced from five options on a design
canvas ("Tab Bar Style Options") with **option E**: a flat, transparent bar
(no track, no line) where only the active tab's icon sits in a tight,
solid-`colors.accent` capsule (`colors.onAccent` icon inside it); every
inactive tab is a plain `colors.inkMuted` icon and label, nothing drawn
around it. Each tab gained its own stroke-SVG icon (`src/components/
TabIcon.tsx`) — the bar was text-only before.

**Result:** ✅. `App.test.tsx` gained a regression test asserting exactly
one tab's icon container (`tab-icon-${key}`) carries `colors.accent` as its
background at a time, and that pressing a different tab moves it. 463 tests
pass (up from 462), `tsc --noEmit` clean.
