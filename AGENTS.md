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

`scripts/inspect-user.ts` has 4 pre-existing errors (`usedAt`, `current_period_start`, `current_period_end`). These are unrelated to app code — filter them out when checking typecheck output:

```bash
npx tsc --noEmit 2>&1 | grep -v "scripts/inspect-user.ts"
```

### Prisma schema gotchas

- `directUrl = env("DIRECT_URL")` — `prisma validate` fails without env vars loaded. Always source `.env.local` first.
- A pre-existing `SetNull`-on-required-field warning exists (from `ScheduledPushNotification`); it's benign.
- Partial unique indexes (e.g. `WHERE status = 'OPEN'`) aren't supported in `schema.prisma` — append them manually to the generated `migration.sql`.

### Post Refinement Core V1 (implemented)

See `/Users/danielsmac/.devin/plans/plan-f7b85223f1738654.md` for the full design. Key entry points:

- `src/app/dashboard/post-refinement/actions.ts` — server actions (turn state machine, accept/restore, `abandonStaleSessions` cron helper).
- `src/app/dashboard/calendar/RefinementPanel.tsx` — responsive UI (phone full-screen sheet, tablet/desktop slide-over).
- `src/lib/anthropic-client.ts` — shared Anthropic client (NO `x-request-id` header; turnId in DB/logs only).
- `src/lib/refinement-prompt.ts` — Zod schemas with explicit length limits; `turnId` validated as UUID.
- `src/lib/post-integrity.ts` — `assertPostMatchesCurrentVersion` + typed `PostIntegrityError`.

`serializableTransaction` (from `src/lib/rate-limiter.ts`) retries on P2034/P2002 — use it for any action that reads + writes Post/PostVersion/contentJson together.
