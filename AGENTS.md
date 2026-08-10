<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Build / test / verify commands

Run from `my-app/`. Env vars live in `.env.local` — source them before Prisma commands:

```bash
set -a && . .env.local && set +a && npx prisma validate
set -a && . .env.local && set +a && npx prisma migrate dev --name <name>
set -a && . .env.local && set +a && npx prisma generate
npx tsc --noEmit          # typecheck (no env needed)
npm run lint              # eslint
npm run dev               # next dev
```

### Tests

No test runner (jest/vitest) is configured. Tests are plain `.ts` files run via `npx tsx`:

```bash
npx tsx src/lib/__tests__/<name>.test.ts
```

Each test file uses a local `assert(condition, label)` helper and sets `process.exitCode = 1` on failure. There is **no DB test harness** — all tests are pure logic. DB-backed scenarios must be verified manually or via a staging DB.

### Known pre-existing tsc errors

`scripts/` is excluded from `tsconfig.json` and `eslint.config.mjs` — debug scripts are not type-checked or linted. `npx tsc --noEmit` and `npm run lint` now report 0 errors in app code (57 pre-existing warnings, all unused-vars style). No new warnings are introduced by the seat-reconciliation or recovery changes.

### Prisma schema gotchas

- `directUrl = env("DIRECT_URL")` — `prisma validate` fails without env vars loaded. Always source `.env.local` first.
- `ScheduledPushNotification.createdBy` is nullable (was required with `SetNull` FK — fixed in migration `20260804120000`).
- `PostVersion.format` is nullable — existing versions referenced by `Post.currentVersionId` were backfilled to the post's current format by migration `20260804160000`. Historical versions (not the current version) remain NULL; the read path (`versionToFields` in `post-refinement/actions.ts`) and `assertPostMatchesCurrentVersion` (in `post-integrity.ts`) interpret NULL as the post's current format. New versions always capture the real format.
- `ScheduledPushNotification` has bounded recoverable claim state (`claimToken`, `claimedAt`, `attempts`, `lastError`) added by migration `20260804170000`. The cron route `/api/cron/scheduled-pushes` claims ≤20 rows per pass, processes only claimed rows, and reclaims stale PROCESSING rows after a 10-minute lease.
- `ZernioEvent` has `claimToken` (migration `20260804180000`) for concurrency-safe claiming matching the Stripe webhook pattern.
- `SeatReconciliationOperation` (migration `20260804190000`) is the durable, idempotent operation row for seat reductions. Migration `20260804200000` adds persisted Stripe idempotency keys and admin-recovery audit fields. Migration `20260804210000` adds a partial unique index (`seat_reconciliation_active_unique_org_idx`) enforcing at most one active operation per org (PENDING or RECOVERY_REQUIRED). See "Seat reconciliation (durable)" below.
- Partial unique indexes (e.g. `WHERE status = 'OPEN'`) aren't supported in `schema.prisma` — append them manually to the generated `migration.sql`.

### Stripe ownership invariant (critical)

Community subscriptions live on the `Organization` record, NOT the `User`. The cancel/portal/switch-to-solo routes check `Organization.stripeSubscriptionId`/`stripeCustomerId` FIRST for community members, falling back to `User` only for solo subscribers. Never copy org Stripe fields onto a `User` — `registerWithToken` and `assignTeamAdmin` were fixed to stop doing this. Migration `20260804150000` clears stale fields from existing community members.

### Cron jobs (vercel.json)

Four crons are registered:
- `/api/cron/broadcasts` — every 5 minutes
- `/api/cron/scheduled-pushes` — every 5 minutes (bounded recoverable scheduled-push delivery; see `src/lib/scheduled-push-service.ts`)
- `/api/cron/notifications` — daily at 9 AM (posting reminders, streak warnings, weekly digest — does NOT send scheduled pushes)
- `/api/cron/billing` — hourly (trial expiration, account status reconciliation)

### Fire-and-forget background work

Critical background tasks (memory learning, onboarding surveys, signup emails, analytics milestones, calendar strategy generation) are wrapped in `after()` from `next/server`. `after()` allows work to continue after the response is sent, but it is best-effort and is not durable job infrastructure; serverless termination can still interrupt it. Do NOT revert these to bare `.catch()` — `after()` extends the function lifetime to give background work a better chance of completing. For truly durable work, use database claims, leases, cron jobs, and retryable background processing.

### Context survey expiration (`src/lib/freshness.ts`)

`isContextSurveyExpired(surveyType, updatedAt)` filters out stale timed surveys before AI generation:
- `WEEKLY_CONTEXT` — expires after last Sunday
- `MONTHLY_CONTEXT` — expires after first of month
- `STORY_REFRESH` — expires after 42 days
- All other types (COMPLIANCE_GUARDRAILS, OFFER_FUNNEL, etc.) never expire

