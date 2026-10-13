# 015 — Linting and formatting (ESLint + Prettier + pre-commit hook)

**Status:** approved
**Depends on:** 014 (CI — adds jobs to its workflow and gating), 000 (stack)

## Purpose

The repo has no linter and no formatter (`package.json` has no `lint`
script). Style is consistent today only because one person writes it, and
the things a linter catches that `tsc` doesn't — unused variables,
missing hook dependencies, accidental `console.log`, misused promises —
are caught only by re-reading. This spec makes both mechanical:
violations fail CI and are stopped at commit time, so neither depends on
remembering.

## Decisions

- **ESLint 9, flat config (`eslint.config.js`), built on
  `eslint-config-expo`.** Expo's flat config bundles the TypeScript,
  React, React Hooks and import rules that match this stack
  (Expo SDK 57), and `da2`'s sibling stack would take the same config.
  Rule strictness: Expo's recommended set as **errors**, run with
  `--max-warnings 0`, so there is no "warning" tier to ignore. No
  type-aware rules (`parserOptions.project`) at first — they roughly
  double lint time and `tsc` already runs; revisit if a class of bug
  (floating promises) proves worth it.
- **`eslint-config-prettier` last in the config** so ESLint never
  argues with the formatter; formatting is Prettier's job alone (no
  `eslint-plugin-prettier` — running Prettier through ESLint is slower
  and reports style as lint noise).
- **Prettier 3, `.prettierrc`: `singleQuote: true`, `printWidth: 100`,
  everything else default** (semicolons, trailing commas `all`). Chosen
  from the existing code, not taste: it is already single-quoted with
  semicolons and long lines. Measured against current `main`
  (145 tracked `.ts/.tsx/.js` files): `singleQuote` alone leaves 114
  files non-conforming, `+ printWidth 100` leaves 86, `printWidth 120`
  leaves 70. 100 is the smaller diff against Prettier's 80 default while
  staying readable in a PR view; 120 saves little more.
- **Prettier scope: `ts`, `tsx`, `js`, `json`.** Not `specs/*.md` or
  other Markdown (prose, with hand-wrapped lines and tables — reformatting
  adds churn to documents that are discussed as diffs), not YAML (the
  workflow files are small and carefully commented). `.prettierignore`
  and `eslint.config.js` `ignores` both cover `node_modules`, `coverage`,
  `dist`, `.expo`, `package-lock.json`, `ios/`, `android/` and generated
  files.
- **Scripts:** `lint` (`eslint . --max-warnings 0`), `format`
  (`prettier --write .`), `format:check` (`prettier --check .`).
- **CI: two new jobs, `lint` and `format-check`, parallel peers of
  `static-analysis` and `web-export`.** Each runs checkout, the shared
  setup action, then one command (`npm run lint` / `npm run
  format:check`). `unit` becomes `needs: [static-analysis, web-export,
  lint, format-check]`, so unit tests start only when all four are green
  and a failure in any of them skips `unit` and `integration`.
  Separate jobs mean one push reports every static problem at once (a
  type error no longer hides a lint error), each gets its own named
  status check, and each can be re-run alone. The price is a repeated
  checkout + install per job (~30–60s of runner time each; free on this
  public repo) and a branch-protection change: `lint` and `format-check`
  must be added to the required checks (spec 014, criterion 17) **after**
  PR 3 merges — requiring a check that doesn't exist yet would block
  PR 3 itself. Clean-run wall-clock time is unchanged because the four
  jobs run concurrently. PR 3 amends spec 014 (gating description,
  workflow listing, required-check names) so that spec stays accurate.
