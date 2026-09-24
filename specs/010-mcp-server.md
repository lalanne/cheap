# 010 — MCP Server: Financial Data for Claude

**Status:** draft
**Depends on:** 002 (transactions), 007 (budgets), 008 (debt tracking),
009 (dashboard's aggregation/suggestion functions — reused directly, not
reimplemented)

## Purpose

Let Claude answer questions about the account owner's real financial
data — "how much did I spend on Food this month," "which debt should I
pay off faster," "am I saving enough" — by exposing it through an MCP
server Claude can query directly, instead of the owner manually copying
numbers out of the app into a chat. This is the same vision spec 000
already commits to (suggestions, "what to cut"); this spec just adds a
second surface for it beyond the in-app dashboard.

This is infrastructure, not a screen — same category as specs 004/005
(deployment), scoped the same way.

## Decisions

- **Remote, not local.** An MCP server can run as a local `stdio`
  process (spawned by Claude Code on the same machine) or as a hosted
  HTTP service Claude connects to by URL. Local was rejected: it's only
  reachable while the owner's own machine is on, awake, and running
  Claude Code — not "always available." A remote server, reachable from
  any device at any time, is the actual requirement.
- **Cloud Run**, same GCP project (`lalanne-cheap-tracker`) as
  Firestore/Hosting already use — same reasoning spec 005 used for
  Firebase Hosting (no new project, no separate billing surface).
  Pay-per-request, scales to zero when idle (near-zero cost at
  personal-use volume), stable HTTPS URL. Considered Cloud Functions
  (2nd gen) as an alternative — also viable, but Cloud Run gives more
  direct control over the long-lived HTTP server the MCP Streamable HTTP
  transport needs, and is the more standard choice for a self-hosted MCP
  server.
- **Firestore access via IAM, not a service-account key file.** Running
  inside the same GCP project means the Cloud Run service's runtime
  identity can be granted Firestore access directly (Application Default
  Credentials, no key material to generate, store, or rotate). A
  dedicated `cheap-mcp-server` service account is created and granted
  **`roles/datastore.viewer`** only (read-only) — not the default
  compute service account, which typically carries broader project
  access than this needs.
- **App-level bearer token, not Cloud Run's built-in IAM auth.** Cloud
  Run supports `--no-allow-unauthenticated`, requiring a Google-signed
  identity token per request — strong, but MCP clients (Claude)
  authenticate with a static bearer/API-key-style credential, not a
  Google identity token. So the service is deployed publicly reachable
  (`--allow-unauthenticated`) but does nothing without a correct
  `Authorization: Bearer <token>` header, checked in application code
  before any Firestore read. The token is generated once, stored in
  Secret Manager, and injected as an env var at deploy time
  (`--set-secrets`) — never committed, never logged.
- **`OWNER_UID` hardcoded server-side, never accepted from the caller.**
  Every tool reads only `users/{OWNER_UID}/...` — `OWNER_UID` is a deploy-time
  env var, not a tool parameter. Since the Admin SDK bypasses
  `firestore.rules` entirely (those only apply to client SDKs), the
  server itself is the only thing enforcing "this account, nothing
  else" — no tool schema exposes a `uid` argument, by design, not by
  convention.
- **Read-only in v1.** No tool creates, edits, or deletes anything.
  Revisit (a new spec, explicit approval) only if the owner wants
  Claude to log a transaction or adjust a budget directly — a
  meaningfully bigger trust boundary than reading.
- **Reuse the app's existing pure functions, don't reimplement them.**
  `src/dashboard/aggregation.ts`, `src/dashboard/suggestions.ts`,
  `src/budgets/computeCategorySpend.ts`, and `src/debts/payoffMath.ts`
  have zero React/React Native/Firebase-SDK dependencies (confirmed by
  reading each file) — the MCP server imports them directly from `src/`
  rather than recomputing the same math a second way. One source of
  truth for "how is savings rate calculated," shared by the dashboard
  and by Claude.
- **Repo layout:** a new top-level `mcp-server/` directory (own
  `package.json`, own `tsconfig.json`, own `Dockerfile`), not inside
  `src/` — it's a separate deployable service with different runtime
  dependencies (`@modelcontextprotocol/sdk`, `firebase-admin`, `express`)
  that have no business being in the Expo app's bundle. Its
  `tsconfig.json` sets `rootDir` to the repo root (one level up) so it
  can compile its own `mcp-server/src/**` alongside the handful of
  `src/dashboard`/`src/budgets`/`src/debts`/`src/transactions` files it
  imports, without duplicating them. Considered npm workspaces — rejected
  as more setup than five imported files justify.
- **MCP transport: Streamable HTTP, stateless.** The current standard
  remote-MCP transport (`@modelcontextprotocol/sdk`'s
  `StreamableHTTPServerTransport`), run with no session-id generator —
  every request is independent (fetch from Firestore, compute, respond),
  which fits Cloud Run's request-scoped, potentially-multi-instance
  model better than holding session state in memory.