Used by calendar generation (`calendar/actions.ts`) and refinement (`post-refinement/actions.ts`).

### Zernio webhook idempotency

`ZernioEvent` table deduplicates webhook deliveries by `eventId` (provider ID or SHA-256 hash of payload). Claiming is concurrency-safe and recoverable (matching the Stripe webhook pattern): a `claimToken` guards finalization, stale PROCESSING rows are reclaimable after a 5-minute lease, and FAILED rows are re-claimable on retry. SUCCEEDED events return `{ duplicate: true }` without re-sending notifications. PROCESSING events return `{ inProgress: true }`.

### Notification system conventions

- Milestone selection: `[...MILESTONES].reverse().find()` — picks the HIGHEST threshold the views qualify for.
- Milestone dedup: checks the specific milestone title (e.g. `"100K views!"`), not any analytics_milestone — each threshold fires independently.
- Scheduled push claim: bounded recoverable claim via `src/lib/scheduled-push-service.ts` — claims ≤20 rows per pass with a `claimToken`, processes only claimed rows, reclaims stale PROCESSING rows after a 10-minute lease, and preserves terminal states. The dedicated `/api/cron/scheduled-pushes` route runs every 5 minutes.
- Posting reminder dedup: per-user/per-day via `notificationLog` lookup.

### Post Refinement Core V1 (implemented)

See `docs/post-refinement-core-v1.md` for the full design (repository-relative). Key entry points:

- `src/app/dashboard/post-refinement/actions.ts` — server actions (turn state machine, accept/restore, `abandonStaleSessions` cron helper).
- `src/app/dashboard/calendar/RefinementPanel.tsx` — responsive UI (phone full-screen sheet, tablet/desktop slide-over).
- `src/lib/anthropic-client.ts` — shared Anthropic client (NO `x-request-id` header; turnId in DB/logs only).
- `src/lib/refinement-prompt.ts` — Zod schemas with explicit length limits; `turnId` validated as UUID.
- `src/lib/post-integrity.ts` — `assertPostMatchesCurrentVersion` + typed `PostIntegrityError`.

`serializableTransaction` (from `src/lib/rate-limiter.ts`) retries on P2034/P2002 — use it for any action that reads + writes Post/PostVersion/contentJson together.

Refinement compliance: `sendRefinementMessage` loads `profileSurveys` from the DB (filtered by `isContextSurveyExpired`) and passes them to `buildUserProfileXml` — do NOT hardcode `profileSurveys: []`. The idempotency check (`existingTurn` lookup) runs BEFORE rate limits and turn-cap validation. Turn + USER message creation is wrapped in `prisma.$transaction` for atomicity.

### Calendar generation idempotency

`generateWeeklyCalendar` claims an idempotency row (via `serializableTransaction`) BEFORE rate limits, RSS fetches, and AI pre-calls. Previously the claim ran too late, consuming rate-limit tokens on every retry and burning AI cost on duplicate runs. The claim must stay before `checkActionRateLimit` and `fetchTrendingHeadlines`.

`requestId` is a required parameter (UUID, validated via `isValidCalendarRequestId`). The legacy non-idempotent path (no requestId) is removed. The pure claim-decision logic (`decideCalendarClaim`) lives in `src/lib/calendar-claim-service.ts` and is unit-tested there; the action performs the DB writes the decision prescribes. Every post-claim failure path (rate limit, missing API key, AI error, parse error, incomplete calendar, prework exception) transitions the owned claim to FAILED via `failClaim` or the outer catch. A heartbeat refreshes `requestClaimedAt` every 30 seconds so a long generation is not reclaimed as stale. `finally` always stops the heartbeat. The claim is finalized with a conditional update on `claimToken` so a worker cannot finalize a lease it no longer owns.

### Custom prompt template semantics

A custom `calendarPromptTemplate` or `calendarStrategyPromptTemplate` replaces the SYSTEM prompt; the USER prompt is always the assembled context (calendar data + profile XML). Placeholders in both prompts are replaced. For the calendar path, all placeholders (`{{questionnaireAnswers}}`, `{{daysToPost}}`, `{{targetDays}}`, `{{formatMix}}`, `{{bucketDistribution}}`, etc.) are replaced in both system and user prompts via the shared `replacePromptPlaceholders` helper in `src/lib/prompt-placeholders.ts` (unit-tested there). Stale block placeholders (`{{deepDiveBlock}}`, `{{goalBlock}}`, etc.) are replaced with empty strings. For the strategy path, `replaceStrategySystemPlaceholders` replaces `{{weekStarting}}`, `{{formatMix}}`, `{{bucketMix}}`, `{{daySummary}}`, `{{primaryGoal}}`, and `{{antiBrandWords}}` in the system prompt only. Unknown placeholders are left as-is (literal `{{...}}`) so a typo is visible to the admin.

