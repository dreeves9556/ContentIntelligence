# Production Database Runbook

This runbook governs any production PostgreSQL inspection or change for The Local Post.

## 1. Current production state

Production is an existing, unbaselined PostgreSQL database hosted by Supabase. It has no reliable Prisma `_prisma_migrations` history and was historically synchronized with `prisma db push`. `.env.local` has previously pointed to production with an owner-level account, and a previous migration workflow caused a destructive production-data incident.

The archived Listings feature is unrelated and must not be included in production database work. Do not infer production identity from a branch, migration filename, environment-variable name, or account role.

## 2. Absolute prohibitions and credential handling

Never connect to, inspect, modify, migrate, reset, seed, or test against production unless Daniel has separately approved the specific operation and this runbook's preflight is complete.

Production credential values may exist only in approved provider-managed encrypted secret stores, such as Vercel Production environment variables. Approved production server runtime code may read `process.env.DATABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY` from that provider-managed store. Local Prisma and development processes must never receive production credential values.

Never hardcode or commit production credentials, place them in `NEXT_PUBLIC_*` variables, bundle them into client code, copy them into local agents/scripts/shells/files/chat, or print, log, serialize, return, or expose them through actions, routes, DTOs, errors, CI logs, or support output. Local agents and scripts must never receive the production value.

Never run raw SQL from a local shell against production. Never run diagnostic scripts or application routes against production to discover identity or schema. Production credentials may be used only by approved server runtime code through `process.env` or by the explicitly verified provider interface for the approved operation.

## 3. Prisma command classes

Apply these command classes exactly:

- `prisma migrate dev` and `prisma migrate reset`: disposable local databases only. Never staging or production.
- `prisma migrate deploy` and `prisma migrate status`: only baselined, migration-managed non-production databases. Never production while it is unbaselined.
- `prisma db push`, `prisma db pull`, `prisma db execute`, `prisma db seed`, and Prisma Studio: never production. Use only after explicit target proof against disposable local or explicitly approved staging databases.
- `prisma validate`, `prisma format`, and `prisma generate`: allowed locally without production credentials, using placeholder or confirmed-safe non-production environment values. Never run them with a production or unknown datasource.
- Schema diff/resolve commands and equivalent Prisma CLI workflows: never against production or an unknown datasource. Use only in a separately approved, proven-safe non-production context.

Production remains unbaselined and receives only separately reviewed additive SQL through the approved provider workflow. Never create `_prisma_migrations`, mark migrations applied, edit/reorder/delete existing migration history, or mix `db push` and Prisma Migrate without a separately reviewed baselining plan.

## 4. Required approval gate

Before any production inspection or change, stop and present Daniel with:

1. The affected table, column, index, enum, policy, or Storage object.
2. The reason the operation is needed.
3. The exact SQL or controlled-provider operation.
4. What it will change.
5. What it will not change.
6. The expected verification result.
7. The rollback or feature-disable path.

No production operation may run until Daniel explicitly approves that described operation. Approval for one operation does not approve a later operation.

## 5. Target identity preflight

Before every database command, prove the target is either a disposable local database or the explicitly approved staging project. For an approved production operation, verify the target in the Supabase Dashboard immediately before execution.

For production, record only these sanitized fields:

- Supabase organization name.
- Supabase project name.
- Supabase project reference.
- Provider hostname, without credentials or connection strings.
- Database name.
- PostgreSQL version.
- `current_user` from the SQL Editor session.

In the production Supabase Dashboard SQL Editor, `current_user = postgres` is expected. The `postgres` role alone neither proves nor disproves the target identity. Verify the organization, project name, project reference, provider hostname, database name, and PostgreSQL version together.

The production `postgres` role is permitted only inside the explicitly verified production Supabase Dashboard SQL Editor for the exact reviewed SQL after approval and backup verification. It is prohibited in local shells, Prisma, agents, scripts, application code, CI, and unapproved clients. For disposable local or approved staging databases, do not use the `postgres` owner role.

