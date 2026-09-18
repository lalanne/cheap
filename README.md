# cheap

A personal expense/income tracker. The goal isn't just logging
transactions — it's understanding where money goes clearly enough to make
real financial decisions: what to cut, what's creeping up, and how this
month compares to last.

Single-user, Chilean pesos (CLP) only, in v1. See
[`specs/000-overview.md`](specs/000-overview.md) for the full product
vision and scope.

## Stack

- **Expo (React Native) + TypeScript** — Android, iOS, and web from one
  codebase (web via `react-native-web`)
- **Firebase** — Auth (Google + email/password) and Firestore, no custom
  API server
- **Zustand** for state
- **Jest + jest-expo + React Native Testing Library** for tests

## Getting started

```bash
npm install
npm start          # then press a/i/w, or:
npm run android
npm run ios
npm run web
```

Create a `.env.local` with your Firebase project's web app config:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

## Testing

```bash
npm test          # unit/component tests (mocked Firebase)
npm run test:rules # Firestore security rules, against the local emulator
npm run typecheck
```

This project follows strict test-first, spec-driven development — see
below before making any change.

## Development process

This repo is built **spec-first**: no feature code without an approved
spec in [`specs/`](specs/), and no implementation code without a failing
test written first. The full process, spec index, and build order live in
[`specs/README.md`](specs/README.md); the rules for how every change is
made (test layers, what goes where) are in [`CLAUDE.md`](CLAUDE.md).

Start with [`specs/000-overview.md`](specs/000-overview.md) for the
product vision and v1 scope, then [`specs/README.md`](specs/README.md) for
the spec index and workflow.

## Project layout

```
src/
  auth/          # auth store + Firebase auth providers
  transactions/  # transaction store, validation, Firestore repositories
  screens/       # sign-in, verify-email, transactions
  components/    # design-system primitives (Button, Card, Input)
  theme/         # design tokens
firebase/tests/  # Firestore rules tests (run against the emulator)
specs/           # numbered feature specs — the source of truth
```
