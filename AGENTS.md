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

`scripts/` is excluded from `tsconfig.json` and `eslint.config.mjs` — debug scripts are not type-checked or linted. `npx tsc --noEmit` and `npm run lint` now report 0 errors in app code (57 pre-existing warnings, all unused-vars style).

### Prisma schema gotchas

- `directUrl = env("DIRECT_URL")` — `prisma validate` fails without env vars loaded. Always source `.env.local` first.
- `ScheduledPushNotification.createdBy` is nullable (was required with `SetNull` FK — fixed in migration `20260804120000`).
- `PostVersion.format` is nullable — existing versions referenced by `Post.currentVersionId` were backfilled to the post's current format by migration `20260804160000`. Historical versions (not the current version) remain NULL; the read path (`versionToFields` in `post-refinement/actions.ts`) and `assertPostMatchesCurrentVersion` (in `post-integrity.ts`) interpret NULL as the post's current format. New versions always capture the real format.
- `ScheduledPushNotification` has bounded recoverable claim state (`claimToken`, `claimedAt`, `attempts`, `lastError`) added by migration `20260804170000`. The cron route `/api/cron/scheduled-pushes` claims ≤20 rows per pass, processes only claimed rows, and reclaims stale PROCESSING rows after a 10-minute lease.
- `ZernioEvent` has `claimToken` (migration `20260804180000`) for concurrency-safe claiming matching the Stripe webhook pattern.
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

Critical background tasks (memory learning, onboarding surveys, signup emails, analytics milestones, calendar strategy generation) are wrapped in `after()` from `next/server` to guarantee completion after the response is sent. Do NOT revert these to bare `.catch()` — serverless functions can terminate before unawaited promises resolve.

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

See `/Users/danielsmac/.devin/plans/plan-f7b85223f1738654.md` for the full design. Key entry points:

- `src/app/dashboard/post-refinement/actions.ts` — server actions (turn state machine, accept/restore, `abandonStaleSessions` cron helper).
- `src/app/dashboard/calendar/RefinementPanel.tsx` — responsive UI (phone full-screen sheet, tablet/desktop slide-over).
- `src/lib/anthropic-client.ts` — shared Anthropic client (NO `x-request-id` header; turnId in DB/logs only).
- `src/lib/refinement-prompt.ts` — Zod schemas with explicit length limits; `turnId` validated as UUID.
- `src/lib/post-integrity.ts` — `assertPostMatchesCurrentVersion` + typed `PostIntegrityError`.

`serializableTransaction` (from `src/lib/rate-limiter.ts`) retries on P2034/P2002 — use it for any action that reads + writes Post/PostVersion/contentJson together.

Refinement compliance: `sendRefinementMessage` loads `profileSurveys` from the DB (filtered by `isContextSurveyExpired`) and passes them to `buildUserProfileXml` — do NOT hardcode `profileSurveys: []`. The idempotency check (`existingTurn` lookup) runs BEFORE rate limits and turn-cap validation. Turn + USER message creation is wrapped in `prisma.$transaction` for atomicity.

### Calendar generation idempotency

`generateWeeklyCalendar` claims an idempotency row (via `serializableTransaction`) BEFORE rate limits, RSS fetches, and AI pre-calls. Previously the claim ran too late, consuming rate-limit tokens on every retry and burning AI cost on duplicate runs. The claim must stay before `checkActionRateLimit` and `fetchTrendingHeadlines`.

`requestId` is a required parameter (UUID, validated). The legacy non-idempotent path (no requestId) is removed. Every post-claim failure path (rate limit, missing API key, AI error, parse error, incomplete calendar, prework exception) transitions the owned claim to FAILED via `failClaim` or the outer catch. A heartbeat refreshes `requestClaimedAt` every 30 seconds so a long generation is not reclaimed as stale. `finally` always stops the heartbeat. The claim is finalized with a conditional update on `claimToken` so a worker cannot finalize a lease it no longer owns.

### Custom prompt template semantics

A custom `calendarPromptTemplate` or `calendarStrategyPromptTemplate` replaces the SYSTEM prompt; the USER prompt is always the assembled context (calendar data + profile XML). Placeholders in both prompts are replaced. For the calendar path, all placeholders (`{{questionnaireAnswers}}`, `{{daysToPost}}`, `{{targetDays}}`, `{{formatMix}}`, `{{bucketDistribution}}`, etc.) are replaced in both system and user prompts via a shared `replacePromptPlaceholders` helper. Stale block placeholders (`{{deepDiveBlock}}`, `{{goalBlock}}`, etc.) are replaced with empty strings. For the strategy path, `{{weekStarting}}`, `{{formatMix}}`, `{{bucketMix}}`, `{{daySummary}}`, `{{primaryGoal}}`, and `{{antiBrandWords}}` are replaced in the system prompt.

### Seat reconciliation (server-owned)

Seat reduction is a single server action: `reduceSeatsWithReconciliation` in `src/app/dashboard/billing/seat-actions.ts`. It archives/detaches selected members, validates the active count fits the new seat count, updates the org seatLimit, and calls Stripe — all server-side in a serialized transaction followed by the Stripe API call. The client (`SeatManager.tsx`) no longer orchestrates multiple separate calls.

### Account and organization deletion hardening

Both self-delete (`/api/account/delete`) and admin delete (`deleteUser` in `src/app/admin/actions.ts`) block deletion if Stripe cancellation fails — an orphaned paid subscription is worse than a retryable error. If Stripe is not configured but a subscription ID exists, deletion is blocked. Organization deletion (`deleteOrganization` in `src/app/admin/organizations/actions.ts`) requires the admin to type the org name exactly (`confirmName` parameter); the UI shows a typed-confirmation modal.

### Build configuration

- `turbopack.root` in `next.config.ts` is resolved dynamically via `import.meta.url` — do NOT hard-code a path (breaks CI/other machines).
- `scripts/` is excluded from both `tsconfig.json` and `eslint.config.mjs` — debug scripts only, not app code.
