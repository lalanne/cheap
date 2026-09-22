# 005 — Web Deployment (Firebase Hosting)

**Status:** implemented (deployed; sign-in/data verification pending — see Verification results)
**Depends on:** 001, 002 (the web-platform code this deploys already
exists — every native-only file already has a `.web.ts`/`.web.tsx` twin,
built in from the start rather than added later)

## Purpose

Get `cheap`'s web build hosted somewhere real, so it can be opened from
any browser instead of only `localhost`. This is infrastructure, not new
product code — same category as spec 004 (iOS deployment), scoped the
same way: deploy what already exists and passes tests, nothing new.

## Decisions

- **Firebase Hosting**, same project (`lalanne-cheap-tracker`) as
  Firestore/Auth already use — no new project, no CORS configuration, no
  separate billing surface. Matches `da2`'s spec 011 choice for the same
  reasons.
- **Static export**, not a server. `npx expo export -p web` produces a
  static `dist/` bundle (already verified: 283 modules, 1.4MB JS bundle,
  builds clean). No SSR, no API routes — this app has no backend beyond
  Firebase itself.
- **Default `*.web.app` URL** for now — no custom domain. Adding one later
  is a Firebase Hosting console step, not a code change (same as `da2`).
- **No new Firebase Web App registration needed.** Unlike `da2` (which
  added web after native shipped, spec 011), `cheap`'s web Firebase config
  (`EXPO_PUBLIC_FIREBASE_*` env vars, `src/transactions/providers/
  firestoreDb.ts`, `googleAuthProvider.web.ts`, `emailAuthProvider.web.ts`)
  was built from day one and already works — confirmed via the existing
  test suite and a successful `expo export -p web`. This spec only adds
  the *hosting* piece on top.

## Requirements

- `firebase.json` gains a `hosting` block: `public: "dist"`, SPA rewrite
  (`"source": "**", "destination": "/index.html"`) so client-side routing
  (sign-in vs. transactions screen, driven by auth state, not a router)
  still resolves on a hard refresh.
- A `.firebaserc` pinning the default project to `lalanne-cheap-tracker`
  (doesn't exist yet — `firebase.json` alone has no project association).
- Deploy command: `npx expo export -p web && firebase deploy --only hosting`.
- No Firestore/Storage rules changes — the same rules already evaluate
  `request.auth` regardless of which SDK (native or web) wrote the
  request.
- No changes to `eas.json` or the native build profiles — wholly separate
  from the EAS pipeline in spec 004.

## Acceptance criteria

1. **Given** a browser at the Hosting URL, **when** someone signs in with
   Google or email/password, **then** they land on the same transactions
   screen the native app shows for that account, with the same data.
2. **Given** a signed-in session on web, **when** a transaction is
   added/edited/deleted, **then** it persists to the same
   `users/{uid}/transactions` Firestore path the native app reads —
   confirmed by seeing it appear on a native build signed into the same
   account without any code change.
3. **Given** a hard refresh (or a direct link) on any in-app state, **then**
   the SPA rewrite serves `index.html` and the app reloads correctly
   rather than a Hosting 404.
4. **Given** the change set, **then** no Firestore rule changed and `npx
   tsc --noEmit` / `npx jest` stay green — this is additive infrastructure,
   not a data-layer or logic change.

## Out of scope

- Custom domain — default `*.web.app` URL only, per Decisions above.
- Any dashboard/charts UI — still not drafted (per spec 002's own "out of
  scope"), so there's nothing new to deploy here beyond what native
  already has: sign-in and manual transaction entry.
- Responsive/desktop-specific layout — same mobile-width UI as native,
  unscaled on a wide window (`react-native-web` renders it as-is). A
  redesign, if wanted, is a separate future spec (mirrors `da2`'s
  011 → 012 split).
- Web push notifications, offline/service-worker caching beyond what
  `expo export -p web` provides by default.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1, 2 — sign-in + shared data with native | Manual, in a browser | Sign in on the deployed URL; cross-check a transaction created there shows up on a native build (or vice versa) signed into the same account. |
| 3 — SPA rewrite / hard refresh | Manual, in a browser | Hard-refresh the deployed URL from a few different in-app states; confirm no 404. |
| 4 — no regressions | Automated | `npx tsc --noEmit` and `npx jest` (already-existing suite; nothing new to write — this spec adds no logic, only hosting config). |

No new automated tests are needed: this spec adds zero application logic
(no new `.ts`/`.tsx` files with behavior to unit-test), only a hosting
config file and a deploy command. The existing suite is the regression
guard (criterion 4); criteria 1–3 are inherently about the deployed,
running artifact and can only be checked by opening it in a browser,
matching how `da2`'s spec 011 verified the same kind of change.

## Verification results

Deployed 2026-09-21. Live at <https://lalanne-cheap-tracker.web.app>.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1, 2 — sign-in + shared data with native | ⏳ pending | No browser-automation tool was available in this environment (same limitation `da2`'s spec 002 verification notes recorded) — needs a manual pass signed in as the real account. |
| 3 — SPA rewrite / hard refresh | ✅ | `curl` against both the root and an arbitrary deep path (`/some/deep/path`) returned identical `200` responses serving `index.html` — the rewrite resolves correctly. |
| 4 — no regressions | ✅ | `firestore.rules` untouched (only `firebase.json` gained a `hosting` block and `.firebaserc` was added); `npx tsc --noEmit` and `npx jest` (20 suites / 91 tests) both pass unchanged before and after. |

**What shipped:**
- `firebase.json` — added a `hosting` block (`public: "dist"`, SPA rewrite).
- `.firebaserc` — new file, pins the default project to
  `lalanne-cheap-tracker` (didn't exist before; `firebase.json` alone
  carries no project association).
- Verified the Firebase config actually lands in the built bundle before
  deploying (`grep`'d the exported JS for the literal project ID) —
  specifically checking for the exact bug `da2`'s spec 011 hit on its
  first deploy (a dynamic `process.env[name]` lookup that Expo's babel
  plugin can't statically inline, silently producing `undefined` config
  and a blank page). `cheap`'s `firebaseApp.ts` already uses literal
  `process.env.EXPO_PUBLIC_X` property access, so that specific bug class
  doesn't apply here — confirmed, not assumed.
- Deploy command: `npx expo export -p web && firebase deploy --only hosting`.

Staying at `implemented`, not `verified`, until criteria 1–2 get a real
manual sign-in pass in a browser.