If the target is unknown, production but not the explicitly approved project, or otherwise does not match the reviewed identity, stop and ask Daniel. Do not print full connection strings, passwords, access tokens, API keys, or secret values.

## 6. Restore point and preflight requirements

A production schema change requires all of the following before the change:

1. A current, verified Supabase backup or restore point.
2. The restore-point identifier and verification timestamp recorded with the change.
3. Read-only catalog inspection of the affected objects.
4. An exact comparison between live and expected definitions.
5. Confirmation that no unrelated drift is being changed.
6. Exact SQL review by Daniel.
7. A narrow, idempotent execution path through the explicitly verified production Supabase Dashboard SQL Editor or another separately approved protected workflow.

If the restore point cannot be verified, the target identity is uncertain, the live schema differs unexpectedly, or preflight finds unrelated drift, stop. Do not improvise a repair or broaden the SQL.

## 7. Production SQL requirements

Production SQL must be a separate reviewed artifact. Never apply a generated Prisma migration directly to the unbaselined production database.

Production SQL must be additive, narrowly scoped, idempotent, reviewed as exact text, and applied only after target and restore-point verification.

Where PostgreSQL supports it, use one explicit transaction with a short lock timeout and reasonable statement timeout:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- exact reviewed additive statements only
COMMIT;
```

If any statement fails, roll back the entire artifact. Do not accept partial results or retry with broadened SQL. If the provider/editor cannot guarantee transaction behavior, stop and obtain a separately approved execution method.

Production SQL must contain none of the following:

- `DROP`
- `TRUNCATE`
- `DELETE`
- Destructive table replacement.
- Destructive column alteration.
- Unrelated data cleanup or backfill.
- Migration-history manipulation.

The prohibition on `CASCADE` includes foreign-key `ON DELETE CASCADE` by default. Design Templates relationships must use `RESTRICT` or `SET NULL` unless a separately reviewed relationship-specific exception is approved and documented. A migration being additive does not make it safe for production.

## 8. Fresh and disposable databases

Fresh or disposable local databases may use the repository's Prisma migration history after target proof.

1. Confirm disposable local or explicitly approved staging identity.
2. Display only sanitized host, database, user, environment, and PostgreSQL version.
3. Update `prisma/schema.prisma`.
4. Generate and review a migration under `prisma/migrations/`.
5. Replay the complete migration history on disposable PostgreSQL.
6. Verify schema, generated client, typecheck, lint, and pure tests.
7. Keep production disconnected from local Prisma commands.

Production remains unbaselined until Daniel approves a separate baselining project and plan.

## 9. Design Templates rollout guardrails

- `PlatformConfig.designTemplatesEnabled` defaults to `false` in Prisma, application fallbacks, migration SQL, and tests.
- The production feature flag remains false through schema work, PR1 deployment, PR2 deployment, and production smoke QA. An approved staging environment may temporarily enable its separate flag for member QA.
- An authorized administrator may enable production only after both PRs are deployed, Storage is verified, and member QA passes.
- Enabling the flag through the authorized admin settings interface is the expected application write; it does not require separate manual production SQL. It must still be authenticated, role-checked, centrally status-checked, and recorded.
- Turning the flag off must not delete templates, thumbnails, or usage evidence.
- Templates are global and must not reference archived Listings models, helpers, migrations, tags, or `src/lib/listings`.
- Production Template SQL adds only approved objects and deterministic taxonomy rows through idempotent inserts.
- The member open route rechecks authentication, account status, effective PRO access, feature state, published status, and stored URL validation.
- Member DTOs never contain the Canva URL. The unavoidable URL handoff after an authorized click must be documented accurately.

## 10. Supabase Storage guardrails

Storage is a separate prerequisite from database schema work. Use separate buckets:

- Non-production: `design-template-thumbnails-staging`
- Production: `design-template-thumbnails-production`

Required server environment variable names:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DESIGN_TEMPLATES_STORAGE_BUCKET`

