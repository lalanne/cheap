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
