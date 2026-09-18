# 004 — iOS Deployment (TestFlight)

**Status:** implemented (build + submit succeeded; device verification pending — see Verification results)
**Depends on:** 001 (native Google Sign-In, criterion 12)

## Purpose

Get `cheap` onto a real iPhone via TestFlight. Unlike `da2`'s two-parent
pilot household, this is a single-developer, single-tester deploy — same
underlying EAS Build/Submit pipeline, much smaller blast radius.

## Decisions

- **Apple Developer Program:** team `XS3AAHNCSL`, Apple ID
  `lalanne.c@icloud.com` — chosen explicitly (this machine also has
  identities for a work Apple ID and a separate free personal team; using
  the wrong one would scatter App Store Connect resources across accounts,
  same class of mistake `da2`'s `CLAUDE.md` documents for GitHub remotes).
- **iOS delivery: TestFlight, Internal Testing** to start. Internal testing
  skips Apple's Beta App Review entirely, so App Store Guideline 4.8 (Sign
  in with Apple, required once third-party login is offered) does **not**
  apply yet. It becomes required the moment this goes to **External**
  testers or the public App Store — revisit spec 001's "out of scope" line
  at that point, not before.
- **Bundle identifier:** `com.lalanne.cheap` (already set in `app.json`).
- Managed workflow via EAS Build + EAS Submit, not a manually-maintained
  `ios/` project.

## Two deployment paths

(`da2`'s spec 006 has a third path for its web hosting deploy — not
needed here, nothing web-facing is being deployed by this spec.)

### Path A — OTA update (JS/TS-only changes)

```
npm test && eas update --channel preview --message "<description>"
```

### Path B — New binary (this first build, and any future native module addition)

```
eas build --profile preview --platform ios
eas submit --platform ios --profile preview --latest
```

## Requirements

- `eas.json` with at least a `development` profile (dev client, for
  simulator/device local iteration) and a `preview` profile
  (`ios.distribution: "store"` — required for TestFlight).
- `app.json` config plugins, in the exact combination `da2` had to
  discover the hard way (documented in its spec 006) — reused here to skip
  that trial-and-error entirely:
  - `["@react-native-firebase/app", { "ios": { "disableSPM": true } }]` —
    without this, `pod install` fails with `SPM + static linkage is not
    supported`, because RNFB's Swift Package Manager resolution and static
    pod linkage collide (duplicate Firebase symbols).
  - `["expo-build-properties", { "ios": { "useFrameworks": "static" } }]`
    — needed once SPM is disabled, because the Firebase Swift pods
    (`FirebaseAuth`, `FirebaseFirestore`) require module maps that only a
    static-**framework** build generates; a plain static-library build
    fails with "does not define modules."
  - `@react-native-google-signin/google-signin` — its config plugin reads
    `GoogleService-Info.plist` and appends the `REVERSED_CLIENT_ID` as the
    iOS URL scheme automatically; no manual `Info.plist` editing.
  - `expo-dev-client` — required once native modules are added; plain
    Expo Go can no longer run this app after this spec.
- An iOS app registered in the `lalanne-cheap-tracker` Firebase project
  (bundle ID `com.lalanne.cheap`) → `GoogleService-Info.plist`, gitignored
  like `google-services.json` already is.
- `ios.config.usesNonExemptEncryption: false` (standard HTTPS/TLS only via
  Firebase, no custom cryptography) — otherwise TestFlight asks about
  export compliance on every single build.
- `runtimeVersion` policy **`appVersion`**, not `fingerprint` — `da2` hit
  exactly the failure mode `fingerprint` causes: it hashes native deps
  locally and remotely and requires an exact match, but
  `GoogleService-Info.plist` reaches the build differently in each place
  (local file vs. a materialized EAS secret), so the hashes never agreed
  and every build failed at "Configure expo-updates." `appVersion` has no
  such comparison.
- `ios.buildNumber` bumped manually on every native release — no
  `autoIncrement` — matching `da2`'s deliberate-bump convention (which
  caught a real bug: a build shipped with an unbumped `versionCode` that
  phones silently ignored as "not an update").
- The app shows its version somewhere reachable (a small text stamp is
  enough — not a full settings screen) so a real device can confirm which
  build/update it's running.
- EAS project linked (`eas init`) — populates `app.json`'s
  `extra.eas.projectId`.

## Acceptance criteria

1. **Given** a merged JS-only change, **when** `eas update --channel
   preview` runs, **then** the test iPhone runs the new code after two
   app launches (download, then apply), and the version stamp reflects it.
2. **Given** the first native build, **when** `eas build --profile preview
   --platform ios` completes and `eas submit` uploads it, **then** the app
   is installable via TestFlight on the tester's iPhone.
3. **Given** the installed TestFlight build, **when** the tester signs in
   with Google, **then** spec 001's criterion 12 passes on a real device —
   not just the mocked-SDK unit test.
