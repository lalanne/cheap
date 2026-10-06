# 014 — Continuous Integration (GitHub Actions)

**Status:** verified
**Depends on:** 000 (stack), every implemented spec (the suite CI runs is
theirs, not new work of its own)

## Purpose

Every change in this repo so far has been tested by hand — I run `tsc`,
`jest`, and `npm run test:rules` myself before a PR gets merged. That's
the SDD/TDD process working, but it's only as reliable as remembering to
run it every time, and nothing stops a merge if a check is skipped. CI
makes "tests pass before merge" automatic and enforced instead of a habit.

## Decisions

- **GitHub Actions, on a standard `ubuntu-latest` (Linux) runner.** No
  macOS runner: the one thing that needs one — the actual iOS compile —
  already happens on EAS Build's own cloud (spec 004), not here. This
  workflow is fast feedback on every push, not a deploy pipeline.
- **Scope: typecheck + both test suites.** `tsc --noEmit`, `npm test`
  (467 unit/component tests, Firebase fully mocked — no secrets, no
  network), and `npm run test:rules` (the Firestore/Storage rules suite,
  against the local emulator under a fake project id, `demo-cheap` — same
  "never a real project" rule as running it by hand). No web-export
  build step and no `eas build`/`eas submit` trigger — see Out of scope.
- **Cost: effectively free.** The repo is private, so runs draw from
  GitHub's monthly free Actions minutes (2,000 on Free, 3,000 on Pro),
  billed at the cheapest (Linux, 1×) rate — no macOS/Windows multiplier.
  A full run (checkout, install, typecheck, both suites) is estimated at
  3–6 minutes; even running on every push at this project's current pace
  stays well inside the free allowance. See the Verification plan for
  where the real number is recorded once this has actually run a few
  times.
- **Triggers: every push to any branch, and every pull request into
  `main`.** Matches how this repo actually works — a branch per change,
  PR'd into `main` (per `CLAUDE.md`'s git rule) — so a check fails on the
  branch before it's ever proposed for merge, not just at PR time.
- **Three jobs, gated in sequence (`needs:`), not run in parallel —
  `static-analysis` → `unit` → `integration`.** Deliberate, not the
  default: no point spending minutes on unit tests against code that
  doesn't even type-check, or on the emulator-backed integration suite if
  the unit layer already failed — matches CLAUDE.md's own ordering (unit
  is "the bulk of the suite, fastest feedback," ahead of integration). The
  trade-off, made on purpose: a *clean* run takes about the same total
  time as before (stages still run one after another, not concurrently),
  in exchange for a *broken* run stopping at the first failing stage
  instead of burning minutes on the rest, and each stage getting its own
  named status check instead of one combined pass/fail. Pure parallel
  jobs would finish a clean run faster but waste the later stages'
  minutes whenever an earlier one was always going to fail — not the
  right trade for this repo's test pyramid.
- **No separate "acceptance" or "e2e" job.** "Acceptance" isn't a
  distinct runnable suite in this repo — per CLAUDE.md's test layout, it's
  a traceability label: each spec's Verification plan maps a Given/When/
  Then criterion onto specific unit or integration tests that already run
  in those two jobs, not a separate test runner. An `e2e` job would have
  nothing to run — no E2E tests exist yet, deliberately (CLAUDE.md, citing
  `da2`'s experience building one speculatively and it adding no value);
  add that job only when a spec concretely needs the layer, not now.
- **Node version pinned to this project's actual local version (26)**,
  not a floating LTS alias — same reasoning as the EAS npm-version
  gotcha already documented for this repo (`feedback-cheap-eas-deploy-
  gotchas`): matching the real toolchain avoids a class of "works here,
  fails there" drift, more valuable than always tracking the newest LTS.
- **A pinned JDK (Temurin 21) via `actions/setup-java`.** `firebase-tools`
  requires Java 21+ for the Firestore/Auth emulator and `ubuntu-latest` has
  no usable default — found the same way, by actually running the
  workflow, not assumed.
- **npm pinned to 10.9.8 in the workflow too, not just locally.**
  `package-lock.json` is already pinned to match EAS Build's builder
  (npm 10.9.8); GitHub's Node 26 runner image ships npm 11.x by default,
  which resolves optional platform packages (e.g. `lightningcss-*`)
  differently against that same lockfile and fails `npm ci`'s strict
  consistency check — found by actually running this workflow, not
  guessed. Fixed with `npm install -g npm@10.9.8` right after
  `setup-node`, so CI and EAS share one npm version and one lockfile
  instead of needing two kept in sync.
- **Caching:** `actions/setup-node`'s built-in `cache: npm` (keyed on
  `package-lock.json`) for `node_modules`, plus caching
  `~/.cache/firebase/emulators` so the rules job doesn't redownload the
  Firestore/Auth emulator JARs on every run.
