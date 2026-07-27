# Security Protocols — The Local Post

**Last updated:** July 27, 2026 (Tertiary audit)
**Audit status:** Primary, secondary, and tertiary audit completed. All critical, high, and medium findings remediated.

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [Authorization & Access Control](#2-authorization--access-control)
3. [Data Protection & Privacy](#3-data-protection--privacy)
4. [Input Validation & Injection Prevention](#4-input-validation--injection-prevention)
5. [API Route Security](#5-api-route-security)
6. [Webhook Security](#6-webhook-security)
7. [Third-Party Integrations](#7-third-party-integrations)
8. [Environment Variables & Secrets](#8-environment-variables--secrets)
9. [HTTP Security Headers](#9-http-security-headers)
10. [Rate Limiting & Abuse Prevention](#10-rate-limiting--abuse-prevention)
11. [Account Deletion & Data Erasure](#11-account-deletion--data-erasure)
12. [Database Security](#12-database-security)
13. [Audit Logging](#13-audit-logging)
14. [Incident Response](#14-incident-response)
15. [Security Audit Findings & Remediations](#15-security-audit-findings--remediations)

---

## 1. Authentication & Session Management

### Password Storage

- Passwords are hashed using **bcrypt** with a cost factor of **12** (2^12 rounds).
- Plaintext passwords are never stored, logged, or returned to the client after account creation.
- Password validation requires minimum 8 characters, at least one letter, and one number.

### Session Strategy

- **NextAuth v5** with **JWT strategy** (stateless, no server-side session store).
- JWT `maxAge`: 30 days. JWT is signed with `AUTH_SECRET`.
- Session cookies are **httpOnly**, **secure** (in production), and **sameSite=lax**.
- `trustHost: true` is set — ensure reverse proxy sanitizes Host headers in production.

### Token Versioning & Forced Logout

- Every user has a `tokenVersion` integer in the database.
- Password resets increment `tokenVersion`. The JWT callback detects version mismatch and invalidates the token immediately.
- This ensures that a password change forces logout on all existing sessions.

### Session Expiry

- Custom `sessionExpiry` timestamp stored in the JWT.
- The `authorized` callback in `authConfig` checks expiry on every protected route access via the shared `isSessionExpired()` helper.
- **`sessionExpiry = 0` is treated as expired** (not as "no expiry") — prevents revoked tokens from remaining valid (fail-closed fix).
- The `session` callback strips `user.id` when expired, preventing authenticated actions.
- The `jwt` callback refreshes `role`, `plan`, `accountStatus`, and `tokenVersion` from the database on every token creation, ensuring revocations take effect immediately.

### Login Rate Limiting

- Login attempts are rate limited: **5 failed attempts per email** within a **15-minute window** triggers a lockout.
- Lockout duration: 15 minutes. Retry time is formatted and returned to the user.
- Rate limit state is persisted in the database using serializable transactions.

### Password Reset

- Reset tokens are **32-byte cryptographically random** values (`randomBytes(32)`).
- Tokens are **SHA-256 hashed at rest** — the plaintext token is never persisted to the database (fixed in tertiary audit).
- Tokens expire after **1 hour**.
- Tokens are **single-use** — consumed atomically via `deleteMany` with `expiresAt` guard in a transaction, preventing race-condition reuse.
- Existing tokens for an email are deleted before creating a new one (no concurrent valid tokens).
- Rate limited: **3 attempts per email** and **10 per IP/client** per hour.
- The API does **not reveal** whether an email exists in the system (always returns success).
- Token hashing and consumption logic centralized in `src/lib/password-reset-tokens.ts`.

### Registration

- Registration is **invite-only**. Users cannot self-register without a valid invite token.
- Invite tokens are **32-byte cryptographically random** values.
- Tokens expire after **7 days** (team invites) or **24 hours** (admin onboarding invites).
- The `ADMIN` role **cannot** be assigned via invite token — it is blocked at the registration layer.
- Token deletion and user creation happen in a **single transaction** to prevent token reuse.

---

## 2. Authorization & Access Control

### Role-Based Access Control (RBAC)

Three roles exist in the system:

| Role | Description | Access |
|------|-------------|--------|
| `USER` | Standard client | Dashboard, calendar, analytics, integrations (plan-dependent) |
| `TEAM_ADMIN` | Organization manager | All USER access + team management for their org |
| `ADMIN` | Global platform admin | All access + admin panel, user management, org management |

### Route Protection

- **Middleware** (`src/proxy.ts`): Protects `/dashboard/*`, `/onboarding/*`, and `/admin/*` paths.
- The `authorized` callback in `authConfig` enforces:
  - `/admin/*` requires `ADMIN` role and non-expired session.
  - `/dashboard/*` and `/onboarding/*` require authentication and non-expired session.
  - Expired sessions are redirected to `/login`.

### Server Action Authorization

Every server action checks authorization before executing:

- **Dashboard actions**: Use `requireDashboardAccess()` which verifies:
  1. Session exists and user is authenticated.
  2. User exists in the database.
  3. User's plan/role meets the required tier (e.g., `PRO` for analytics).
  4. Optional `expectedUserId` check ensures users can only act on their own data.

- **Admin actions**: All check `session?.user?.role === "ADMIN"`.
- **Team admin actions**: Use `requireTeamAdmin()` which calls `requireTeamAdminOrganization()` to verify the user is a `TEAM_ADMIN` with an active organization.

### Organization Data Isolation

- Team admin operations verify target user belongs to the **same organization** from the database, not from client input.
- Seat limit enforcement uses database transactions with re-checks inside the transaction to prevent race conditions.
- `removeTeamMember` verifies the target is a `USER` (not another admin) and belongs to the same org.
- `transferTeamAdmin` verifies the target is in the same org, is not a global admin, and is not archived.

### Plan-Based Feature Gating

- `CALENDAR_ONLY` plan: Calendar access only. Analytics and integrations are locked.
- `PRO` plan: Full access including analytics, integrations, and AI features.
- Plan is checked server-side via `requireDashboardAccess({ requiredPlan: "PRO" })`.
- Plan defaults to `CALENDAR_ONLY` on JWT refresh failure (fail-closed principle).

---

## 3. Data Protection & Privacy

### Data Minimization

- Database queries use **selective field projection** (`select: { ... }`) to avoid fetching sensitive fields unnecessarily.
- The `password` field is only fetched when needed (login, account deletion, admin reset).
- API responses never include password hashes, Stripe customer IDs, or other sensitive internal fields.

### User Data Isolation

- All user-scoped database queries filter by `userId` derived from the **session**, never from client input.
- Calendar, analytics, questionnaires, surveys, push subscriptions, and Brand Brain memories are all scoped to `session.user.id`.
- Settings updates verify `existing.userId === userId` before allowing edits.

### Social Account Data

- Zernio OAuth tokens are stored as `ZernioAccount` records scoped to `(userId, platform)` with a unique constraint.
- The OAuth state token is **SHA-256 hashed** before storage — the plaintext token is never persisted.
- State tokens have a **10-minute TTL** and are **single-use** (consumed atomically via transaction).
- State tokens are **user-bound** — the `userId` is verified during consumption.

### Email Unsubscribe

- Unsubscribe links use signed tokens containing `userId` and `email`, signed with HMAC-SHA256.
- Token separator is `|` (pipe) — not `.` — to avoid collision with dots in email addresses (fixed in tertiary audit).
- Token verification uses `timingSafeEqual` for signature comparison.
- Signing secret is `UNSUBSCRIBE_SECRET` with fallback to `AUTH_SECRET`.
- Token verification checks both the signature and that the email matches the current user record.
- Unsubscribe is idempotent (returns success if already unsubscribed).

### Sensitive Data in Client

- The JWT token contains `role`, `plan`, `accountStatus`, and `sessionExpiry` — all non-sensitive operational data.
- No passwords, Stripe secrets, or API keys are ever sent to the client.
- Bulk invite results **no longer include plaintext passwords** — passwords are generated server-side and users set their own via email link (fixed in tertiary audit).
- Admin-generated passwords for single invite accounts are returned to the admin UI for manual sharing — this is the only exception, and it is by design for the invite flow.

---

## 4. Input Validation & Injection Prevention

### Server-Side Validation

- **Zod schemas** validate questionnaire data via `validateQuestionnaire()`.
- **Manual validation** for structured inputs (purchaseType, billingInterval, seats, survey types).
- **Survey answer validation**: Keys limited to 100 chars, values to 5000 chars, max 50 keys per survey.
- **Email normalization**: All emails are trimmed and lowercased before database operations.

### SQL Injection Prevention

- **Prisma ORM** is used exclusively for database access — no raw SQL queries.
- Prisma parameterizes all queries automatically.
- The `zernio.analytics.getAccountAnalytics` method validates the `path` parameter against `^[a-z0-9-]+$` to prevent path traversal.

### XSS Prevention

- **CSP headers** restrict script sources (see [HTTP Security Headers](#9-http-security-headers)).
- **X-Frame-Options: DENY** prevents clickjacking.
- Bug report descriptions use `escapeHtml()` before insertion into email HTML.
- React automatically escapes all interpolated values.
- **Login announcement HTML** is sanitized via `sanitize-html` on both write (`login-actions.ts`) and read (`login-queries.ts`) to prevent stored XSS from admin-authored rich text rendered with `dangerouslySetInnerHTML`. Sanitization helper at `src/lib/sanitize.ts`.

### Path Traversal Prevention

- API route parameters are validated against whitelists (e.g., platform names, survey types).
- The Zernio API wrapper validates path segments with regex before URL construction.
- File-based operations use Prisma-stored data, not user-supplied file paths.

---

## 5. API Route Security

### Authentication Requirements

| Route | Auth Required | Method |
|-------|--------------|--------|
| `/api/stripe/checkout` | Session (USER) | POST |
| `/api/stripe/public-checkout` | None (public) | POST |
| `/api/stripe/cancel` | Session (USER) | POST |
| `/api/stripe/portal` | Session (USER/TEAM_ADMIN) | POST |
| `/api/stripe/switch-to-solo` | Session (TEAM_ADMIN) | POST |
| `/api/stripe/webhook` | Stripe signature | POST |
| `/api/zernio/connect` | Session (PRO plan) | GET |
| `/api/zernio/callback` | Session (PRO plan) | GET |
| `/api/zernio/webhook` | HMAC signature | POST |
| `/api/github/webhook` | HMAC signature | POST |
| `/api/account/delete` | Session + password | POST |
| `/api/cron/*` | Bearer token (CRON_SECRET) | GET |
| `/api/user/onboarding-status` | Session | GET |

### Price ID Injection Prevention

- Stripe checkout routes **never accept price IDs from the client**.
- The server maps `purchaseType` + `billingInterval` to env-configured price IDs via `getPriceId()`.
- This prevents users from submitting arbitrary Stripe price IDs.

### Subscription Hijacking Prevention

- Users with active subscriptions are blocked from creating new checkout sessions.
- Admin and comped users are protected from Stripe webhook-driven plan/status changes.
- Subscription cancellation requires the authenticated user's own subscription ID (or org subscription for TEAM_ADMIN).

---

## 6. Webhook Security

### Stripe Webhooks

- **Signature verification**: `stripe.webhooks.constructEvent()` verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`.
- **Idempotency**: Each event is claimed using a unique `claimToken` in a database transaction. Duplicate events return `409 Conflict`.
- **Lease expiry**: Claimed events that fail to process are released after a timeout for retry.
- **Protected users**: Admin and comped users are never modified by webhook events.

### Zernio Webhooks

- **HMAC-SHA256 signature verification** using `timingSafeEqual` for timing-safe comparison.
- Signature is read from `x-zernio-signature` or `x-hub-signature-256` headers.
- User lookup is performed by `zernioAccountId` or `zernioProfileId` — no user-controlled data is trusted without database verification.
- Events for unknown users return `200 OK` with a message (don't reveal user existence).

### GitHub Webhooks

- **HMAC-SHA256 signature verification** using `timingSafeEqual`.
- Signature is read from `x-hub-signature-256` header.
- Only `push` events are processed; all others are ignored.
- Commit deduplication via unique `gitSha` constraint prevents duplicate changelog entries.

### Cron Endpoints

- All three cron routes (`billing`, `notifications`, `broadcasts`) verify a `Bearer` token against `CRON_SECRET`.
- All use **`timingSafeEqual`** for timing-safe comparison with **length equality checks** before comparison (fixed in this audit).
- The `processDueBroadcasts` server action in `src/app/admin/announcements/actions.ts` also uses `timingSafeEqual` with length check.
- Missing secret or header returns `401` without revealing which is missing.

---

## 7. Third-Party Integrations

### Stripe

- API key stored in `STRIPE_SECRET_KEY` environment variable, never exposed to client.
- Webhook secret in `STRIPE_WEBHOOK_SECRET`, used for signature verification.
- Checkout sessions are created server-side with server-mapped price IDs.
- Customer portal disables subscription updates (seat changes go through reconciliation flow).
- Subscription cancellation uses `cancel_at_period_end` to preserve access until billing period ends.

### Zernio

- API key stored in `ZERNIO_API_KEY` environment variable, fetched via `getZernioApiKey()`.
- All Zernio API calls use Bearer token authentication, server-side only.
- OAuth flow uses state tokens (SHA-256 hashed, 10-minute TTL, single-use, user-bound).
- Account deletion on Zernio's side is attempted before DB cascade removes our records.

### Resend (Email)

- API key in `RESEND_API_KEY`, never exposed to client.
- From address configured via `RESEND_FROM_EMAIL`.
- Used for: onboarding emails, password resets, team invites, bug report notifications, account status changes.

### Anthropic (Claude AI)

- API key in `ANTHROPIC_API_KEY` (or platform config), fetched server-side via `getAnthropicApiKey()`.
- AI calls are made server-to-server only.
- Rate limited: 10 insight generations per user per hour, 5 calendar generations per user per 10 minutes.
- User content sent to Anthropic includes: post analytics, questionnaire data, survey answers, follower stats, demographics. No passwords, emails, or Stripe data are included in AI prompts.

---

## 8. Environment Variables & Secrets

### Secret Management

| Variable | Purpose | Exposed to Client? |
|----------|---------|-------------------|
| `AUTH_SECRET` | JWT signing | No |
| `STRIPE_SECRET_KEY` | Stripe API | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | No |
| `ZERNIO_API_KEY` | Zernio API | No |
| `ZERNIO_WEBHOOK_SECRET` | Zernio webhook verification | No |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook verification | No |
| `GITHUB_TOKEN` | GitHub API (changelog) | No |
| `CRON_SECRET` | Cron endpoint auth | No |
| `RESEND_API_KEY` | Email sending | No |
| `RESEND_FROM_EMAIL` | From address | No |
| `ANTHROPIC_API_KEY` | Claude AI | No |
| `VAPID_PRIVATE_KEY` | Web push signing | No |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push client | Yes (by design) |
| `NEXT_PUBLIC_APP_URL` | App URL | Yes (by design) |
| `NEXT_PUBLIC_VAPID_SUBJECT` | Push subject | Yes (by design) |

### Secret Hygiene

- Only `NEXT_PUBLIC_*` variables are exposed to the client. These are non-sensitive by design (VAPID public key, app URL).
- All sensitive secrets are accessed only in server-side code (API routes, server actions).
- The `.env.local` file is in `.gitignore` and never committed.
- No secrets are hardcoded in source code.
- No secrets are logged in error messages (errors are logged with context, not secret values).

---

## 9. HTTP Security Headers

### Content-Security-Policy

```
default-src 'self';
script-src 'self' [production: no unsafe-inline/eval] [dev: 'unsafe-inline' 'unsafe-eval'];
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: https: blob:;
connect-src 'self' https://api.anthropic.com https://api.resend.com https://zernio.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
upgrade-insecure-requests;
```

**Production** removes `'unsafe-inline'` and `'unsafe-eval'` from `script-src`. **Development** keeps them for HMR.

### Other Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `X-DNS-Prefetch-Control` | `on` | DNS prefetch control |

### CORS

- No explicit CORS configuration — API routes default to same-origin.
- The CSP `connect-src` restricts outbound connections to `self`, Anthropic, Resend, and Zernio.
- No `Access-Control-Allow-Origin: *` is set anywhere.

---

## 10. Rate Limiting & Abuse Prevention

### Rate Limit Implementation

- Custom rate limiter in `src/lib/rate-limiter.ts` using Prisma with **serializable transactions**.
- Rate limit state is persisted in the `RateLimitBucket` table (survives server restarts).
- Sliding window algorithm with configurable `maxRequests` and `windowMs`.

### Rate Limited Endpoints

| Action | Key | Limit | Window |
|--------|-----|-------|--------|
| Login attempts | `login:{email}` | 5 attempts | 15 minutes |
| Password reset (per email) | `reset:account:{email}` | 3 attempts | 1 hour |
| Password reset (per client) | `reset:client:{ip}` | 10 attempts | 1 hour |
| AI insight generation | `ai_insight:{userId}` | 10 requests | 1 hour |
| Calendar generation | `calendar_gen:{userId}` | 5 requests | 10 minutes |
| Public Stripe checkout | `public_checkout:{ip}` | 5 requests | 10 minutes |

### Brute Force Protection

- Login lockout: 5 failed attempts triggers 15-minute lockout per email.
- Password reset: dual-layer rate limiting (per-email + per-IP) prevents both targeted and broad enumeration.
- Lockout state is persisted in the database — restarting the server doesn't clear lockouts.

---

## 11. Account Deletion & Data Erasure

### User-Initiated Deletion

- Requires **authenticated session** + **password confirmation** (bcrypt-verified).
- Requires typing "DELETE" in a confirmation modal (client-side UX safeguard).
- `TEAM_ADMIN` users must transfer admin role before deletion.
- `ADMIN` users cannot self-delete.

### Deletion Process

1. Verify password with `bcrypt.compare`.
2. Cancel Stripe subscription immediately (if any).
3. Delete Zernio accounts on Zernio's side (external API calls).
4. Clean up invite tokens associated with the user's email.
5. Delete the user record — Prisma cascade deletes automatically remove:
   - Questionnaires, calendars, content archives
   - Social tokens, Zernio accounts
   - Post analytics, follower stats, deep analytics
   - Brand Brain memories, calendar generation logs
   - Push subscriptions, notification preferences/logs
   - Bug reports, profile surveys
   - Best time to post data
6. `AdminMessage` and `ScheduledPushNotification` relations are `SetNull` (preserved but unlinked).
7. Organization relation is `SetNull` (user leaves the org).

### Admin-Initiated Deletion

- Requires `ADMIN` role.
- Admin cannot delete their own account.
- Same Stripe cancellation, Zernio cleanup, and cascade deletion as user-initiated.
- Errors during external service deletion (Stripe, Zernio) are logged but don't block DB deletion.

### Data Retention

- Deleted user data is **permanently removed** via Prisma cascade deletes.
- No soft deletes, no backups of individual user data beyond database-level backups.
- Admin messages and scheduled push notifications created by the user are preserved (unlinked) for platform integrity.

---

## 12. Database Security

### ORM Usage

- **Prisma 5** with PostgreSQL (Supabase) — all database access goes through Prisma's parameterized queries.
- No raw SQL queries in the codebase — eliminates SQL injection risk.
- Prisma schema defines strict types and relations.

### Data Isolation

- All user-scoped queries filter by `userId` from the session.
- Organization-scoped queries filter by `organizationId` from the database (not client input).
- Team admin operations verify target membership in the same organization before acting.

### Cascade Deletes

- User deletion cascades to all user-owned data (questionnaires, calendars, analytics, etc.).
- `SetNull` relations preserve platform-level data (admin messages) while removing the user link.
- This ensures complete data erasure on account deletion without orphaned records.

### Transaction Usage

- Critical operations use `$transaction`:
  - User creation + invite token deletion (registration)
  - Organization creation + admin assignment
  - Seat limit enforcement (re-check inside transaction)
  - Integration state token consumption (atomic update + read)
  - Team admin transfer (both role changes succeed or neither does)

---

## 13. Audit Logging

### Console Logging

All security-relevant operations log to the console with structured prefixes:

- `[ACCOUNT DELETE]` — Account deletion steps (Stripe, Zernio, DB)
- `[ADMIN DELETE USER]` — Admin-initiated user deletion
- `[STRIPE CHECKOUT]` — Checkout session creation failures
- `[STRIPE CANCEL]` — Subscription cancellation failures
- `[STRIPE PORTAL]` — Portal session creation failures
- `[PASSWORD RESET]` — Reset email sending failures
- `[ONBOARDING EMAIL]` — Onboarding email failures
- `[CRON BROADCASTS]` — Cron job failures
- `[SIGNUP NOTIFICATION]` — Signup notification failures
- `[BUG REPORT]` — Bug report email failures

### Stripe Event Tracking

- Every Stripe webhook event is stored in the `StripeEvent` table with:
  - Event ID, type, status (PROCESSING, SUCCEEDED, FAILED)
  - Claim token, processed timestamp, last error
  - This provides a full audit trail of subscription lifecycle events.

---

## 14. Incident Response

### Recommended Steps

1. **Identify**: Check console logs for error prefixes. Check StripeEvent table for webhook failures.
2. **Contain**: Disable affected user accounts via admin panel (set `accountStatus` to `ARCHIVED`).
3. **Investigate**: Review database logs, Stripe dashboard, Zernio dashboard for unauthorized access.
4. **Remediate**: Rotate affected secrets (`AUTH_SECRET`, `STRIPE_SECRET_KEY`, `ZERNIO_API_KEY`, `CRON_SECRET`).
5. **Notify**: If user data is compromised, notify affected users within 72 hours per GDPR requirements.
6. **Document**: Record the incident, root cause, and remediation steps.

### Secret Rotation

All secrets can be rotated by updating `.env.local` and restarting the server:

- `AUTH_SECRET`: Rotating invalidates all existing JWT sessions (all users must re-login).
- `STRIPE_SECRET_KEY`: Update in Stripe dashboard, then update env. Old key stops working immediately.
- `STRIPE_WEBHOOK_SECRET`: Update webhook endpoint in Stripe dashboard, then update env.
- `ZERNIO_API_KEY`: Regenerate in Zernio dashboard, then update env.
- `CRON_SECRET`: Generate new value, update env and cron job configuration simultaneously.
- `RESEND_API_KEY`: Regenerate in Resend dashboard, then update env.

---

## 15. Security Audit Findings & Remediations

### Completed Remediations (July 2026 — Primary Audit)

| # | Severity | Finding | Status | Fix |
|---|----------|---------|--------|-----|
| 1 | CRITICAL | Cron routes `notifications` and `broadcasts` used `===` for secret comparison (timing attack) | **Fixed** | Replaced with `timingSafeEqual` |
| 2 | CRITICAL | Account deletion had no password confirmation (session hijack = permanent data loss) | **Fixed** | Added bcrypt password verification + password input in UI modal |
| 3 | HIGH | `generateAIInsight` had no rate limiting (API cost abuse) | **Fixed** | Added 10 requests/hour rate limit |
| 4 | HIGH | Public Stripe checkout had no rate limiting (DoS via Stripe API) | **Fixed** | Added 5 requests/10 min IP-based rate limit |
| 5 | HIGH | CSP allowed `'unsafe-eval'` and `'unsafe-inline'` in production | **Fixed** | Removed both in production; added `object-src 'none'` and `upgrade-insecure-requests` |
| 6 | HIGH | JWT plan defaulted to `PRO` on refresh failure (fail-open) | **Fixed** | Changed default to `CALENDAR_ONLY` (fail-closed) |
| 7 | MEDIUM | `zernio.analytics.getAccountAnalytics` passed raw path to URL (potential path injection) | **Fixed** | Added `^[a-z0-9-]+$` regex validation |

### Completed Remediations (July 2026 — Secondary Audit)

| # | Severity | Finding | Status | Fix |
|---|----------|---------|--------|-----|
| 8 | HIGH | Unsubscribe token verification used `!==` for signature comparison (timing attack) | **Fixed** | Replaced with `timingSafeEqual` in `src/lib/unsubscribe.ts` |
| 9 | MEDIUM | `processDueBroadcasts` used `!==` for CRON_SECRET comparison (timing attack) | **Fixed** | Replaced with `timingSafeEqual` in `src/app/admin/announcements/actions.ts` |
| 10 | MEDIUM | `getNotificationPrefsForUser` server action had no auth check (data isolation) | **Fixed** | Added `auth()` session check in `src/app/dashboard/notifications/preferences-actions.ts` |
| 11 | MEDIUM | `updateNotificationPrefs` passed raw object to Prisma without field validation | **Fixed** | Added `PREF_KEYS` whitelist + boolean type checking before upsert |
| 12 | LOW | Profile name update had no max length validation | **Fixed** | Added 100-char max in `src/app/api/user/profile/route.ts` |
| 13 | LOW | `update-seats` route didn't validate against active member count when removing seats | **Fixed** | Added active member count check in `src/app/api/stripe/update-seats/route.ts` |
| 14 | LOW | Admin invite flow returned plaintext password to client UI | **Fixed** | Removed password from `createClientProfile` return value; removed password display + copy button from `InviteClientButton.tsx` |

### Completed Remediations (July 2026 — Tertiary Audit)

| # | Severity | Finding | Status | Fix |
|---|----------|---------|--------|-----|
| 15 | HIGH | Unsubscribe token used `.` separator — collided with dots in email addresses, causing verification to always fail | **Fixed** | Changed separator to `|` (pipe) in `src/lib/unsubscribe.ts`; added `AUTH_SECRET` fallback when `UNSUBSCRIBE_SECRET` is unset |
| 16 | HIGH | Encryption detection used base64-length heuristic — misclassified plaintext API keys as already-encrypted, causing silent key loss | **Fixed** | Replaced heuristic with explicit `enc:v1:` ciphertext prefix in `src/lib/crypto.ts`; `isEncrypted()` now checks for prefix |
| 17 | HIGH | `sessionExpiry = 0` (revoked token) was treated as "no expiry" instead of expired — fail-open bug | **Fixed** | Added `isSessionExpired()` helper in `src/auth.config.ts` that treats `0` as expired; used in both `authorized` and `jwt` callbacks |
| 18 | HIGH | `getNotificationPrefsForUser` allowed any authenticated user to read any other user's notification preferences (IDOR) | **Fixed** | Restricted to self or `ADMIN` role in `src/app/dashboard/notifications/preferences-actions.ts` |
| 19 | HIGH | Push subscription upsert didn't verify endpoint ownership — attacker could hijack another user's push endpoint | **Fixed** | Added ownership check: if endpoint exists, verify `userId` matches before upsert in `src/app/dashboard/actions.ts` |
| 20 | HIGH | Password reset tokens stored in plaintext and consumed non-atomically — database leak exposed tokens, race condition allowed reuse | **Fixed** | Tokens now SHA-256 hashed at rest via `src/lib/password-reset-tokens.ts`; consumption is atomic (`deleteMany` with `expiresAt` guard in transaction) |
| 21 | HIGH | Login announcement HTML rendered with `dangerouslySetInnerHTML` without sanitization — stored XSS | **Fixed** | Added `sanitize-html` sanitization on write (`src/app/admin/announcements/login-actions.ts`) and read (`src/app/admin/announcements/login-queries.ts`); helper at `src/lib/sanitize.ts` |
| 22 | MEDIUM | Cron server action `timingSafeEqual` lacked length check — could throw on mismatched-length inputs | **Fixed** | Added `Buffer.length` equality check before `timingSafeEqual` in `src/app/api/cron/broadcasts/route.ts` and `src/app/admin/announcements/actions.ts` |
| 23 | MEDIUM | Bulk invite returned plaintext passwords in admin UI response | **Fixed** | Removed password from bulk invite result objects in `src/app/admin/actions.ts`; admin sees only email + success status |

### Remaining Recommendations (Lower Priority)

| # | Severity | Finding | Recommendation |
|---|----------|---------|----------------|
| 15 | MEDIUM | `trustHost: true` in NextAuth | Set `NEXTAUTH_URL` explicitly in production and remove `trustHost` |
| 16 | MEDIUM | No CSRF token for API routes (JWT in cookie could be sent cross-site) | Add origin/referer checking for state-changing API routes |
| 17 | LOW | `seedPostAnalytics` accessible in development | Low risk — dev-only, data marked `isDemo` |
| 18 | LOW | `require("crypto")` inside function in github.ts | Use top-level import |
| 19 | LOW | Zernio webhook `GET` endpoint is unauthenticated | Returns only status info — low risk, consider adding auth |

### Security Strengths Identified

- **bcrypt cost 12** for password hashing
- **Token versioning** for forced session invalidation
- **Timing-safe comparisons** with length checks for all webhook signatures, cron secrets, and unsubscribe tokens
- **SHA-256 hashed password reset tokens** at rest with atomic single-use consumption
- **Explicit ciphertext prefix** (`enc:v1:`) for encryption detection — no heuristic-based false positives
- **HTML sanitization** on login announcements (write + read) to prevent stored XSS
- **Push subscription ownership verification** prevents endpoint hijacking
- **IDOR protection** on notification preferences (self or admin only)
- **SHA-256 hashed OAuth state tokens** with TTL and single-use enforcement
- **Server-mapped Stripe price IDs** (client cannot inject arbitrary prices)
- **Idempotent Stripe webhook processing** with claim tokens and lease expiry
- **Comprehensive rate limiting** on login, password reset, AI actions, public checkout, and calendar generation
- **Input validation** on notification preferences (field whitelist + type checking), profile names (max length), and seat updates (active member count check)
- **Cascade deletes** ensure complete data erasure on account deletion
- **Organization data isolation** verified from database, not client input
- **Transaction-wrapped critical operations** prevent inconsistent state
- **Strict CSP** with frame-ancestors none, base-uri self, form-action self
- **HSTS** with 2-year max-age, includeSubDomains, preload
- **Invite-only registration** with ADMIN role blocked at registration layer
- **Password reset** doesn't reveal email existence
- **Selective field projection** in all database queries

---

## Compliance Notes

### GDPR / CCPA Alignment

- **Right to Access**: Users can view all their data through the dashboard (analytics, calendars, surveys, Brand Brain).
- **Right to Erasure**: Account deletion permanently removes all user data via cascade deletes. External service data (Zernio) is also deleted.
- **Data Minimization**: Only necessary data is collected (questionnaire, survey answers, analytics from connected accounts).
- **Consent**: Users explicitly connect social accounts via OAuth with clear UI indication of what data is accessed.
- **Email Unsubscribe**: Users can unsubscribe from emails via signed token links without logging in.

### SOC 2 Readiness

- **Access Controls**: Role-based access with server-side enforcement on every action.
- **Audit Trails**: Stripe events tracked in database. Console logging for all security-relevant operations.
- **Data Encryption**: HTTPS enforced via HSTS. Database encryption managed by Supabase (PostgreSQL).
- **Incident Response**: Documented process for identification, containment, and remediation.
- **Secret Management**: All secrets in environment variables, never in source code, rotatable without code changes.

---

*This document is maintained as part of the The Local Post codebase and should be updated whenever security-relevant changes are made.*