### Seat reconciliation (durable)

Seat reduction is a durable, idempotent operation that preserves consistency
between Stripe and the database across failures. The orchestration lives in
`src/lib/seat-reconciliation-service.ts` (unit-tested with injected Prisma/Stripe
fakes); the server action `reduceSeatsWithReconciliation` in
`src/app/dashboard/billing/seat-actions.ts` wires real Prisma and Stripe.

**State machine** (status on `SeatReconciliationOperation`):

- `PENDING` — claimed, validation done, Stripe call not yet applied.
- `COMPLETED` — Stripe reduced AND DB member/seatLimit changes applied.
- `FAILED` — retryable: Stripe rejected/timeout (members untouched, seatLimit
  unchanged) OR Stripe succeeded + DB failed + Stripe compensation succeeded
  (members untouched, Stripe restored to original quantity).
- `RECOVERY_REQUIRED` — Stripe succeeded + DB failed + Stripe compensation also
  failed. Admin must intervene. The row preserves the original quantity and
  last error so a human can reconcile the subscription manually.

**Invariants:**

1. Stripe is called BEFORE any member or seatLimit mutation. If Stripe rejects
   or times out, no member loses access and seatLimit is unchanged.
2. If Stripe succeeds but the DB transaction fails, the orchestrator compensates
   by restoring the Stripe subscription to the original quantity (separate
   idempotency key). If compensation succeeds, the operation is FAILED
   (retryable, members untouched).
3. If compensation also fails, the operation is RECOVERY_REQUIRED — never
   silently converted to a generic success.
4. A retry with the same `requestId` resumes the existing operation:
   COMPLETED → returns the existing successful result; RECOVERY_REQUIRED →
   returns a "contact support" error; FAILED → re-claims and re-runs.
5. The Stripe reduction uses a PERSISTED idempotency key generated once at op
   creation and reused across retries, stale reclaims, and unknown-outcome
   retries. Compensation uses a separate persisted key derived from the
   immutable operation ID (`seat_reconcile_comp_<op-id>`), not from the main
   key via string replacement. Neither key is derived from the attempt
   counter. See migration `20260804200000` for the persisted key columns.
6. `originalStripeQuantity` and `originalSeatLimit` are IMMUTABLE after first
   set. They are captured once before the first Stripe mutation and never
   overwritten on retry. This preserves recovery evidence.
7. Before applying DB changes, the orchestrator verifies the LIVE Stripe
   quantity equals `targetSeats`. After compensation, it verifies the live
   quantity equals `originalStripeQuantity`. This catches unknown-outcome
   crashes where Stripe may or may not have been mutated.

**Admin recovery for a RECOVERY_REQUIRED operation:**

1. Query `SeatReconciliationOperation` rows with `status = 'RECOVERY_REQUIRED'`.
2. Read `originalStripeQuantity` and `lastError` — the subscription was reduced
   to `targetSeats` but the DB was not updated and compensation failed.
3. Manually restore the Stripe subscription quantity to `originalStripeQuantity`
   (or apply the intended `targetSeats` if the DB failure was transient and the
   admin wants to complete the reduction manually).
4. Update the row status to `COMPLETED` or `FAILED` to clear the recovery flag.

**Automated admin recovery (`/admin/seat-reconciliation`):**

The admin recovery service (`src/lib/seat-recovery-service.ts`) provides a UI-driven
workflow for resolving RECOVERY_REQUIRED operations. It is extracted as a DI service
with the same Prisma/Stripe interfaces as the reconciliation service, so it is fully
unit-testable with injected fakes.

Authorization: every function requires a global ADMIN caller. TEAM_ADMIN and regular
users are denied. The caller's role is passed as a parameter loaded from trusted
server state by the server action (`src/app/admin/seat-reconciliation/actions.ts`).

Recovery actions (admin chooses one):

- `RESTORE_ORIGINAL`: restores the Stripe subscription to the original quantity.
  DB members and seatLimit remain unchanged. Use when DB changes were never
  committed. **Hardened:** blocks if the DB `seatLimit` has already changed from
  `originalSeatLimit` (indicating DB changes were committed). Verifies the live
  Stripe quantity equals `originalStripeQuantity` after the mutation. Finalization
  is atomic (serializable transaction, token-scoped, no error swallowing).
- `COMPLETED_DB`: applies the DB member/seatLimit changes. Requires the live
  Stripe quantity to equal `targetSeats` AND the membership state to be
  compatible (seatLimit unchanged, selected users still in the org, no selected
  user promoted to admin, active count matches). **Pending invites are counted
  inside the serializable transaction** — if remaining active members + pending
  invites > targetSeats, the transaction rolls back. Finalization is atomic
  (same serializable transaction as the DB mutations, token-scoped, no error
  swallowing). Blocks with a clear error if state has drifted — the admin should
  use `RESTORE_ORIGINAL` instead.