- **Not a required branch-protection check yet.** `gh pr merge` would
  need to respect it either way, and wiring that up is a GitHub repo
  setting, not a code change — do it once this has run successfully a
  few times and the timing/flakiness is known, not on day one.

## Requirements

`.github/workflows/ci.yml` — three jobs, each repeating its own
checkout/install (cheap relative to the free-minutes budget; see
Decisions), gated with `needs:` so a later job never starts once an
earlier one has failed:

```yaml
name: CI
on:
  push:
  pull_request:
    branches: [main]

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '26'
          cache: npm
      - run: npm install -g npm@10.9.8
      - run: npm ci
      - run: npx tsc --noEmit

  unit:
    needs: static-analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '26'
          cache: npm
      - run: npm install -g npm@10.9.8
      - run: npm ci
      - run: npm test -- --ci

  integration:
    needs: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '26'
          cache: npm
      - run: npm install -g npm@10.9.8
      - run: npm ci
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '21'
      - uses: actions/cache@v4
        with:
          path: ~/.cache/firebase/emulators
          key: firebase-emulators-${{ runner.os }}
      - run: npm run test:rules
```

## Acceptance criteria

1. **Given** a push to any branch, **when** the workflow runs, **then**
   `tsc --noEmit`, `npm test`, and `npm run test:rules` all run, and the
   workflow's pass/fail matches what running those three commands locally
   would report.
2. **Given** a change that breaks a unit test, a rules test, or
   introduces a type error, **when** it's pushed, **then** the workflow
   run fails and names which step failed (visible in the GitHub Actions
   UI/PR checks, not just "something failed").
3. **Given** a clean push (everything passing locally), **when** the
   workflow runs, **then** it succeeds without any manual setup step —
   no real Firebase project touched, no secrets required.
4. **Given** repeated runs, **then** the `node_modules` and emulator-jar
   caches are reused (visibly faster on a cache hit vs. the first,
   cold run).
5. **Given** a type error, **when** it's pushed, **then** the
   `static-analysis` job fails and neither `unit` nor `integration` runs
   at all (shown as skipped, not passed or failed) — and symmetrically, a
   failing `unit` job skips `integration`.

## Out of scope

- **Triggering `eas build`/`eas submit` from CI.** Those are deploy
  actions with real cost and consequence (spec 004) — stay a deliberate,
  manual step, same as every build this project has shipped so far. A
  future amendment can wire a workflow to trigger one (e.g. on a tag),
  but that's a separate decision, not a side effect of adding basic CI.
- **A web-export build step** (`npx expo export -p web`) or a web deploy
  trigger (spec 005) — CI here is about the test suite, not deployment.
  Revisit if deploys become frequent enough that automating them is
  worth the added secrets (`EXPO_PUBLIC_FIREBASE_*`) this would need.
- **Required branch-protection status checks** — see Decisions; a
  follow-up repo-settings step once this has proven stable.
- **Linting** — this repo has no lint script today; not introduced here.
- **Matrix builds / multiple Node or OS versions** — one pinned version,
  one OS, matching Decisions' reasoning.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1 — all three checks run, matching local results | Manual / CI run | Push a branch with the workflow added; confirm in the GitHub Actions UI that all three steps ran and passed, matching a local run of the same commands. |