The bucket variable points to staging outside production and production inside production. Never share a bucket between environments.

Storage policy requirements:

- Public object read only for thumbnails.
- No public write, update, delete, or listing.
- Backend writes/deletes only through server-only Storage code using the provider-managed service-role secret.
- JPEG, PNG, or WebP only.
- Maximum size 2 MB.
- Validate MIME type, extension, and file signature where practical.
- Ignore browser filenames and generate randomized object names.
- Reject traversal and client-selected object keys.
- Never store image blobs in PostgreSQL.
- Never expose the service-role key to browser code, actions, routes, DTOs, errors, logs, CI, or support output.

Replacement ordering:

1. Upload the new randomized object.
2. Confirm upload completion.
3. Update the database reference.
4. Delete the previous object only after the database update succeeds.
5. If the database update fails, retain the old object and best-effort remove only the new object.
6. If old-object deletion fails after a successful database update, keep the new reference and record a safe cleanup warning.

Do not provision, inspect, or modify either bucket as part of this documentation workflow.

## 11. Approved production schema-change sequence

Use this sequence only after Daniel approves the specific change.

### Before the change

1. Confirm the reviewed application commit and schema requirement.
2. Confirm the approved production SQL artifact and checksum/revision.
3. Confirm organization, project name, project reference, provider hostname, database name, PostgreSQL version, and expected SQL Editor `current_user = postgres`.
4. Verify and record a current restore point.
5. Run read-only preflight against only the approved target.
6. Compare every affected table, column, enum, index, foreign key, and constraint with the expected shape.
7. Confirm the SQL contains no prohibited destructive statement, including `ON DELETE CASCADE`.
8. Confirm one explicit transaction with `lock_timeout` and `statement_timeout` where supported.
9. Show Daniel the exact SQL and expected result in plain language.

### Apply the change

1. Use the explicitly verified production Supabase Dashboard SQL Editor for the exact reviewed artifact, unless Daniel separately approves another protected workflow.
2. Apply only the reviewed artifact and transaction envelope.
3. Do not run Prisma migration or schema commands against production.
4. Do not apply unrelated repairs in the same session.
5. If any statement errors, roll back the entire transaction and record the error.
6. Record the provider result and execution timestamp.
7. If the result differs from expectation, stop and report the new timestamped state.

### After the change

1. Re-run read-only catalog verification.
2. Verify every new table, column, enum, index, foreign key, and deterministic taxonomy row.
3. Confirm no unrelated object changed.
4. Confirm `_prisma_migrations` was not created or modified.
5. Deploy application code only after the required schema exists.
6. Verify affected application flows.
7. Inspect logs for schema errors such as `P2022` and affected object names.
8. Record restore point, preflight, SQL revision, result, postflight, application revision, URL, and log timestamps.

## 12. Design Templates deployment sequence

### Non-production QA before production

1. Merge this documentation PR, including the reviewed root `AGENTS.md` companion update.
2. Provision and verify the staging bucket with public-read/no-listing/no-public-write policy and configure staging variables only through the approved non-production secret store.
3. Replay the complete migration history plus the reviewed Design Templates migration on a disposable database.
4. Deploy PR1 and PR2 to approved staging with the flag false.
5. Temporarily enable the separate staging flag through staging admin settings.
6. Run member QA without production accounts or data: eligible PRO, effective-PRO organization member without an individual Stripe subscription, comped PRO, Calendar Only denial, blocked-account denial, admin management/preview, thumbnails, URL validation, usage recording, and Canva redirect.
7. Disable the staging flag again and record QA results.

### Production rollout

