# 016 — CD Pipeline Design (environments, secrets, approvals, rollback)

**Status:** draft
**Depends on:** 004 (iOS deployment), 005 (web deployment), 014 (CI — the
checks that gate `main`)
**Blocks:** #29 (web deploy), #30 (`eas update`), #31 (native build)

## Purpose

Deployments are manual today: `eas update` and `eas build` + `eas submit`
(spec 004), `npx expo export -p web && firebase deploy` (spec 005). That
works for one developer but depends on remembering the steps, on a
logged-in laptop, and on `.env.local` being present. CI (spec 014) now
guarantees what lands on `main` is green, so the next step is making
"merged to `main`" mean "deployed" wherever that is cheap and safe, and
keeping a human in the loop where it is not.

This spec is **design only**: it decides environments, secrets, what
auto-deploys, how to roll back, and how the manual paths are superseded.
The workflows themselves are built by #29, #30 and #31, one spec criterion
at a time.

## Decisions

- **Three GitHub Environments, named for what they gate, not for a
  Firebase stage.** There is one Firebase project
  (`lalanne-cheap-tracker`) and one Hosting site, so there is no real
  "staging" to deploy web to first.

  | Environment | Holds | Reviewers | Branch policy | Used by |
  |---|---|---|---|---|
  | `preview` | `EXPO_TOKEN` | none | `main` only | `eas update` to the `preview` channel (#30) |
  | `production` | Firebase deploy identity | none | `main` only | Hosting live deploy + Firestore rules (#29) |
  | `release` | `EXPO_TOKEN` | required reviewer (the owner) | `main` and `v*` tags | native iOS build + submit (#31) |

  Auto-deploy for `preview` and `production` is deliberate: the web app
  and the OTA channel are cheap to roll back (see Rollback) and `main` is
  already protected by required checks (spec 014). `release` is gated
  because a native build spends the EAS free-tier iOS quota (spec 004
  records it being exhausted) and cannot be rolled back, only superseded.
  *The issue sketched two environments (`preview`, `production`); this
  splits `production` in three because GitHub reviewers are per
  environment, and web/rules must auto-deploy while native must not.*
  The repo is public, so Environments and required reviewers are
  available on the free plan. "Prevent self-review" stays **off** (solo
  repo — the owner is the only possible reviewer).
- **Secrets inventory.** Secrets are scoped to the narrowest environment
  that needs them, never repository-wide.

  | Name | Kind | Environment | Notes |
  |---|---|---|---|
  | `EXPO_TOKEN` | secret | `preview`, `release` | Robot/personal access token for the EAS account. Separate secret entries so each can be rotated independently. |
  | Firebase deploy identity | secret / OIDC | `production` | Preferred: Workload Identity Federation via `google-github-actions/auth` (no long-lived key). Fallback: a service-account JSON key as `FIREBASE_SERVICE_ACCOUNT`. Roles: Firebase Hosting Admin + Firebase Rules Admin only. |
  | `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | **variable** (not secret) | `production` | These are inlined into the public web bundle by design (spec 005), so they are not secrets; storing them as `vars` keeps them readable in logs and diffs. `eas update` reads the same values from the EAS `preview` environment (`--environment preview`, already pushed per spec 004), so they are not duplicated in `preview`. |
  | `GoogleService-Info.plist` | EAS file secret | (EAS, not GitHub) | Already lives in EAS; never enters GitHub. |

  Secrets are only exposed to jobs that declare the matching `environment:`
  and only on `main` (or `v*` for `release`). Workflows triggered by
  `pull_request` — including from forks — get none of them.
- **What auto-deploys on merge to `main`.** One `deploy` workflow,
  triggered by `push` to `main` (not `workflow_run`: branch protection
  already requires the spec 014 checks to be green and up to date before
  merge, so `main` is green by construction):
  1. **Firestore rules**, then 2. **Hosting** (`expo export -p web` then
  deploy) — rules first, so a new client never ships ahead of the rules
  it needs; both under `production`. A rules or Hosting failure fails the
  run; neither is retried automatically.
  3. **`eas update --channel preview`** under `preview`, for JS-only
  changes (OTA, spec 004 Path A). Runs in parallel with 1–2 (independent
  targets).
  Each job has `timeout-minutes`, `permissions` limited to what it needs
  (`id-token: write` only on the Firebase job if using OIDC), and a
  concurrency group per environment with `cancel-in-progress: false`
  (never cancel a half-finished deploy; queue it).
- **What stays gated: native iOS builds.** `eas build --profile preview
  --platform ios --non-interactive --auto-submit` (#31) runs only from
  `workflow_dispatch` or a `v*` tag, and only after approval on the
  `release` environment. Never on every merge (quota, spec 004). The
  `app.json` `ios.buildNumber` bump remains a **manual, committed**
  change before dispatch (lesson recorded in spec 004: Apple rejects a
  duplicate build number); the workflow fails fast if the number matches
  the latest submitted build rather than auto-incrementing it. Deciding
  whether tags should drive the number is deferred to spec 017.
- **PR preview channels (#29).** Same-repo PRs may deploy to a Firebase
  Hosting preview channel (`pr-<number>`, 7-day expiry) and comment the
  URL. This needs the Firebase identity, so it is limited to PRs from
  branches of this repo, never forks, and uses a separate service
  account scoped to Hosting only (no Rules Admin). Whether it is worth it
  for a solo project is left to #29; this spec only fixes the security
  boundary.
- **Rollback.**
  - *Web Hosting:* Firebase Console → Hosting → "Roll back" to a prior
    release (instant, no rebuild). CLI alternative: `firebase
    hosting:clone <site>:<version-id> <site>:live`. (The issue named
    `firebase hosting:rollback`; verify that command exists in the pinned
    CLI before documenting it — do not assume.) Because `index.html` is
    served `no-cache` (spec 005), clients pick it up immediately.
  - *Firestore rules:* re-run the deploy workflow via `workflow_dispatch`
    with `ref` set to the last good commit (the workflow checks out the
    given ref); the rules file is versioned in git so git is the source of
    truth.
  - *OTA update:* `eas update:rollback`, or `eas update:republish --group
    <previous-group-id> --branch preview`. Takes effect on the next
    launch-pair on devices (spec 004).
  - *Native build:* not reversible. Fix forward with an OTA update if the
    bug is JS-only, otherwise a new build with a bumped number; expire the
    bad build in TestFlight.
  Each rollback is runnable by the owner from a clean checkout without
  `.env.local`.
- **Supersedes the manual paths, does not delete them.** Spec 004 Paths A/B
  and spec 005's deploy command become the **break-glass fallback** for
  when Actions is down or a secret is mid-rotation. Once #29–#31 are
  implemented, those specs gain a short pointer to this one; their content
  is otherwise left as the historical record of how the manual path works.
- **Pinning and hardening.** Third-party actions in deploy workflows are
  pinned by commit SHA from the start (their blast radius includes
  production credentials). Broader supply-chain work (Dependabot, CodeQL,
  release automation) stays in spec 017.
- **Settings live in GitHub, not the repo.** Like spec 014's branch
  protection, environments, reviewers and secrets cannot be code-reviewed.
  Their intended configuration is recorded here; Verification results
  records the date they were actually set.

## Firebase identity setup (Workload Identity Federation)

One-time, run by the owner with `gcloud` authenticated as a project owner.
Nothing here is stored in GitHub except the two non-secret values printed
at the end. Names (`github-pool`, `github-provider`, `gh-deployer`) are
this spec's choice; change them consistently if needed.

```sh
PROJECT_ID=lalanne-cheap-tracker
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
REPO=lalanne/cheap
SA=gh-deployer@${PROJECT_ID}.iam.gserviceaccount.com

# 1. APIs the federation and the Firebase CLI need
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com cloudresourcemanager.googleapis.com \
  firebasehosting.googleapis.com firebaserules.googleapis.com \
  --project "$PROJECT_ID"

# 2. The deploy service account, with only the roles it needs
gcloud iam service-accounts create gh-deployer \
  --project "$PROJECT_ID" --display-name "GitHub Actions deployer"
for ROLE in roles/firebasehosting.admin roles/firebaserules.admin \
            roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:$SA" --role "$ROLE" --condition=None
done

# 3. Workload identity pool + GitHub OIDC provider. The attribute
#    condition is the real security boundary: only this repo, and only
#    jobs running under the `production` environment, are accepted.
gcloud iam workload-identity-pools create github-pool \
  --project "$PROJECT_ID" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project "$PROJECT_ID" --location global \
  --workload-identity-pool github-pool \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment" \
  --attribute-condition "assertion.repository == '${REPO}' && assertion.environment == 'production'"

# 4. Let identities from that pool impersonate the service account
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project "$PROJECT_ID" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO}"

# 5. Print the two values the workflow needs (not secrets; store as
#    `vars` on the `production` environment)
echo "WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "WIF_SERVICE_ACCOUNT=${SA}"
```

Workflow side (in #29): the Firebase job declares `environment:
production` and `permissions: { id-token: write, contents: read }`, then:

```yaml
- uses: google-github-actions/auth@<sha>
  with:
    workload_identity_provider: ${{ vars.WIF_PROVIDER }}
    service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}
- run: npx firebase-tools deploy --only firestore:rules,hosting --project lalanne-cheap-tracker
```

Notes:
- `assertion.environment` exists only for jobs that declare an
  `environment:`, so a PR or a job without one is rejected by the
  condition even though the repo matches.
- The role list is the expected minimum, not a verified one. The first
  deploy may reveal a missing permission; add the narrowest role that
  fixes it and update this list rather than granting `firebase.admin`.
- The PR-preview service account (Decisions) is a second, Hosting-only
  account with its own provider condition (`assertion.event_name ==
  'pull_request'`), created only if #29 builds preview channels.
- Teardown/rotation: nothing to rotate. To revoke, delete the provider
  or remove the `workloadIdentityUser` binding.
- If this setup stalls, the fallback is a service-account key stored as
  `FIREBASE_SERVICE_ACCOUNT` on `production` (open question 1).

## Open questions (resolve by editing this spec)

1. Firebase auth: Workload Identity Federation (more setup, no stored key)
   or a service-account key (simple, long-lived secret)? Recommendation:
   WIF; fall back to a key only if setup stalls.
2. Is a separate `release` environment acceptable, versus the issue's
   two-environment sketch?
3. Should Firestore rules deploy be gated (it is the one auto-deploy that
   can lock users out or open data)? Recommendation: auto-deploy, because
   the rules suite already gates the merge (spec 014 `integration`), and
   rollback is a redeploy.
4. PR preview channels: build them (#29) or skip for a solo repo?

## Requirements

- No workflow files are added by this spec. The
  implementing issues add `.github/workflows/deploy.yml` (#29, #30) and
  `.github/workflows/ios-release.yml` (#31).
- GitHub Environments `preview`, `production`, `release` created with the
  branch policies, reviewers and secrets/vars in Decisions.
- A short `docs/` or README section ("Deploying") listing the automatic
  paths, the gated path, and the rollback commands above — written when
  the first implementing issue lands, so it describes real behavior.

## Acceptance criteria

1. **Given** the repo settings, **then** environments `preview`,
   `production` and `release` exist; `preview` and `production` restrict
   deployment to `main`; `release` requires a reviewer and allows only
   `main` and `v*` tags.
2. **Given** the secrets inventory, **then** `EXPO_TOKEN` and the Firebase
   identity exist only as environment secrets (none at repository level),
   and `EXPO_PUBLIC_*` values are environment variables, not secrets.
3. **Given** a PR (same-repo or from a fork), **when** its workflows run,
   **then** no deploy secret is available to any job.
4. **Given** a merge to `main` touching web code or `firestore.rules`,
   **when** the deploy workflow runs, **then** rules deploy before Hosting
   and the live site serves the new build.
5. **Given** a merge to `main`, **when** the deploy workflow runs, **then**
   an `eas update` is published to the `preview` channel and an installed
   TestFlight build picks it up after two launches (spec 004 criterion 1).
6. **Given** a merge to `main`, **then** no native iOS build is started.
7. **Given** a manual dispatch (or `v*` tag) of the iOS workflow, **when**
   the `release` environment has not been approved, **then** no build is
   queued; **after** approval, a build is submitted to TestFlight.
8. **Given** a bad web release, **when** the documented Hosting rollback
   is run, **then** the previous release serves again with no rebuild.
9. **Given** a bad rules deploy, **when** the deploy workflow is dispatched
   at the previous good ref, **then** that ruleset is live again.
10. **Given** a bad OTA update, **when** the documented EAS rollback is
    run, **then** devices return to the previous update.
11. **Given** specs 004 and 005, **then** each states that the manual path
    is the fallback and points to this spec.

## Out of scope

- The workflows themselves — #29, #30, #31.
- Release tagging/versioning automation, Dependabot, CodeQL, secret
  scanning — spec 017 (#32).
- Android builds/submission (not yet targeted, spec 004).
- A separate Firebase staging project. Revisit if rules or data changes
  become risky enough to need one.
- Custom domains, Sign in with Apple / external TestFlight (spec 004).

## Verification plan

Design spec: criteria are mostly checks of GitHub/Firebase configuration
and are proven by the implementing issues, not by new unit tests.

| Criterion | Layer | How |
|---|---|---|
| 1, 2 | Manual | `gh api repos/lalanne/cheap/environments` and the secrets/variables listings; record output in Verification results. |
| 3 | Manual | Open a same-repo PR and a fork-style (`pull_request`) run; confirm a step printing `${{ secrets.EXPO_TOKEN != '' }}` is false (use a throwaway workflow, then delete it). |
| 4, 5, 6 | Acceptance (workflow run) | First `main` merge after #29/#30 land: inspect run, job order and the live site/channel. |
| 7 | Manual | Dispatch the iOS workflow; confirm it waits on approval. |
| 8, 9, 10 | Manual drill | Run each rollback once on a harmless change and record the command and result. A rollback never rehearsed is not documented, it is hoped. |
| 11 | Review | Diff of specs 004 and 005. |

A workflow-lint check (`actionlint`) on the deploy workflows is added in
the implementing issues if it is not already part of spec 014's jobs.

## Verification results

*(Not yet implemented.)*