- **Pre-commit hook: husky + lint-staged.** `prepare: husky` installs it
  on `npm ci`; `.husky/pre-commit` runs `lint-staged`, which on staged
  files only runs `eslint --max-warnings 0 --fix` then `prettier --write`
  for `ts/tsx/js`, and `prettier --write` for `json`. Staged-only keeps
  it fast; `--fix` / `--write` re-stage the fixed files. It does **not**
  run `tsc` or tests (CI's job; a slow hook gets bypassed).
- **Interaction with the existing branch-guard hook: none, by design.**
  The branch-guard (`core-practices` plugin) is a Claude Code
  `PreToolUse` hook that refuses `git commit`/`git push` to `main` from
  inside a Claude session; husky is a plain git hook that runs for any
  `git commit` in any client. They live in different layers and neither
  disables the other. husky sets `core.hooksPath`, which the plugin does
  not touch (verified at implementation, criterion 9). The hook is
  bypassable with `--no-verify`; **CI is the real gate**, the hook is
  fast feedback.
- **Landing the one-off "format everything" change without noise.**
  Three PRs, in order, so no feature diff is ever mixed with reformatting:
  1. **This spec** (docs only).
  2. **Formatter + the reformat** — adds Prettier, `.prettierrc`,
     `.prettierignore`, the `format` / `format:check` scripts, and the
     single mechanical `prettier --write` commit. Nothing but formatting;
     reviewed by confirming `tsc` and the full test suite are unchanged
     and that re-running `prettier --write` is a no-op (the diff is
     large by nature, not by judgment). CI does not yet enforce
     `format:check`, so it cannot block on its own change.
  3. **ESLint + enforcement** — adds ESLint, fixes (or narrowly disables,
     each with a comment) whatever it reports, adds the CI steps, husky,
     and lint-staged. A rule is never blanket-disabled to get green; an
     exception is a per-line or per-rule-in-config entry with a reason.
     This PR also adds `.git-blame-ignore-revs` listing PR 2's reformat
     commit. Squash-merging means that commit's SHA only exists on `main`
     after PR 2 merges, hence PR 3 and not PR 2; `git config
     blame.ignoreRevsFile .git-blame-ignore-revs` is documented in the
     README (GitHub's blame UI reads the file automatically).
  Other open branches will conflict with PR 2's reformat; merge or rebase
  them first, or run `prettier --write` on them after rebasing.
- **Test-first applies to config too.** There is no meaningful unit test
  for a config file, so the tests are executable checks (see the
  Verification plan): a small Jest test asserts the scripts and config
  exist and that known-bad fixtures are rejected by ESLint and Prettier,
  and the CI / hook criteria are proven by a real red run.
  Fixtures live in `src/__fixtures__/lint/` and are excluded from lint
  and format, so they don't fail the repo's own checks.

## Requirements

`package.json` gains `lint`, `format`, `format:check`, `prepare`, and a
`lint-staged` block; devDependencies `eslint`, `eslint-config-expo`,
`eslint-config-prettier`, `prettier`, `husky`, `lint-staged`.

`.prettierrc`:

```json
{ "singleQuote": true, "printWidth": 100 }
```

`.husky/pre-commit`:

```sh
npx lint-staged
```

`lint-staged` (in `package.json`):

```json
{
  "*.{ts,tsx,js}": ["eslint --max-warnings 0 --fix", "prettier --write"],
  "*.json": ["prettier --write"]
}
```

`ci.yml`:

```yaml
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: npm run lint

  format-check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: npm run format:check

  unit:
    needs: [static-analysis, web-export, lint, format-check]
    # ...unchanged
```

## Acceptance criteria

1. **Given** a clean `main`, **when** `npm run lint` and `npm run
   format:check` run, **then** both exit 0 with no warnings.
2. **Given** a `.ts` file with an ESLint error (e.g. an unused variable,
   or a missing `useEffect` dependency), **when** `npm run lint` runs,
   **then** it exits non-zero and names the file and rule.
3. **Given** a file that is not Prettier-formatted, **when** `npm run
   format:check` runs, **then** it exits non-zero and lists the file;
   **and** `npm run format` fixes it so `format:check` passes.
4. **Given** the formatter config, **then** `.prettierrc` sets
   `singleQuote: true` and `printWidth: 100`, and Markdown, YAML,
   `specs/`, `package-lock.json` and build output are not touched by
   `format` / `format:check`.
5. **Given** ESLint config, **then** Prettier-conflicting style rules are
   off (`eslint-config-prettier`), so a Prettier-formatted file never
   fails lint on style alone.
6. **Given** a PR with a lint violation or an unformatted file, **when**
   CI runs, **then** the `lint` or `format-check` job fails (while the
   other jobs still run to completion), and `unit` and `integration` are
   skipped. A type error plus a lint error in one push shows both
   `static-analysis` and `lint` red.
7. **Given** a staged file with a lint error that `--fix` can't fix,
   **when** `git commit` runs, **then** the pre-commit hook blocks the
   commit and prints the violation.
8. **Given** a staged, unformatted file, **when** `git commit` runs,
   **then** the committed version is formatted, and only staged files
   were processed (unstaged files are untouched).
9. **Given** the branch-guard hook is enabled, **when** a commit is made
   on a feature branch, **then** both the branch-guard and the husky
   hook run without either disabling the other; a fresh `npm ci` installs
   the husky hook.
10. **Given** the formatting PR, **then** its diff contains only
    whitespace/quote/wrapping changes: `tsc --noEmit` and the full unit
    suite give the same results as on `main`, and a second
    `prettier --write` changes nothing.
11. **Given** `.git-blame-ignore-revs` listing the reformat commit,
    **when** `git blame` is run with `blame.ignoreRevsFile` set,
    **then** reformatted lines blame to their last real change.
12. **Given** `specs/README.md`, **then** it lists spec 015 with its
    lifecycle status.
13. **Given** PR 3 has merged, **then** `lint` and `format-check` are
    required status checks on `main` alongside the existing four, and
    spec 014 documents the new gating.

## Out of scope

- **Type-aware ESLint rules** (`no-floating-promises` etc.) — slower; add
  by amendment if a real bug motivates it.
- **Formatting Markdown / YAML.**
- **Running `tsc` or tests in the pre-commit hook** — too slow to keep
  people from bypassing it; CI covers both.
- **Commit-message linting, import sorting plugins** beyond what
  `eslint-config-expo` includes.
- **Editor settings** (`.editorconfig`, `.vscode/`) — personal.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1 — clean main passes | CI run | `lint` and `format-check` green on PR 3. |
| 2 — lint error caught | Unit (script-level) | Jest test runs ESLint's Node API on `src/__fixtures__/lint/bad.ts` and asserts the error ids. |
| 3 — unformatted file caught / fixed | Unit (script-level) | Jest test runs Prettier's `check` / `format` on a fixture. |
| 4 — config values and scope | Unit | Jest test reads `.prettierrc`, `.prettierignore`, `package.json` scripts. |
| 5 — no style conflicts | Unit | Jest test lints a Prettier-formatted fixture with an awkward-but-valid style and asserts zero messages. |
| 6 — CI fails red, skips later jobs | Manual / CI run | Push a throwaway commit with a violation; confirm the step name and skipped jobs; revert. |
| 7, 8 — hook blocks / formats | Manual | Stage a bad file, then an unformatted one, and commit; paste the terminal output into the PR. |
| 9 — hooks coexist | Manual | Commit on a branch with the plugin enabled; fresh clone + `npm ci`, confirm `.git/config` `core.hooksPath`. |
| 10 — reformat is mechanical | Manual / CI run | `tsc` + full suite before/after on PR 2; run `prettier --write` twice and diff. |
| 11 — blame ignore | Manual | `git blame --ignore-revs-file` on a reformatted file. |
| 12 — index entry | Review | `specs/README.md` row. |
| 13 — required checks | Manual | After PR 3 merges, add `lint` and `format-check` to `main`'s required checks; confirm a red `lint` blocks `gh pr merge`. |

## Verification results

*(Filled in as the criteria are checked off.)*

**PR 2 (formatter):** criteria 3, 4, 10.
- 3, 4 — `src/tooling/__tests__/prettier.test.ts` (15 tests), written
  first and failing before `.prettierrc` / `.prettierignore` / scripts existed.
- 10 — reformat commit touches 85 files, all `.ts/.tsx/.js`; `tsc` clean,
  525/525 unit tests before and after; `npm run format` a second time
  changes nothing and `format:check` passes.