8. Prepare and review the separate production SQL artifact. Do not use Prisma migration commands.
9. Verify production target identity, restore point, and read-only schema preflight.
10. Apply exact additive SQL manually through the verified Supabase Dashboard SQL Editor using the reviewed transaction envelope.
11. Verify production schema/catalog and confirm `designTemplatesEnabled` remains false.
12. Provision and verify `design-template-thumbnails-production` with public-read/no-listing/no-public-write policy.
13. Configure production `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DESIGN_TEMPLATES_STORAGE_BUCKET` only through the approved provider-managed encrypted secret store. Never copy the value into local agents, scripts, shells, files, CI logs, or browser code.
14. Deploy PR1. Verify admin upload, replacement ordering, fallback, cleanup-warning behavior, URL validation, and lifecycle operations while member access is disabled.
15. Deploy PR2 only after PR1 schema/admin/Storage verification succeeds. Keep the production flag false.
16. Run production smoke QA with the flag false, including safe denial pages and checking that member DTOs contain no Canva URL.
17. After both PRs and member QA pass, have an authenticated, authorized administrator set the flag true through admin settings. This is an expected application write and requires no separate manual SQL.
18. Record the settings change and verify eligible PRO, effective-PRO organization, comped PRO, global admin, Calendar Only denial, and blocked-account denial.

## 13. Rollback and feature disable

- Set `designTemplatesEnabled` to `false` to block member browse/open access.
- Archive an invalid individual template.
- Roll back application code while leaving additive schema objects in place.
- Preserve templates, taxonomy rows, thumbnails, and anonymized usage evidence.
- Repair URLs or thumbnails through admin workflow.

Do not reverse migrations, drop objects, delete usage history, reset production, or alter migration history. Database restore is a separately approved emergency operation requiring a verified restore point and this runbook's complete preflight.

## 14. Incident procedure

Stop and report the new timestamped error before proposing another operation if:

- Target identity is not exactly approved.
- Restore point cannot be verified.
- Preflight finds unexpected drift.
- SQL result differs from expectation.
- An operation requests destructive behavior.
- A service-role credential appears in browser code, output, or logs.
- The application reports a new schema error.
- Draft, archived, raw-URL, or unauthorized Template access is observed.

Record only the sanitized environment/identity, timestamp, artifact revision, safe error category, and last successful verification. Never record credentials, full connection strings, Canva destinations, user emails, IP addresses, or other sensitive data.

## 15. PR0 committed documentation changes

PR0 must update the committed repository-root `AGENTS.md` together with this runbook. The root `AGENTS.md` update must:

- Link to `PRODUCTION_DATABASE_RUNBOOK.md`.
- State that Prisma migration and database commands are allowed only after proving the datasource is disposable local or explicitly approved staging.
- Classify Prisma commands as this runbook does.
- Explicitly prohibit all Prisma database/schema commands against production or unknown datasources, while allowing local schema-only validation/format/generation without production credentials and with safe environment values.
- Preserve the unbaselined-production and migration-history prohibitions.
- Require this runbook's approval, backup/restore-point, target-verification, reviewed-SQL, transaction, and postflight process.
- Preserve all existing unrelated repository instructions.

This file and the root `AGENTS.md` update are documentation-only. They must not modify application code, Prisma schema, migrations, databases, Supabase projects, Storage, environment variables, diagnostic files, or announcements.

## 16. Change record template

For every approved production schema change, record:

```text
Change:
Reason:
Application commit:
Schema/migration artifact revision:
Production SQL artifact revision/checksum:
Approved by:
Approval timestamp:
Supabase organization:
Supabase project name:
Supabase project reference:
Provider hostname:
Database name:
Database user/current_user:
Environment/project:
PostgreSQL version:
Restore-point identifier:
Restore-point verification timestamp:
Read-only preflight result:
Exact SQL result:
Post-change catalog verification:
Application verification URL:
Application/log verification timestamps:
Rollback or feature-disable path:
Operator notes:
```

Do not fill this template with secrets or identifying user data.
