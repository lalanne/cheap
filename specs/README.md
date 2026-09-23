# Specs — Spec-Driven Development

This project is built spec-first. Rules:

1. **No code without an approved spec.** Every feature has a spec file here, numbered in build order.
2. **Specs are the source of truth.** If requirements change, the spec is edited first, then the code.
3. **Acceptance criteria are the definition of done.** A feature ships only when every criterion in its spec passes.
4. **One spec at a time.** Implement, verify against criteria, then move to the next.
5. **Discussion happens on the spec, not the code.** When we're deciding what something should do, we edit the spec doc and talk about that — not sketch it in chat and not jump to an implementation to "see how it feels."

## Spec index

| # | Spec | Status |
|---|------|--------|
| 000 | [Product overview & stack](000-overview.md) | approved |
| 001 | [Authentication (Google + email/password)](001-auth.md) | approved (amended — criterion 12 pending) |
| 002 | [Transactions: data model & manual entry](002-transactions.md) | approved (amended — criterion 9 pending) |
| 003 | [Design system & visual language](003-design-system.md) | implemented |
| 004 | [iOS deployment (TestFlight)](004-ios-deployment.md) | implemented |
| 005 | [Web deployment (Firebase Hosting)](005-web-deployment.md) | implemented |
| 006 | [Responsive web layout](006-responsive-web-layout.md) | implemented |
| 007 | [Category budgets](007-budgets.md) | implemented |
| 008 | [Debt tracking](008-debt-tracking.md) | implemented |
| 009 | [Dashboard](009-dashboard.md) | implemented |

Status values: `draft` → `approved` → `implemented` → `verified`.

## Build order

The number is *mostly* the build order, with deliberate exceptions:

- **003 (design system) is built before 001's and 002's UI portions** —
  both specs' screens (sign-in, add-transaction, dashboard) are composed
  from 003's primitives and tokens. It's numbered 003 only because the
  look-and-feel decision wasn't made until after 001/002 were drafted —
  renumbering them would just be churn.
- **004 (iOS deployment) reopened 001** — native Google Sign-In was
  explicitly deferred at first implementation; getting to TestFlight
  requires it, so 001 gained a new requirements section and criterion 12
  rather than duplicating the auth spec. 004 depends on that criterion,
  not on 002 or 003.

So the working order is: **000 → 003 → 001 → 002 → (001 amended) → 004**.
Auth's and transactions' *data model and logic* (Firestore, rules, store)
don't depend on 003 and can be built/tested against the emulator in
parallel; it's specifically their screens that wait on it.

## Workflow

1. Draft a spec: vision/requirements, data model if relevant, Given/When/Then acceptance criteria, and a Verification plan mapping each criterion to a test layer (unit/integration/acceptance/e2e — see root `CLAUDE.md`).
2. Discuss and revise it in place until it's `approved`.
3. Before writing any implementation code, write the tests the Verification plan calls for and confirm they fail. Only then implement, moving the spec to `implemented` once every criterion's test passes.
4. Mark `verified` once it's been checked against the running app (not just tests).