## Data model

No new Firestore data. Reads existing collections, unchanged:
`users/{OWNER_UID}/transactions`, `users/{OWNER_UID}/budgets`,
`users/{OWNER_UID}/debts` (specs 002/007/008). No writes in v1.

## Tools exposed

All five are read-only, take no `uid` parameter (see Decisions), and
return the same numbers the in-app dashboard shows because they call the
same functions:

| Tool | Params | Returns | Reuses |
|------|--------|---------|--------|
| `get_monthly_summary` | `year?`, `month?` (default: current) | income, expense, savings rate, per-category totals | `monthlyTotals`, `categoryTotalsForMonth` |
| `get_budgets_status` | `year?`, `month?` | each budget's category/limit/spend/percent/over-flag | `computeCategorySpend` |
| `get_debts` | — | each debt's balance/minimum payment/% paid/months-to-payoff at current and doubled pace | `percentPaid`, `monthsToPayoff` |
| `get_suggestions` | — | the same suggestion objects the dashboard's feed shows (budget-overrun / debt-pace / savings-rate) | `computeSuggestions` |
| `get_spend_trend` | — | last 6 calendar months' expense totals | `last6MonthsExpense` |

## Acceptance criteria

1. **Given** a valid bearer token, **when** an MCP client calls
   `get_monthly_summary` with no args, **then** it returns the current
   month's income/expense/savings-rate/category totals, matching what
   `monthlyTotals`/`categoryTotalsForMonth` compute for the same data.
2. **Given** a valid bearer token, **when** an MCP client calls
   `get_budgets_status`, **then** it returns every budget's spend/limit/
   percent/over-flag, matching `computeCategorySpend`.
3. **Given** a valid bearer token, **when** an MCP client calls
   `get_debts`, **then** it returns every debt's balance/minimum
   payment/percent paid/months-to-payoff at current and doubled pace,
   matching `payoffMath`.
4. **Given** a valid bearer token, **when** an MCP client calls
   `get_suggestions`, **then** it returns the exact suggestion objects
   `computeSuggestions` produces for this month vs. last month.
5. **Given** a valid bearer token, **when** an MCP client calls
   `get_spend_trend`, **then** it returns the last 6 calendar months'
   expense totals, matching `last6MonthsExpense`.
6. **Given** a missing or incorrect bearer token, **when** any tool is
   called, **then** the request is rejected (401) before any Firestore
   read happens — no partial data returned.
7. **Given** the deployed service, **then** no tool schema accepts a
   `uid` parameter, every Firestore read is scoped to
   `users/{OWNER_UID}/...` via a server-side env var, and the Cloud Run
   service's runtime service account holds only `roles/datastore.viewer`
   (read-only) on the project.
8. **Given** `npx tsc --noEmit` and `npx jest` in both the app root and
   `mcp-server/`, **then** both stay green.

## Out of scope

- Any write tool (create/edit/delete a transaction, budget, or debt via
  Claude) — v1 is read-only, per Decisions.
- OAuth or per-client credentials — one static bearer token, matching
  "single account, single trusted client" (the account owner, via
  Claude). Revisit if this ever needs to serve more than one caller.
- Rate limiting, abuse monitoring, or alerting beyond what Cloud Run
  provides by default — low-traffic personal tool, not a public API.
- A UI for any of this — MCP tool calls only.

## Verification plan

| Criterion | Layer | How |
|-----------|-------|-----|
| 1–5 — each tool's data, matching the app's own math | Unit + Integration | Unit: tool handler tested with a mocked Firestore Admin client, asserting the correct pure function is called and its result shaped correctly into the tool response. Integration: same handlers run against the local Firestore emulator (`FIRESTORE_EMULATOR_HOST`), seeded with known transactions/budgets/debts, asserting the actual returned values. |
| 6 — bad/missing token rejected before any read | Unit | Auth middleware tested directly: valid token calls through, missing/wrong token returns 401 and the Firestore mock is never called. |
| 7 — no cross-account exposure possible | Manual / config review | Code review: grep confirms no tool schema declares a `uid` param. Deploy-time check: `gcloud projects get-iam-policy` / service description confirms the runtime service account has only `roles/datastore.viewer`. |
| 8 — no regressions | Automated | `npx tsc --noEmit` and `npx jest`, run in both the repo root and `mcp-server/`. |

No E2E layer: there's no user-facing browser flow to click through (per
CLAUDE.md's E2E guidance — added only when a spec concretely needs it).
Criteria 1–6 are proven by unit + integration tests against a real
emulator; the actual "does Claude get a sensible answer" check is a
manual pass with a real MCP client after deploy (register the server,
ask a real financial question, confirm the answer matches the app).

## Verification results

Not yet implemented.
