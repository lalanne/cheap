# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal expense/income tracker: log transactions, categorize them, and see
where money is going via charts — with the goal of surfacing concrete
financial decisions (what to cut, what's trending up), not just record-keeping.

## Spec-Driven Development — the core rule

This repo follows SDD strictly. **Do not write feature code without an
approved spec.** The process, defined in `specs/README.md`:

1. Every feature has a numbered spec in `specs/` (requirements, data model,
   Given/When/Then acceptance criteria).
2. Specs are the source of truth — when requirements change, edit the spec
   first, then the code.
3. A feature is done only when all its acceptance criteria pass; specs move
   `draft → approved → implemented → verified`, tracked in the index table in
   `specs/README.md` (keep it updated).
4. Implement one spec at a time, in numbered order (they declare
   dependencies).
5. **Discuss on the spec, not in chat and not in code.** When scope or
   behavior is being decided, edit the relevant spec doc and talk through
   the diff there.

Read `specs/000-overview.md` first — it holds the product vision, v1
scope/out-of-scope table, and cross-cutting constraints.

## Test-first — how every change is made

This applies to **every** change — a new feature, a bug fix, a cosmetic
fix, anything. Not optional, not just for "important" changes.

**Hard rule: no implementation code without a test that fails first and
covers it.** Write the test(s), run them, confirm they fail for the right
reason, then write the minimum code to make them pass. This applies at
whichever of the four layers below the change actually needs.

1. **Unit** — pure logic in isolation, mocked Firebase/network: validation,
   formatters, store actions, category/aggregation math. The bulk of the
   suite, fastest feedback.
2. **Integration** — real boundaries instead of mocks: Firestore/Storage
   security rules run against the local Firebase Emulator (never a real
   project); repository/data-layer code run against the emulator to catch
   query or schema mistakes a mock would hide.
3. **Acceptance** — one test per Given/When/Then criterion in a spec. This
   is the traceability link between `specs/` and the test suite: every
   spec's Verification plan table maps each numbered criterion to the
   test(s) proving it, and a spec cannot move to `implemented` until every
   row is checked off.
4. **End-to-end** — a real flow through the actual UI, against the emulator
   suite (not mocks). Reserved for flows the layers above can't credibly
   prove (a full sign-up round-trip, a chart rendering real aggregated
   data) — not a default for everything, and not built speculatively ahead
   of the spec that actually needs it (see `da2`'s experience: an E2E
   harness planned early but never built added no value until a spec
   concretely required it).

Every change ships with a regression test at whichever layer would have
caught it — a fix "proven" only by re-reading the code isn't done.

## Test layout

- `src/**/__tests__/` — unit/component tests, mocked Firebase. Jest +
  `jest-expo` + React Native Testing Library (matching `da2`).
- `firebase/tests/` — Firestore/Storage rules tests, run via
  `@firebase/rules-unit-testing` against the local emulator
  (`jest.rules.config.js`), never a real project.
- An E2E tool (Maestro for native, likely Playwright for web) gets picked
  and wired up when a spec's Verification plan first genuinely needs that
  layer — not speculatively before then.

## Locked-in stack decisions (rationale in specs/000-overview.md)

- **Expo (React Native) + TypeScript** — Android, iOS, and web from one
  codebase, all targeted in v1.
- **Firebase**: Auth, Firestore (real-time sync). No custom API server.
- Charting library must work acceptably on both React Native and web from
  one implementation — see the (upcoming) charting spec before building any
  dashboard UI.

## Reference project

`/Users/lalanne/github/da2` is this project's sibling by the same author —
same Expo + Firebase + TypeScript + Zustand stack, same SDD/TDD process. Use
it as a working reference for Expo/Firebase wiring, version choices, and
what a spec/CLAUDE.md/test layout should look like here.

## Git

Not yet a git repository. Once initialized: never commit feature work
directly to `main` — branch, push, open a PR for review.