| 2 — a real failure is caught and visible | Manual / CI run | Push a commit with one deliberately broken test (reverted after); confirm the workflow run fails and the failing step/test is identifiable from the UI/logs. |
| 3 — no manual setup, no real project touched | Code review + CI run | Review the workflow for any step requiring a secret or external credential (none should exist); confirm a run succeeds from a clean checkout with nothing configured beyond the repo itself. |
| 4 — caching works | Manual / CI run | Compare a cold run's duration/log (cache miss) against a second run on the same branch (cache hit). |
| 5 — gating skips downstream jobs | Manual / CI run | Push a deliberate type error; confirm in the Actions UI that `unit`/`integration` show as skipped, not run. Separately, push a deliberately broken unit test with valid types; confirm `static-analysis` passes, `unit` fails, and `integration` shows as skipped. |

No unit-test layer for the workflow file itself — a GitHub Actions
workflow isn't unit-testable the way application code is; its own
correctness is proven by actually running it, per the Verification plan
above, same as spec 004/005's deploy-pipeline criteria.

## Verification results

Implemented and verified 2026-10-06, against real GitHub Actions runs on
this branch (not just a local read of the YAML) — including two real
failures found and fixed along the way, not guessed at:

- The first run failed on `npm ci`: the runner's default npm (11.x on
  Node 26) disagreed with `package-lock.json` (pinned to npm 10.9.8 for
  EAS Build) over optional platform packages. Fixed by pinning npm in the
  workflow too; recorded in the EAS deploy gotchas memory as the same
  error class hitting a second consumer.
- The second run failed on `npm run test:rules`: `firebase-tools` needs a
  JDK 21+ for the emulator, `ubuntu-latest` has no usable default. Fixed
  with `actions/setup-java` (bumped to v5 after v4 flagged as deprecated).
- Third run: clean, 1m45s (run
  [37405016989](https://github.com/lalanne/cheap/actions/runs/37405016989)).
- Restructured into three gated jobs after discussion (fail fast on cost,
  not just latency); re-verified live again on the new structure,
  including the gating itself — see criterion 5.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1 — all three checks run, matching local | ✅ | Clean run: `npm ci`, `tsc --noEmit`, `npm test` (467 passing), `npm run test:rules` (22 passing) all ran and passed, same counts as running them locally. |
| 2 — a real failure is caught and visible | ✅ | Pushed a deliberately wrong assertion (`payoffMath.test.ts`); the run failed at the `npm test` step specifically (later steps correctly skipped), and the log named the exact test, file, and expected/received values — [run 37405375673](https://github.com/lalanne/cheap/actions/runs/37405375673). Reverted immediately after. |
| 3 — no manual setup, no real project touched | ✅ | Workflow review: no `secrets.*` reference anywhere; `test:rules` runs against `demo-cheap`, the same fake project id used locally. Every run succeeded from a clean checkout with nothing configured in the repo settings. |
| 4 — caching works | ✅ | Cold run: 2m24s. Re-run on the same commit (cache hit on both `node_modules` and the emulator JARs): 1m45s–1m47s — consistently faster. |
| 5 — gating skips downstream jobs | ✅ | Pushed a deliberate type error: `static-analysis` failed, `unit`/`integration` both showed as skipped, 0s, never run — [run 37406996338](https://github.com/lalanne/cheap/actions/runs/37406996338). Reverted, then pushed a deliberately wrong (type-valid) assertion: `static-analysis` passed, `unit` failed, `integration` skipped — [run 37407097588](https://github.com/lalanne/cheap/actions/runs/37407097588). Reverted immediately after. |

**What shipped:** `.github/workflows/ci.yml`, this spec. No application
code changed — this is the test suite everything else already built,
just running automatically now.

Not yet a required branch-protection check (deliberately, per Decisions)
— a repo-settings change for the user to make when they're ready, not
bundled into this spec.