4. **Given** the installed TestFlight build, **when** the tester runs the
   full email/password flow (sign-up → verify → sign in → sign out), **then**
   spec 001's criteria 2, 4, 5, 9, 10 pass on a real device — closing the
   "manual, real device" gaps spec 001's Verification results have carried
   since it was first implemented.

## Out of scope

- Android deployment — not asked for yet; the same EAS profiles extend to
  it later without rework.
- Web hosting deploy — separate from EAS entirely (see `da2`'s Path C for
  the pattern, when `cheap` needs it).
- External TestFlight testers or public App Store release — both require
  Sign in with Apple first (Guideline 4.8).
- Auto-incrementing build/version numbers.

## Verification plan

Every criterion here is inherently a real-device check — that's the
nature of a deployment spec, not a gap to apologize for. Kept as a table
for consistency with every other spec:

| Criterion | Layer | How |
|---|---|---|
| 1 | Manual | Confirm the version stamp updates on the test iPhone after two launches following an OTA update. |
| 2 | Manual | TestFlight install completes without error; app opens. |
| 3, 4 | Manual | Run spec 001's real-device checklist (already written in its Verification plan) on this TestFlight build. |

## Verification results

**Build + submit succeeded (2026-09-18).** Build
`abb7d7d8-18cd-4ce0-b392-6026362d9573` (`0.1.0 (1)`) completed on EAS and
was submitted to App Store Connect. It shows up in TestFlight under an
internal testing group ("Team (Expo)"), status "Ready to Submit" (that
label is about *external* Beta Review, not required for internal testers)
— criterion 2 is functionally satisfied; installing it on the actual
tester's phone is the one step left to fully close it out.

**Three real, non-obvious failures hit and fixed on the way — recorded so
they aren't rediscovered:**

1. **`pod install` worked on the first try** — reusing `da2`'s exact
   `disableSPM: true` + `useFrameworks: "static"` recipe from its own
   spec 006 paid off immediately; da2 itself needed three attempts to
   find that combination.
2. **EAS Build's project archive is git-based, not working-directory-based.**
   Two build attempts failed identically even after local fixes, because
   the fixes were never committed — the build's own "Git ref" field
   matched the last commit, not the dirty working tree. Lesson: commit
   before every `eas build`, not just before pushing.
3. **`npm ci` on EAS failed with "Missing: typescript@5.9.3 from lock
   file" — even after `npm install` locally and committing the result.**
   Root cause: this machine's npm (11.19.1) resolves
   `@expo/prebuild-config`'s nested `typescript@5.9.3` dependency
   differently than EAS's builder npm (10.9.8) — npm 11 deduped it away
   entirely, so it was never written to the lock file, and npm 10.9.8's
   stricter `npm ci` sync check rejected the mismatch. Fixed by
   regenerating `package-lock.json` with `npx -y npm@10.9.8 install`
   instead of the system's own npm. Worth remembering for any future
   lock-file regeneration on this project: match EAS's npm version, not
   whatever's newest locally.

**Also found:** decoding EAS's raw build-log artifacts (the signed GCS
URLs from `eas build:view --json`'s `logFiles` field) directly wasn't
possible — the content isn't plain text, gzip, or raw deflate; whatever
format it is, only the expo.dev web UI renders it. The reliable path to a
failed build's actual phase output is the web UI, not the CLI or the raw
log artifact. Same story for *submissions* specifically: `--verbose-fastlane`
only affects local submits (`eas submit` has no `--local` flag at all,
unlike `build`), so a cloud submission's actual Apple/ITMS error is only
visible on the web UI's submission detail page — the CLI's own
`submit:view`/`submit:list --json` carry no error text for an `ERRORED`
submission, just the terminal status.

**Second app icon build (2026-09-18) hit exactly the mistake this spec's
own Requirements section already warned about** — proof the warning alone
isn't enough, only doing the thing is: rebuilt for the app icon without
bumping `ios.buildNumber`, so the second binary was still stamped `1`.
Apple's submission rejected it outright: `"Build number 1 for app version
0.1.0 has already been used. App Store Connect requires unique build
numbers within each app version."` Fixed by setting `ios.buildNumber: "2"`
in `app.json`, rebuilding, and resubmitting — **build 2 uploaded
successfully** and is now in Apple's processing queue. Worth genuinely
internalizing this time: bump the build number *before* running `eas
build`, every single native release, no exceptions — not just something
written down and then skipped under time pressure.

**Still open:**
- Criterion 1 (OTA update) — not exercised yet; needs a JS-only change
  pushed via `eas update --channel preview` after the build is installed.
- Criteria 2 (full install), 3 (native Google sign-in), 4 (email/password
  flow) — need the tester to actually accept the TestFlight invite,
  install build 2, and run through spec 001's real-device checklist.