Concurrency: recovery uses a conditional claim (`recoveryClaimToken`) so two
admins cannot resolve the same operation concurrently. Stale recovery claims
are reclaimable after a 10-minute lease (`RECOVERY_LEASE_MS`). On failure, the
claim is released so the same admin or another admin can retry.

**Conflict blocking (Finding 6):** Before starting a new reconciliation or
resolving a recovery, the service checks for conflicting active operations
(PENDING or RECOVERY_REQUIRED) for the same organization. If found, the
operation is blocked with a clear error. A partial unique index
(`seat_reconciliation_active_unique_org_idx`, migration `20260804210000`)
enforces this at the database level: at most one non-terminal operation per
organization. The index covers `status IN ('PENDING', 'RECOVERY_REQUIRED')`.
This index cannot be represented in `schema.prisma` — it exists only in the
migration SQL. When `prisma migrate diff` or `prisma db pull` reports drift
on this index, it is expected and should be ignored.

Idempotency: recovery uses a persisted `recoveryIdempotencyKey` (stored on the
op row, generated once on first recovery attempt). Retries after a timeout
reuse the same key — Stripe deduplicates the retry to the same logical
mutation.

Audit trail: `resolvedAt`, `resolvedByUserId`, `resolutionType`, and
`resolutionSummary` are recorded on the op row. Recovery evidence
(`originalStripeQuantity`, `originalSeatLimit`, `lastError`) is never deleted.
A replay of a resolved operation returns idempotent success.

The client (`SeatManager.tsx`) generates a UUID `requestId` per reconciliation
attempt; a retry with the same `requestId` resumes the existing operation.

**Migrations:**
- `20260804190000_add_seat_reconciliation_operations` creates the table. Run
  `prisma migrate deploy` BEFORE deploying code that references it (the old app
  ignores the table; the new app requires the columns).
- `20260804200000_seat_reconciliation_idempotency_and_recovery` adds persisted
  Stripe idempotency keys and admin-recovery audit fields.
- `20260804210000_seat_reconciliation_partial_unique_active` adds a partial
  unique index enforcing at most one active (PENDING or RECOVERY_REQUIRED)
  operation per organization. The migration includes a non-destructive preflight
  check: if any organization has duplicate active operations, the migration
  aborts with a `RAISE EXCEPTION` listing the affected organization IDs. The
  operator must reconcile those records against live Stripe and DB state (via
  the admin recovery dashboard) before rerunning the migration. No data is
  modified by the preflight. This index is NOT in `schema.prisma` — it exists
  only in the migration SQL. `prisma migrate diff` will report it as drift;
  this is expected and should be ignored.

**Browser-safe DTOs:** Recovery listing and detail APIs return `RecoveryListDTO`
and `RecoveryDetailDTO` types that exclude sensitive fields (idempotency keys,
claim tokens, lease timestamps, Stripe subscription IDs). The internal
`RecoveryListRow` and `RecoveryDetailRow` types are never sent to the browser.
The admin client component (`SeatReconciliationAdminClient.tsx`) and server
actions (`actions.ts`) use only DTO types.

**Bounded recovery queries:** `listRecoveryRequiredOperations` is bounded to
100 rows (`RECOVERY_LIST_LIMIT`) with a `hasMore` flag. Organization and actor
enrichment is batched (single `findMany` per entity type) to avoid N+1 queries.

### Account and organization deletion hardening

Both self-delete (`/api/account/delete`) and admin delete (`deleteUser` in
`src/app/admin/actions.ts`) block deletion if Stripe cancellation fails — an
orphaned paid subscription is worse than a retryable error. If Stripe is not
configured but a subscription ID exists, deletion is blocked. Organization
deletion (`deleteOrganization` in `src/app/admin/organizations/actions.ts`)
requires the admin to type the org name exactly (`confirmName` parameter); the
UI shows a typed-confirmation modal. The org deletion also checks
`isStripeCheckoutConfigured()` before calling `getStripe()`, matching the
account-deletion paths.

The pure decision logic (`decideAccountDelete`, `decideOrgDelete`,
`decideAfterStripeCancelFailure`) lives in `src/lib/deletion-hardening.ts` and
is unit-tested there. The route/action handlers call these helpers and perform
the actual DB/Stripe calls based on the returned decision.

### Build configuration

- `turbopack.root` in `next.config.ts` is resolved dynamically via `import.meta.url` — do NOT hard-code a path (breaks CI/other machines).
- `scripts/` is excluded from both `tsconfig.json` and `eslint.config.mjs` — debug scripts only, not app code.
