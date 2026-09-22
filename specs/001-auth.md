# 001 — Authentication (Google + Email/Password)

**Status:** approved (criterion 12 added, pending native implementation —
see Verification results)
**Depends on:** 000

## User stories

- As a user, I sign in with my existing Google account so I don't have to
  create yet another password.
- As a user without a Google account, I create an account with my email and
  a password of my choice.
- As a returning user, I open the app and I'm already signed in.
- As a user who signed up with email/password, I confirm my email address
  before using the app.
- As a user who forgot their password, I reset it via an emailed link.
- As a user, I can sign out.

## Requirements

Unlike `da2` (which shipped Google first, added email/password later as
spec 014), this app ships **both methods from v1** — there's no household
routing to stage around, so there's no reason to sequence them.

### Provider architecture

- `AuthProvider` interface for Google Sign-In — parameterless `signIn()`.
- A sibling `EmailAuthProvider` interface for the credential-based flow:
  ```ts
  interface EmailAuthProvider {
    signUp(name: string, email: string, password: string): Promise<AuthUser>;
    signIn(email: string, password: string): Promise<AuthUser>;
    sendPasswordReset(email: string): Promise<void>;
    resendVerificationEmail(): Promise<void>;
    reloadCurrentUser(): Promise<AuthUser | null>;
  }
  ```
- Both implemented per-platform: native (`@react-native-firebase/auth`) +
  web (`firebase` web SDK), same pattern as `da2`.
- One underlying Firebase Auth instance/store regardless of method — a
  single `onAuthStateChanged` drives `user` state either way.
- `AuthUser` includes `emailVerified: boolean`. Google sign-ins always come
  back `emailVerified: true`.

### Native provider implementation (iOS)

Deferred at first implementation (web-only), now being built ahead of a
TestFlight deploy — see `specs/004-ios-deployment.md`.

- **Both providers move to `@react-native-firebase/auth` on native, not
  just Google.** Google Sign-In specifically cannot work via the web JS
  SDK on native (`signInWithPopup` needs a DOM), so native needs its own
  implementation regardless — but email/password's web-SDK calls *do*
  technically run on React Native. The reason to move both anyway: native
  Google Sign-In goes through `@react-native-google-signin/google-signin`
  → `@react-native-firebase/auth`'s `signInWithCredential`, a completely
  separate Auth instance from the JS SDK's `firebase/auth`. If email/password
  stayed on the JS SDK while Google moved to RNFirebase, the two methods
  would maintain independent sessions that don't see each other —
  `authStore`'s single `onAuthStateChanged` (registered against one or the
  other) would miss sign-ins from whichever provider it isn't watching,
  silently breaking the "one instance, one listener" invariant this spec
  already committed to. Splitting by platform (native vs. web), not by
  provider (Google vs. email), is what keeps that invariant intact.
- File layout follows Metro's platform-extension resolution, matching
  `da2`: `emailAuthProvider.ts` (web, existing) +
  `emailAuthProvider.native.ts`; `googleAuthProvider.ts` (web, existing) +
  `googleAuthProvider.native.ts`; same for `firebaseApp` →
  `firebaseApp.native.ts` initializing `@react-native-firebase/app`
  instead of the JS SDK.
- Requires: an iOS app registered in the `lalanne-cheap-tracker` Firebase
  project (currently only a Web app exists) → produces
  `GoogleService-Info.plist`, gitignored like `da2`'s. The
  `@react-native-google-signin/google-signin` Expo config plugin handles
  the URL scheme registration (`REVERSED_CLIENT_ID`) — no manual
  `Info.plist` editing.
- Requires a custom dev client (`expo-dev-client`) — these are native
  modules, so this no longer runs in plain Expo Go. Building and running
  it is spec 004's concern.

### Sign-up / sign-in screen

- One screen with a Google button plus a secondary "Continue with email"
  action, which reveals a mode toggle: **Create account** / **Sign in**.
- Sign-up fields: name, email, password (all required). Password minimum
  8 characters, checked client-side.
- On sign-up success: account created and signed in immediately
  (`emailVerified: false`), verification email sent right away, a
  `users/{uid}` profile document created (name, email, photo — `null` for
  email/password signups).
- `auth/email-already-in-use` shows a specific message pointing at "Sign in"
  or "Continue with Google" instead of the generic error.
- Wrong password / unknown email map to one combined "incorrect email or
  password" message — never reveal which one was wrong.
- "Forgot password?" (sign-in mode only): email field, submit triggers
  `sendPasswordReset`. Always shows the same confirmation regardless of
  whether the account exists — no email-enumeration oracle.

### Email verification gate

- Signed in but `!user.emailVerified` → a `VerifyEmailScreen`, shown before
  the main app. Content: the address, "Resend email", "I've verified"
  (calls `reloadCurrentUser`, proceeds once true), "Sign out" escape hatch.
- In practice only ever gates email/password sign-ups — Google accounts
  arrive pre-verified.

### Firestore rules

