# 014 — Continuous Integration (GitHub Actions)

**Status:** verified (amended 2026-10-12: criteria 6–9, CI hardening, issue #21; 2026-10-13: criteria 10–11, shared setup action, issue #22; 2026-10-13: criteria 12–13, web export check, issue #23; 2026-10-13: criteria 12–13 revised to a separate `web-export` job; 2026-10-13: criteria 14–16, unit coverage artifact, issue #24, criteria 14–16; 2026-10-13: criterion 17, required checks and `main` protection, issue #25)
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
  "never a real project" rule as running it by hand), plus the web
  export check below. No `eas build`/`eas submit` trigger — see Out of
  scope.
- **Web export check in its own `web-export` job.** *(Amended 2026-10-13,
  issue #23; first a step in `static-analysis`, then split out on review.)*
  `npx expo export -p web` runs in a job of its own, so a broken
  web bundle (e.g. a web-only import that fails to resolve) fails CI
  instead of surfacing at deploy time (spec 005), and it validates the
  artifact a later web-deploy job would ship. It runs with fake
  `EXPO_PUBLIC_FIREBASE_*` / `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  placeholders set in the step's `env` — the bundle only inlines them,
  nothing connects to Firebase — so it still needs no secrets. Output goes
  to a throwaway directory. Measured locally at ~4s. A separate job gets its own named status check
  (a red `web-export` is distinguishable from a type error) and can be
  re-run alone, at the price of a repeated checkout + install. It runs
  **in parallel with `static-analysis`** (neither `needs:` the other), and
  `unit` has `needs: [static-analysis, web-export]` — so unit tests start
  only when both are green, and a failure in either skips `unit` and
  `integration`. Cost vs. fully sequential: a broken run may spend the
  other parallel job's minutes before it's cancelled/finished, accepted
  because the clean-run wall-clock time is unchanged and the export job is
  short.
- **`expo-doctor` deliberately not added here.** It already fails on
  `main` (duplicate `expo-font`, major/patch version mismatches, an
  unused `app.json`), and fixing those is native-module work needing its
  own spec and a device build. Tracked in issue #39; add it to
  the gating jobs (likely `web-export`) once it passes.
- **Cost: effectively free.** The repo is private, so runs draw from
  GitHub's monthly free Actions minutes (2,000 on Free, 3,000 on Pro),
  billed at the cheapest (Linux, 1×) rate — no macOS/Windows multiplier.
  A full run (checkout, install, typecheck, both suites) is estimated at
  3–6 minutes; even running on every push at this project's current pace
  stays well inside the free allowance. See the Verification plan for
  where the real number is recorded once this has actually run a few
  times.
- **Triggers: pushes to `main`, and every pull request into `main`.**
  *(Amended 2026-10-12, issue #21.)* Originally every push to any branch
  plus PRs into `main` — but a PR branch push fired both events, so every
  commit was built twice. The PR run already gives the branch its check
  before merge, so `push` is restricted to `main` (post-merge sanity)
  and `pull_request` covers everything else. A branch with no PR open
  gets no CI run; that's accepted (same as `lalanne/da2`).
- **Concurrency: one run per ref, newer cancels older.** `concurrency:
  { group: ci-${{ github.ref }}, cancel-in-progress: true }`. Two quick
  pushes to a branch waste minutes finishing the stale run. Note that on
  `main` this also cancels an in-flight run when a second merge lands;
  acceptable since the newest commit is what matters.
- **Least-privilege token: top-level `permissions: contents: read`.**
  The workflow only checks out and tests; it needs nothing else.
- **A `timeout-minutes` on every job** so a hung emulator or install
  can't burn the free-minutes budget until GitHub's 6-hour default:
  10 for `static-analysis` and `unit`, 15 for `integration` (a clean run
  is ~2 min total; these are generous ceilings, not targets).
- **Gated stages (`needs:`): (`static-analysis` ∥ `web-export`) → `unit`
  → `integration`.** *(Amended 2026-10-13: `web-export` added as a
  parallel peer of `static-analysis`.)* Apart from that one parallel
  pair, stages run in sequence, not in parallel. Deliberate, not the
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
- **Shared setup in a local composite action.** *(Amended 2026-10-13,
  issue #22.)* `.github/actions/setup/action.yml` holds `setup-node`
  (Node 26, `cache: npm`), the `npm install -g npm@10.9.8` pin, and
  `npm ci`; each job runs `actions/checkout@v4` then
  `uses: ./.github/actions/setup`. The checkout stays in the job because
  a local action can only be resolved once the repo is on disk. This
  leaves the npm pin (and Node version) in exactly one file instead of
  three. Job names, `needs:` gating and the integration job's extra
  Java/emulator-cache steps are unchanged.
- **Caching:** `actions/setup-node`'s built-in `cache: npm` (keyed on
  `package-lock.json`) for `node_modules`, plus caching
  `~/.cache/firebase/emulators` so the rules job doesn't redownload the
  Firestore/Auth emulator JARs on every run.
- **Unit coverage report, published as an artifact.** *(Amended
  2026-10-13, issue #24.)* The `unit` job runs `npm test -- --ci
  --coverage` and uploads `coverage/` with `actions/upload-artifact@v4`
  as `coverage-report`, kept 7 days (long enough to look at during a
  PR's review, short enough not to pile up storage). Details:
  - **Unit suite only.** The `integration` job exercises
    `firestore.rules` via `jest.rules.config.js`, not app code — its
    "coverage" would measure the test harness, not anything worth
    tracking. `jest.rules.config.js` is untouched.
  - **Measured over all of `src/`, not just imported files.**
    `collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**']`
    in `jest.config.js`. Jest's default counts only files some test
    imports, so an entirely untested file is invisible and the
    percentage reads high; the point of this amendment is an honest
    baseline. Root-level wiring (`App.tsx`, `index.ts`) is excluded —
    entry-point glue, not logic.
  - **Reporters: `text-summary`, `lcov`, `json-summary`.** The one-line
    summary lands in the job log, so the number is visible without a
    download; `lcov` produces the browsable HTML report
    (`coverage/lcov-report/index.html`); `json-summary` is a small,
    machine-readable total for a later threshold or PR-comment step to
    read. Set in `jest.config.js` so `npm test -- --coverage` locally
    produces the same report CI does.
  - **Uploaded even when tests fail** (`if: ${{ !cancelled() }}`) — a red
    run is exactly when the report is most useful. Skipped on cancel
    (superseded run, nothing to look at). If jest crashes before writing
    any report, the upload warns instead of failing
    (`if-no-files-found: warn`), so the job's red status stays the test
    failure, not a secondary upload error.
  - **`testTimeout` raised from Jest's 5 s default to 15 s.** Found
    while implementing: with `--coverage`, the full parallel run
    (55 suites, 8 local cores) timed out 3 heavy render tests (`App`,
    `CategoriesPanel › creates a new top-level custom category`,
    `TransactionsScreen › opens the add-transaction form…`) with
    "Exceeded timeout of 5000 ms" — they pass in 1.5 s without coverage
    and in isolation with it, so it's CPU contention from instrumentation,
    not a bug in them. A CI runner has fewer cores than that, so it'd be
    worse there. Raised globally in `jest.config.js` (not only under
    `--coverage`): one number to reason about, and a genuinely hung test
    still fails, just after 15 s instead of 5. Also verified at
    `--maxWorkers=2` to approximate a small runner (see Verification
    results).
  - **No threshold — coverage never fails CI.** No `coverageThreshold`.
    The baseline is recorded in this spec's Verification results and the
    PR; whether to set a floor (and where) is a follow-up decision, made
    with a real number in hand, not guessed now.
  - **Cost:** coverage instrumentation slows the unit run somewhat; the
    real delta is recorded in Verification results. The existing 10-min
    `timeout-minutes` stays unless that number says otherwise.
  - `coverage/` is added to `.gitignore` so a local coverage run leaves
    no untracked files.
- **Required checks and `main` protection.** *(Amended 2026-10-13,
  issue #25; supersedes "not a required check yet".)* CI had run cleanly
  for enough PRs that it is now enforced. `main` requires a pull request
  (0 approvals — this is a solo repo) and the four status checks
  `static-analysis`, `web-export`, `unit` and `integration`, with
  "require branches to be up to date" on; force-pushes and deletions are
  blocked, and the rules apply to administrators too, so there is no
  silent bypass. "Allow auto-merge" and "delete branch on merge" are on.
  **The repo is public**: branch protection and rulesets are unavailable
  on a private repo on GitHub's free plan (HTTP 403 "Upgrade to GitHub
  Pro or make this repository public"). Going public was chosen over
  paying for Pro; it was preceded by an audit for secrets (none ever
  tracked or in history; `GoogleService-Info.plist`/`.env` are
  gitignored) and by removing the Apple ID email from spec 004. The CI
  workflow needs no secrets and has a read-only token, so PRs from forks
  gain nothing. A side effect: Actions minutes are free on public repos,
  so the cost estimate above no longer applies. The settings live in
  GitHub, not in the repo — if a job is renamed, update the required
  check names or merges will block waiting on a check that never runs.

## Requirements

`.github/workflows/ci.yml` — four jobs, each repeating its own
checkout/install (cheap relative to the free-minutes budget; see
Decisions), gated with `needs:` so a later job never starts once an
earlier one has failed:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: npx tsc --noEmit

  web-export:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: npx expo export -p web --output-dir "$RUNNER_TEMP/web-export"
        env:
          EXPO_PUBLIC_FIREBASE_API_KEY: ci-placeholder
          EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: ci-placeholder
          EXPO_PUBLIC_FIREBASE_PROJECT_ID: demo-cheap
          EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: ci-placeholder
          EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ci-placeholder
          EXPO_PUBLIC_FIREBASE_APP_ID: ci-placeholder
          EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: ci-placeholder

  unit:
    needs: [static-analysis, web-export]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: npm test -- --ci --coverage
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7
          if-no-files-found: warn

  integration:
    needs: unit
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
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

The shared step, `.github/actions/setup/action.yml`:

```yaml
name: Setup
description: Node 26, npm 10.9.8 (matches EAS Build's lockfile), npm ci
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: '26'
        cache: npm
    - run: npm install -g npm@10.9.8
      shell: bash
    - run: npm ci
      shell: bash
```

`jest.config.js` gains the coverage settings (they apply only when
`--coverage` is passed; a plain `npm test` is unchanged):

```js
collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**'],
coverageReporters: ['text-summary', 'lcov', 'json-summary'],
```

and, applying to every run, `testTimeout: 15000`.

## Acceptance criteria

1. **Given** a push to `main` or a pull request into `main`, **when** the workflow runs, **then**
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
6. **Given** two quick pushes to one PR branch, **when** CI runs, **then**
   the first run is cancelled and only the latest commit's run completes.
7. **Given** a PR branch, **when** it is pushed, **then** exactly one CI
   run appears per commit (the `pull_request` run; no duplicate `push`
   run), and a merge to `main` triggers one `push` run.
8. **Given** the workflow file, **then** it declares top-level
   `permissions: contents: read` and no job widens it.
9. **Given** the workflow file, **then** every job sets `timeout-minutes`.
10. **Given** the repo, **then** the string `npm@10.9.8` (and the Node
    version) appears only in `.github/actions/setup/action.yml`, and every
    job in `ci.yml` uses that action instead of repeating the steps.
11. **Given** the refactor, **when** CI runs, **then** the jobs keep
    their names (`static-analysis`, `unit`, `integration`), gating and
    pass/fail behavior, and caches still hit.
12. **Given** a clean checkout, **when** CI runs, **then** a `web-export`
    job, parallel to `static-analysis` (neither waits on the other), runs
    `expo export -p web` with placeholder env values and no secrets,
    and passes.
13. **Given** a deliberately broken web-only import, **when** it's pushed,
    **then** `web-export` fails at the export step while `static-analysis`
    passes, and `unit` / `integration` are skipped. Symmetrically, a type
    error fails `static-analysis`, `web-export` still runs, and `unit` is
    skipped.
14. **Given** a pull request into `main` whose unit tests pass, **when**
    CI runs, **then** the run has a downloadable `coverage-report`
    artifact (retention 7 days) containing a browsable HTML report, the
    `unit` job log prints the coverage summary, and the job passes
    regardless of the coverage percentage.
15. **Given** a change that breaks a unit test, **when** it's pushed,
    **then** `unit` fails on the test step (not the upload) and the run
    still has a `coverage-report` artifact.
16. **Given** a source file under `src/` that no test imports, **when**
    coverage is collected, **then** it appears in the report at 0%
    rather than being omitted, and nothing under `src/**/__tests__/`
    appears in the report.
17. **Given** a pull request whose CI is red, **when** merging is
    attempted (`gh pr merge` or the UI), **then** GitHub refuses until
    the required checks pass; a direct push to `main` is rejected; and a
    green PR can be set to auto-merge.

## Out of scope

- **Triggering `eas build`/`eas submit` from CI.** Those are deploy
  actions with real cost and consequence (spec 004) — stay a deliberate,
  manual step, same as every build this project has shipped so far. A
  future amendment can wire a workflow to trigger one (e.g. on a tag),
  but that's a separate decision, not a side effect of adding basic CI.
- **A web deploy trigger** (spec 005) — CI here is about the test suite
  and build checks, not deployment. (The web *export* check is in scope
  as of criteria 12–13.)
  Revisit if deploys become frequent enough that automating them is
  worth the added secrets (`EXPO_PUBLIC_FIREBASE_*`) this would need.
- **Linting** — this repo has no lint script today; not introduced here.
- **A coverage threshold, PR coverage comment, or third-party coverage
  service (Codecov etc.)** — issue #24 deliberately starts with just the
  artifact and a recorded baseline; a floor is a follow-up decision.
  Coverage of the rules suite is out of scope too (see Decisions).
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
| 6 — newer push cancels older run | Manual / CI run | Push two commits in quick succession to a PR branch; confirm the first run shows as cancelled. |
| 7 — one run per commit | Manual / CI run | Open a PR, push a commit; confirm the Actions tab shows exactly one run for it (event `pull_request`). After merge, confirm one `push` run on `main`. |
| 8 — least-privilege token | Code review | Inspect `ci.yml`: top-level `permissions: contents: read`, no job-level override. |
| 9 — job timeouts | Code review | Inspect `ci.yml`: every job sets `timeout-minutes`. |
| 10 — single source for setup | Code review | `grep -rn "npm@10.9.8" .github` returns only the composite action; each job has `uses: ./.github/actions/setup`. |
| 11 — behavior unchanged | Manual / CI run | PR run shows the same three job names, sequential gating, a green result, and cache-hit install on a re-run. |
| 12 — export runs, no secrets | Code review + CI run | `ci.yml` step has only placeholder `env` values and no `secrets.*`; the PR run passes. |
| 13 — broken web import fails CI | Manual / CI run | Push a deliberately unresolvable import on a web path; confirm `web-export` fails (`static-analysis` green) and `unit`/`integration` skip; also confirm `static-analysis` and `web-export` start at the same time. Revert after. |
| 14 — coverage artifact on a green run | Code review + CI run | `ci.yml`: upload step present, no `coverageThreshold` in `jest.config.js`. On the PR run: `coverage-report` listed under Artifacts with 7-day retention, `lcov-report/index.html` opens, summary visible in the `unit` log. Record the baseline (statements/branches/functions/lines) and the unit job's duration vs. the previous run. |
| 15 — artifact still uploaded on a red run | Manual / CI run | On a throwaway draft PR, push a deliberately wrong assertion; confirm `unit` fails at `npm test`, the upload step runs green, and the run lists `coverage-report`. Close unmerged. |
| 16 — untested files counted, tests excluded | Local run + CI artifact | `npm test -- --coverage` locally: a known-untested `src/` file is listed at 0%; no `__tests__` path appears in `coverage/coverage-summary.json`. Same check against the CI artifact. Same on the CI artifact (PR #44): 78 files, 0 `__tests__` paths, 16 at 0%. |
| 17 — red check blocks merge | Manual / repo settings | `gh api repos/lalanne/cheap/branches/main/protection` lists the four required contexts, `strict`, `enforce_admins`, no force-push/deletion. On a throwaway PR with a deliberately failing test, `gh pr merge` is refused. On a green PR, `gh pr merge --auto` is accepted and the PR merges itself once checks pass. |

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

Not a required branch-protection check at this point (deliberately, per
Decisions at the time); made required later — see the 2026-10-13
amendment for issue #25 below.

### Amendment 2026-10-13 — web export check (issue #23)

Revised mid-review from a step in `static-analysis` to its own `web-export`
job, parallel to `static-analysis`, with `unit` needing both. Results below
are for the final layout.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 12 — parallel `web-export`, no secrets | ✅ | `static-analysis` and `web-export` both started at 03:19:30Z; `unit` started at 03:21:02Z, after both finished; all four jobs green — [run 38341158355](https://github.com/lalanne/cheap/actions/runs/38341158355). Step uses only placeholder `EXPO_PUBLIC_*` env values, no `secrets.*`; also verified locally with `.env.local` moved aside. |
| 13 — broken web import fails CI | ✅ | Unresolvable import (`@ts-ignore`d so `tsc` passed): `web-export` failed, `static-analysis` passed, `unit`/`integration` skipped — [run 38342428786](https://github.com/lalanne/cheap/actions/runs/38342428786). Reverse case, a type error only: `static-analysis` failed, `web-export` still ran and passed, `unit`/`integration` skipped — [run 38342561793](https://github.com/lalanne/cheap/actions/runs/38342561793). Both on a throwaway draft PR (#42), closed unmerged. |

`expo-doctor` was split out to issue #39 (fails on `main` today).

### Amendment 2026-10-13 — unit coverage artifact (issue #24)

Local and CI results:

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 14 — artifact on a green run | ✅ | PR #44 run [38426297069](https://github.com/lalanne/cheap/actions/runs/38426297069), all four jobs green: `coverage-report` listed (315,162 bytes, expires 7 days after creation), downloaded zip contains `lcov-report/index.html`, `lcov.info`, `coverage-summary.json`; the `unit` log prints the summary and `504 passed`; no `coverageThreshold`. Baseline on CI matches local exactly: statements 71.42%, branches 69.34%, functions 69.98%, lines 70.97%. `unit` took 84s vs 66–85s on the three previous `main` runs — no measurable slowdown, so the 10-min timeout stays. |
| 15 — uploaded on a red run | ✅ | Deliberately wrong assertion (`payoffMath.test.ts`, expected 999 received 12) on throwaway draft PR #45: `unit` failed at `npm test`, `Run actions/upload-artifact@v4` still succeeded, `coverage-report` (315,147 bytes) listed, `integration` skipped — [run 38428360323](https://github.com/lalanne/cheap/actions/runs/38428360323). PR closed unmerged, branch deleted. |
| 16 — untested files counted, tests excluded | ✅ | Report covers all 78 non-test `src/` files, 16 of them at 0%, and 0 `__tests__` paths. Before the change only 58 files were reported (the untested ones were invisible). Same on the CI artifact (PR #44): 78 files, 0 `__tests__` paths, 16 at 0%. |

**Baseline (local, 8 cores):** statements 71.42%, branches 69.34%,
functions 69.98%, lines 70.97%. Previously Jest reported 88.38% lines
only because untested files were left out of the denominator.

**Found while implementing:** `--coverage` made 3 heavy render tests
exceed the 5 s default timeout in the full parallel run (see Decisions);
fixed with `testTimeout: 15000`, after which the full run passes with
coverage at default parallelism (31 s) and at `--maxWorkers=2`.

### Amendment 2026-10-13 — required checks and `main` protection (issue #25)

Done after making the repo public (see Decisions for why).

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 17 — red check blocks merge | ⏳ red path ✅, auto-merge path pending | `gh api .../branches/main/protection`: contexts `static-analysis`, `web-export`, `unit`, `integration`; `strict: true`; `enforce_admins: true`; force-push and deletion disabled. Throwaway PR #48 (wrong assertion; `unit` failed, `integration` skipped, run [38448434068](https://github.com/lalanne/cheap/actions/runs/38448434068)): `gh pr merge` refused with "the base branch policy prohibits the merge", state `BLOCKED`; closed unmerged, branch deleted. Green-PR auto-merge: to be confirmed on a real PR. |
