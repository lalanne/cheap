# 001 — Authentication (Google + Email/Password)

**Status:** approved
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

## Out of scope

- Sign in with Apple (only required once distributing on iOS via the App
  Store with third-party login offered — revisit at that point).
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

**Manual, real device, before shipping:** Google sign-in end-to-end;
email/password sign-up → verification email arrives → click it → "I've
verified" → reaches main app; sign out and back in; trigger and receive a
password reset email.