- A `signedIn()` helper requires both `request.auth != null` and
  `request.auth.token.email_verified == true`; every collection's rules
  (spec 002's `transactions`/`categories` included) gate on it.

## Data model

```
users/{uid}
  displayName: string | null
  email: string
  photoUrl: string | null
  createdAt: timestamp
```

## Acceptance criteria

1. **Given** the sign-in screen, **when** a user taps "Continue with
   Google" and completes the flow, **then** they land on the main app and a
   `users/{uid}` document exists.
2. **Given** the sign-in screen, **when** a user chooses "Create account"
   and submits a valid name/email/8+-char password, **then** the account is
   created, a verification email is sent, and they land on
   `VerifyEmailScreen` — not the main app.
3. **Given** an unverified account, **then** they cannot reach transaction
   data — client routing shows `VerifyEmailScreen`, and a direct Firestore
   read/write attempt is denied by rules regardless of UI.
4. **Given** `VerifyEmailScreen`, **when** the user clicks the emailed link
   and taps "I've verified", **then** they proceed to the main app.
5. **Given** valid email/password credentials for an existing, verified
   account, **when** they submit "Sign in", **then** they land on the main
   app exactly as a Google sign-in would.
6. **Given** a wrong password or unregistered email, **then** one generic
   "incorrect email or password" message is shown.
7. **Given** "Forgot password?" with any email typed in, **then** the same
   confirmation message is shown whether or not that email has an account,
   and a real account receives a reset email.
8. **Given** a sign-up with an email that already has an account (Google or
   email/password), **then** a specific "account already exists" message is
   shown.
9. **Given** a signed-in user, **when** they force-close and reopen the
   app, **then** they're still signed in.
10. **Given** a signed-in user, **when** they tap "Sign out", **then** they
    return to the sign-in screen and their data is no longer readable.
11. Firestore security rules reject all reads/writes from unauthenticated
    or unverified clients.
12. **Given** the sign-in screen on a native iOS build, **when** a user taps
    "Continue with Google" and completes the native account picker,
    **then** they land on the main app and a `users/{uid}` document exists
    — the same outcome as criterion 1, on the native platform.

## Out of scope

- Sign in with Apple (only required once distributing on iOS via the App
  Store with third-party login offered — see `specs/004-ios-deployment.md`
  for exactly when that requirement kicks in).
- Linking an email/password credential to an existing Google account.
- Multi-factor auth, passwordless (magic link) sign-in.
- Changing password/email from within the app (only signed-out "forgot
  password" reset is in scope).

## Verification plan

Test infrastructure is set up as part of this spec (it's the first one) and
reused by every later spec: Jest + `jest-expo` + React Native Testing
Library for unit/component tests; the Firebase Emulator Suite +
`@firebase/rules-unit-testing` for security-rules integration tests. No E2E
tool is introduced here — the real Google account picker is native OS UI
that's impractical to automate, so criteria involving it are proven
manually on a real device instead; an E2E harness gets built later only if
a future spec's flow genuinely needs one (see `CLAUDE.md`).

Per the test-first rule: for each row below, the test is written and
confirmed failing before the corresponding implementation code is written.

| # | Criterion | Layer | How |
|---|-----------|-------|-----|
| 1 | Google sign-in creates profile, lands on main | Manual | Real device: Google flow once per release (impractical to automate). |
| 2 | Email sign-up creates account, sends verification, shows `VerifyEmailScreen` | Unit + component | Store: sign-up → verification-email → gated state (mocked provider). `EmailAuthScreen`/`VerifyEmailScreen` component tests. |
| 3 | Unverified user blocked from data (client + rules) | Unit + integration | Routing test: unverified state renders `VerifyEmailScreen`. Rules (emulator): unverified-but-authed context denied on `users/*`. |
| 4 | "I've verified" proceeds once actually verified | Unit | `reloadCurrentUser`/store test: stays gated until `emailVerified` flips true. |
| 5 | Email sign-in lands on main like Google would | Unit | Store: both providers converge on the same `user` state shape and routing decision. |
| 6 | Wrong password / unknown email → one generic message | Unit | `mapAuthError`: both error codes collapse to the same message. |
| 7 | Forgot password → same confirmation regardless of account existence | Unit | Provider test: `sendPasswordReset` UI path shows identical confirmation whether or not `auth/user-not-found` is thrown. |
| 8 | Sign-up on an existing email → specific message | Unit | `mapAuthError`: `email-already-in-use` maps to its own message. |
| 9 | Session persists across app restart | Manual | Real device: force-close, reopen, still signed in (native persistence is Firebase-default behavior, not app logic — not worth a mocked test). |
| 10 | Sign-out returns to sign-in, data unreadable | Unit + integration | Store: sign-out clears state. Rules: signed-out context denied on `users/*`. |
| 11 | Rules reject unauthenticated/unverified everywhere | Integration | Rules suite: unauthenticated and unverified-but-authed contexts denied on `users/*`; extended to `transactions/*` once spec 002 lands. |
| 12 | Native Google sign-in creates profile, lands on main | Unit + Manual | Unit: mocked-SDK test asserting the exact call shape — `GoogleSignin.signIn()` → `auth().signInWithCredential(GoogleAuthProvider.credential(idToken))` — matching `da2`'s pattern for this exact bug class. Manual: real device/simulator, same reasoning as criterion 1 (native picker can't be automated). |

**Manual, real device, before shipping:** Google sign-in end-to-end;
email/password sign-up → verification email arrives → click it → "I've
verified" → reaches main app; sign out and back in; trigger and receive a
password reset email.

## Verification results

All automated rows pass: 43 unit/component tests (`npx jest`) and 5
Firestore rules tests against the local emulator (`npm run test:rules`,
`demo-cheap`, no real project needed). `tsc --noEmit` is clean; `npx expo
export -p web` builds.

**Real Firebase project provisioned (2026-09-17):** `lalanne-cheap-tracker`
(project IDs are globally unique — `cheap-tracker` was already taken by
someone else). Web app registered, config written to `.env.local`
(gitignored, matching `da2`'s credential-file convention).
`firestore.rules` deployed to the real project
(`firebase deploy --only firestore:rules`). Email/Password and Google
sign-in enabled in the console — no CLI command exists for this
(`firebase-tools` has no `auth:providers` equivalent), so it's a genuine
manual step, done by the user.

**Live smoke test against production** (not the emulator): a throwaway
account was created with `createUserWithEmailAndPassword` against the real
project, `sendEmailVerification` dispatched without error, a direct
Firestore write to `users/{uid}` while unverified was **denied by the
deployed rules** (`permission-denied`) — the same result the emulator
suite predicted, now confirmed against the real backend — then signed out,
signed back in with the same credentials, and the account deleted. No
residue left in production Auth or Firestore.

**Remaining gaps — still not silently skipped:**
- **Native Google Sign-In is not built** — `googleAuthProvider.ts` is
  web-only (`signInWithPopup` needs a DOM). Native needs
  `@react-native-google-signin/google-signin` +
  `@react-native-firebase/auth`, matching `da2`, plus a dev client build —
  out of scope until this project is ready for native builds.
- **Criterion 1 (real Google sign-in flow) is untested** — the popup flow
  itself needs a real browser click, which the smoke test script can't
  drive. Only the email/password path was exercised live.
- **Criterion 9 (session persists across app restart) is untested** — needs
  a real device/browser restart, not a one-shot script.
- I could not visually click through the running app — no browser
  automation tool was available in this environment. The dev server was
  confirmed to serve the bundle (HTTP 200) and the live smoke test proves
  the backend logic works, but the actual UI was never eyeballed.

Staying at `implemented`, not `verified`, until criteria 1 and 9 are
actually checked on a real browser/device — per this repo's own rule that
`verified` means checked against the running app, manual rows included,
not just automated ones.

**Amendment (2026-09-17):** added the Native provider implementation
section and criterion 12 ahead of a TestFlight deploy (spec 004). Status
reverted to `approved` — the web-only work above still stands, but the
spec as a whole isn't `implemented` again until criterion 12's unit test
passes too.

**Amendment (2026-09-21): Google sign-in on web switched from
`signInWithPopup` to `signInWithRedirect`.** Real bug hit on the first
actual browser sign-in after spec 005's web deploy went live: in Safari,
Google sign-in via the popup flow let the user reach the signed-in
transactions screen normally, but every subsequent Firestore
read/write was rejected with `"Missing or insufficient permissions"` —
even though the account was confirmed genuinely email-verified
server-side (`firebase auth:export`) and the deployed
`firestore.rules` were confirmed correct and current (redeployed,
compiled clean). Root cause, by elimination rather than a captured
error message (no browser-automation tool was available to inspect
Safari's console directly): Safari's storage-partitioning restrictions
on third-party popup origins (`accounts.google.com`) are a documented
cause of exactly this shape of failure — the popup's own sign-in
handshake completes, but the resulting session/token doesn't reliably
carry over to the main app's origin for later authenticated requests.
Fixed by switching `googleAuthProvider.web.ts` to
`signInWithRedirect` — Firebase's own documented recommendation for
Safari compatibility — which avoids the popup/third-party-origin
problem entirely. `AuthProvider.signIn()`'s resolved value was already
unused by every caller (`authStore.signInWithGoogle` only awaits it for
its side effect / thrown errors), so the interface didn't need to
change; the redirect flow's actual sign-in completion happens through
the same `onAuthStateChanged` listener the app already relies on, once
the browser navigates back after the Google account picker.

**Known gap, not yet addressed:** no explicit `getRedirectResult(auth)`
call exists to surface a redirect-specific error (e.g. the user closing
the Google account picker, or an OAuth error) — `onAuthStateChanged`
fires correctly on the happy path without it, but a failed redirect
currently fails silently back to the sign-in screen with no error
message, unlike the popup flow's `auth/sign-in-cancelled` handling.
Worth adding if this turns out to matter in practice.
