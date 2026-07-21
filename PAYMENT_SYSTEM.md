# The Local Post — Payment System

> Last updated: July 2026
> Status: Full subscription lifecycle — checkout, portal, cancel, delete, switch-to-solo, seat management, admin transfer with billing handoff, webhook idempotency, public checkout flow

---

## 1. Overview

The Local Post uses Stripe for subscription billing. Two public membership products:

- **Solo Membership** — flat monthly ($200/mo) or annual ($1,999/yr) pricing for individual creators
- **Communities Membership** — seat-based graduated pricing for teams/organizations, billed monthly or annually (min 2 seats)

Both memberships map to the internal `PRO` plan. The internal `UserPlan` enum (`CALENDAR_ONLY`, `PRO`) is used for admin and feature-gating purposes but is never shown to users. `CALENDAR_ONLY` is an internal-only access level (admin-assigned, comped, or KW Legacy). `PRO` is the only purchasable plan.

### Public vs Internal Labels

| Internal `UserPlan` | Public Label (`PUBLIC_PLAN_LABELS`) | Admin Label (`ADMIN_PLAN_LABELS`) |
|---|---|---|
| `CALENDAR_ONLY` | Calendar Access | Calendar Only (Admin-Assigned) |
| `PRO` | Full Access | Pro (Full Access) |

---

## 2. Stripe Products & Prices

### Product: The Local Post — Solo

| Lookup Key | Price | Billing | Stripe Type |
|---|---|---|---|
| `tlp_solo_monthly` | $200.00/mo | monthly | `per_unit`, `licensed` |
| `tlp_solo_annual` | $1,999.00/yr | yearly | `per_unit`, `licensed` |

### Product: The Local Post — Communities

Graduated seat-based pricing. `billing_scheme=tiered`, `tiers_mode=graduated`, `usage_type=licensed`.

#### Monthly Tiers

| Seats | Per-Seat Price |
|---|---|
| Seat 1 | $200/mo |
| Seats 2–4 | $150/mo each |
| Seats 5–9 | $130/mo each |
| Seats 10+ | $110/mo each |

#### Annual Tiers (monthly × 10)

| Seats | Per-Seat Price |
|---|---|
| Seat 1 | $2,000/yr |
| Seats 2–4 | $1,500/yr each |
| Seats 5–9 | $1,300/yr each |
| Seats 10+ | $1,100/yr each |

| Lookup Key | Billing | Stripe Type |
|---|---|---|
| `tlp_community_monthly` | monthly | `tiered`, `graduated`, `licensed` |
| `tlp_community_annual` | yearly | `tiered`, `graduated`, `licensed` |

---

## 3. Environment Variables

All in `.env.local` (gitignored). Never commit secret keys.

```
# Stripe keys
STRIPE_SECRET_KEY=sk_test_...        # Use sk_test_ for dev, sk_live_ for prod

# Price IDs (created by setup script, paste into .env.local)
STRIPE_SOLO_MONTHLY_PRICE_ID=price_...
STRIPE_SOLO_ANNUAL_PRICE_ID=price_...
STRIPE_COMMUNITY_MONTHLY_PRICE_ID=price_...
STRIPE_COMMUNITY_ANNUAL_PRICE_ID=price_...

# Webhook (set up after deploying)
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL for redirects
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`.env.stripe.generated` is auto-written by the setup script and is gitignored (covered by `.env*` pattern).

---

## 4. Scripts

### `npm run stripe:setup-catalog`

**File:** `scripts/setup-stripe-catalog.ts`

Creates the two products and four prices in Stripe. Idempotent — skips existing products/prices by lookup key. Prints price IDs and writes them to `.env.stripe.generated`.

**Safe to run in test mode.** Detects `sk_test_` vs `sk_live_` and warns on live keys.

### `npm run stripe:verify-pricing`

**File:** `scripts/verify-stripe-pricing.ts`

Retrieves all four prices from Stripe and verifies:
- Solo monthly = 20000 cents/month
- Solo annual = 199900 cents/year
- Communities monthly tiers = 20000/15000/13000/11000 cents
- Communities annual tiers = 200000/150000/130000/110000 cents
- Communities tier mode = `graduated`
- Communities usage type = `licensed`

Exits with code 1 if any check fails.

---

## 5. API Routes

### `POST /api/stripe/checkout`

Creates a Checkout Session. Auth-required.

**Request body (new format only — legacy `{ plan }` removed):**
```ts
{
  purchaseType: "solo" | "community";
  billingInterval: "monthly" | "annual";
  seats?: number;           // required if community, must be >= 2
  organizationName?: string; // required if community
}
```

Returns `{ url }` for redirect.

**Mapping:**
- solo + monthly → `STRIPE_SOLO_MONTHLY_PRICE_ID`, quantity 1
- solo + annual → `STRIPE_SOLO_ANNUAL_PRICE_ID`, quantity 1
- community + monthly → `STRIPE_COMMUNITY_MONTHLY_PRICE_ID`, quantity = seats
- community + annual → `STRIPE_COMMUNITY_ANNUAL_PRICE_ID`, quantity = seats

**Checkout metadata passed to webhook:**
- `userId`, `purchaseType`, `billingInterval`, `seats`, `organizationName`, `appPlan` (always "PRO")

### `POST /api/stripe/public-checkout`

Creates a Checkout Session for public (no auth) visitors from the marketing homepage.

**Request body:**
```ts
{
  purchaseType: "solo" | "community";
  billingInterval: "monthly" | "annual";
  seats?: number;           // required if community, must be 2–25
  organizationName?: string; // required if community
}
```

Returns `{ url }` for redirect.

**Differences from authenticated checkout:**
- No `userId` in metadata (no authenticated user)
- `checkoutSource: "public_homepage"` metadata flag
- Success URL: `/checkout/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `/?checkout=cancelled#pricing`
- No `client_reference_id`

**Webhook fulfillment** (via `handlePublicCheckoutCompleted`):
- If user exists → upgrade directly (Solo → PRO, Community → TEAM_ADMIN + org)
- If user doesn't exist → create `PendingStripeInvite` with 14-day token, send paid registration email

### `POST /api/stripe/webhook`

Webhook handler. Verifies `stripe-signature` header. Events:

- **`checkout.session.completed`** — Fulfillment driven by checkout metadata:
  - **Solo**: Updates user to `PRO` plan, sets `stripeCustomerId`, `stripeSubscriptionId`, `stripeStatus`, `accountStatus`.
  - **Community**: Creates or updates `Organization` with the provided name, sets org's Stripe fields, assigns purchaser as `TEAM_ADMIN` with `organizationId`, sets user to `PRO`.
  - **Protection**: ADMIN users and comped users (`isComped=true`) are never overwritten by webhook.
  - **Idempotency**: Stripe event IDs are persisted in the `StripeEvent` table. Duplicate events (Stripe retries) are skipped.
  - **Solo vs Community separation**: Community subscriptions are owned by the Organization record. Stripe billing fields (`stripeCustomerId`, `stripeSubscriptionId`) are NOT set on the User for community checkouts. Webhook handlers do not fall through from org→user for community events.
  - **Switch-from-community**: If checkout metadata contains `switchFromOrgId`, the webhook defers org changes (cancel subscription, transfer admin, remove user from org) until after solo checkout is confirmed.

- **`customer.subscription.updated`** — Syncs subscription status for user or organization. For community events, looks up org by `stripeSubscriptionId` or `stripeCustomerId` — does NOT fall through to user lookup if no org found. For solo events, finds user by `stripeCustomerId` or `userId` metadata. Protected users (ADMIN/comped) are skipped.

- **`customer.subscription.deleted`** — Downgrades non-protected user: sets `accountStatus: ARCHIVED`, `plan: CALENDAR_ONLY`, clears `stripeSubscriptionId` and `stripeCustomerId`, sets `stripeStatus` to `canceled`. For organizations, clears org Stripe fields (`stripeSubscriptionId`, `stripeCustomerId`) and archives all non-ADMIN, non-comped members (sets `accountStatus: ARCHIVED`, `plan: CALENDAR_ONLY`). ADMIN and comped users are protected.

- **`invoice.paid`** — Marks `ACTIVE`
- **`invoice.payment_failed`** — Marks `PAST_DUE`

### `POST /api/stripe/portal`

Creates Billing Portal Session. Auth-required. User must have `stripeCustomerId`. Returns `{ url }`.

**Portal configuration**: A portal configuration is created automatically with `subscription_update` disabled — users cannot change seat quantities via the portal (which would bypass the seat reconciliation flow). Cancel at period end, payment method updates, and invoice history are enabled.

### `POST /api/stripe/cancel`

Cancels subscription at period end. Auth-required.

- **Solo users**: cancels their own subscription. Updates `stripeStatus` to `cancel_at_period_end` on the User record.
- **Community/TEAM_ADMIN**: cancels the org subscription. Updates `stripeStatus` on the Organization record.
- **Regular community members**: blocked with 403 error — only TEAM_ADMIN can cancel the org subscription.
- User keeps access until the billing period ends, then Stripe fires `customer.subscription.deleted` which archives the account.

### `POST /api/stripe/switch-to-solo`

Switches a TEAM_ADMIN from Community to Solo membership. Auth-required (TEAM_ADMIN only).

**Flow (deferred org changes):**
1. Validates user is TEAM_ADMIN with an org.
2. Creates a Solo checkout session with `switchFromOrgId` metadata. **No org changes happen here.**
3. Returns `{ url }` for client redirect.
4. **After solo checkout is completed** (via `checkout.session.completed` webhook), the webhook's `processSwitchFromCommunity` function:
   a. Schedules org subscription cancellation at period end via Stripe API.
   b. Finds a successor — the oldest active, non-archived, non-ADMIN member of the org.
   c. If a successor exists: transfers TEAM_ADMIN role to successor, demotes original admin to USER, removes original admin from org.
   d. If no successor exists: just removes the original admin from the org. The community will cancel at period end.

This ensures that if the user abandons checkout, the community is left untouched.

### `POST /api/stripe/update-seats`

Updates the Stripe subscription quantity for seat changes. Auth-required (TEAM_ADMIN or ADMIN).

- Body: `{ action: "add"|"remove", newQuantity: number }`
- **Add**: uses `proration_behavior: "create_prorations"` (prorated charge immediately)
- **Remove**: uses `proration_behavior: "none"` (reduction takes effect at next billing period)
- Enforces min 2 seats, max 25 seats.
- Reads subscription ID from the org's DB record (not from client) for security.
- Updates `Organization.seatLimit` locally for immediate UI feedback.

### `POST /api/account/delete`

Permanently deletes the user's account and all associated data (cascade deletes). Auth-required.

- **TEAM_ADMIN blocked** — must transfer admin role first (returns error message). The org subscription is NOT canceled by self-deletion.
- **ADMIN blocked** — cannot self-delete.
- **Solo users**: cancels their Stripe subscription immediately, then deletes.
- **Regular community members**: does NOT touch the org subscription — only removes the user from the org and deletes their account.
- Cleans up orphaned `InviteToken` records by email before deletion.

---

## 6. Billing UI

- `/dashboard/billing` — server component reads user's plan + Stripe fields, org details (seatLimit, member count, org name), and user role
- `BillingClient.tsx` — shows:
  - Current membership card with public label, Stripe status, and comped badge
  - Monthly/Annual billing interval toggle
  - **Solo Membership card** — flat pricing, feature list, "Start Solo Membership" button
  - **Communities Membership card** — seat selector (min 2, max 25), org name input, live graduated pricing calculator, "Start Communities Membership" button
  - **Seat Manager** (TEAM_ADMIN only, inside Communities card) — add/remove seats with reconciliation modal
  - "Manage Billing" button (Stripe portal) for existing customers
  - **Danger Zone** — destructive actions with confirmation modals:
    - **Cancel Subscription** — cancels at period end via `POST /api/stripe/cancel`. User keeps access until period ends, then account is archived.
    - **Delete Account** — permanently deletes account and all data via `POST /api/account/delete`. TEAM_ADMIN users are blocked with a message to transfer admin first.
    - **Switch to Solo** (TEAM_ADMIN only) — when a community admin clicks "Start Solo Membership", a confirmation modal explains that admin will transfer to the oldest active member, the community will be canceled at period end, and they'll start solo checkout. Calls `POST /api/stripe/switch-to-solo`.
  - Non-admin community members see a community info card with their admin's email for contact purposes.
- All user-facing language uses "Membership" instead of "Plan" or "Tier"
- `LockedTabOverlay` shows "Get Full Access" CTA (not "Upgrade Your Plan")
- `ZernioCard` shows "Get Full Access" CTA when at account limit
- Sidebar shows "Membership" label with `PUBLIC_PLAN_LABELS[plan]`

---

## 7. Key Files

| File | Purpose |
|---|---|
| `src/lib/stripe-config.ts` | Centralized env key names, config checks, pricing calculators, `getPriceId()`, `priceIdToPlan()` (all paid → PRO) |
| `src/lib/stripe.ts` | Singleton Stripe client, plan↔price mapping (all paid → PRO), status converters |
| `src/lib/tiers.ts` | Internal `UserPlan` enum, `PLAN_LABELS`, `PUBLIC_PLAN_LABELS`, `ADMIN_PLAN_LABELS`, access checks |
| `scripts/setup-stripe-catalog.ts` | One-time catalog setup script |
| `scripts/verify-stripe-pricing.ts` | Pricing verification script |
| `scripts/check-stripe-env.ts` | Safe env var diagnostic (prefixes only, no secrets) |
| `src/app/api/stripe/checkout/route.ts` | Checkout session creation (solo/community + monthly/annual + seats) |
| `src/app/api/stripe/webhook/route.ts` | Webhook handler — Solo/Community fulfillment, org creation, ADMIN/comped protection |
| `src/app/api/stripe/portal/route.ts` | Customer portal redirect |
| `src/app/api/stripe/cancel/route.ts` | Cancel subscription at period end (role-guarded) |
| `src/app/api/stripe/switch-to-solo/route.ts` | Switch TEAM_ADMIN from Community to Solo (checkout-first, successor required) |
| `src/app/api/stripe/update-seats/route.ts` | Add/remove seats on community subscription |
| `src/app/api/account/delete/route.ts` | Permanently delete account (role-guarded, invite token cleanup) |
| `src/app/dashboard/billing/page.tsx` | Billing page (server) |
| `src/app/dashboard/billing/BillingClient.tsx` | Billing page (client) — Solo/Communities cards, seat calculator, Danger Zone |
| `src/app/dashboard/billing/SeatManager.tsx` | Seat management UI with reconciliation modal |
| `src/app/dashboard/billing/seat-actions.ts` | Seat reconciliation server actions (lock/remove/unlock members) |
| `src/app/admin/organizations/actions.ts` | `assignTeamAdmin()` with seamless Stripe billing transfer |
| `src/components/LockedTabOverlay.tsx` | Locked feature overlay with "Get Full Access" CTA |
| `src/app/dashboard/integrations/ZernioCard.tsx` | Integration card with "Get Full Access" CTA |
| `src/app/dashboard/DashboardLayoutClient.tsx` | Sidebar shows "Membership" label via `PUBLIC_PLAN_LABELS` |
| `src/app/admin/components/PlanSwitcher.tsx` | Admin plan dropdown using `ADMIN_PLAN_LABELS` |
| `src/app/admin/components/AccountManagerModal.tsx` | Admin account modal with internal plan labels |

---

## 8. Setup Workflow

1. **Add Stripe test key to `.env.local`:**
   ```
   STRIPE_SECRET_KEY=sk_test_...
   ```

2. **Run catalog setup:**
   ```
   npm run stripe:setup-catalog
   ```

3. **Copy price IDs from output (or `.env.stripe.generated`) into `.env.local`:**
   ```
   STRIPE_SOLO_MONTHLY_PRICE_ID=price_...
   STRIPE_SOLO_ANNUAL_PRICE_ID=price_...
   STRIPE_COMMUNITY_MONTHLY_PRICE_ID=price_...
   STRIPE_COMMUNITY_ANNUAL_PRICE_ID=price_...
   ```

4. **Verify pricing:**
   ```
   npm run stripe:verify-pricing
   ```

5. **Set up webhook** (after deploy or with ngrok):
   - Register `https://yourdomain.com/api/stripe/webhook` in Stripe Dashboard
   - Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   - Copy signing secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`

6. **Go live:** Replace `sk_test_...` with `sk_live_...`, re-run setup script to create live products/prices, update price IDs in `.env.local`.

---

## 9. Security Rules

- **Never** commit `.env.local` or `.env.stripe.generated` (both gitignored)
- **Never** expose `STRIPE_SECRET_KEY` client-side
- **Never** hardcode price IDs in source — always read from env
- Use test keys (`sk_test_`) during development
- Roll any exposed live keys immediately in Stripe Dashboard

---

## 10. Prisma Schema (Stripe fields)

`User` model fields:
- `stripeCustomerId` (String?, nullable) — Stripe customer ID
- `stripeSubscriptionId` (String?, nullable) — Stripe subscription ID
- `stripeStatus` (String?, nullable) — Stripe subscription status (active, past_due, canceled, etc.)
- `plan` (UserPlan enum) — CALENDAR_ONLY | PRO (internal only, never shown to users)
- `accountStatus` (AccountStatus enum) — ACTIVE | TRIAL | PAST_DUE | CANCELED | EXPIRED | COMPED | ARCHIVED
- `isComped` (Boolean, default false) — comped users are protected from webhook overwrites
- `organizationId` (String?, nullable) — org membership for Communities

`Organization` model fields:
- `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeStatus` — org-level billing
- `seatLimit`, `seatPlan` — seat configuration

---

## 11. Plan Mapping

| Stripe Product | Internal Plan | Public Label |
|---|---|---|
| Solo (monthly/annual) | `PRO` | Solo Membership |
| Communities (monthly/annual) | `PRO` | Communities Membership |
| (none — admin-assigned) | `CALENDAR_ONLY` | Calendar Access |

Both Solo and Communities purchases set the user's internal plan to `PRO`. The webhook reads `appPlan=PRO` from checkout metadata and the price ID to determine the product type.

---

## 12. Webhook Protection Rules

The webhook **never** overwrites:
1. **ADMIN users** — `role === "ADMIN"` is always skipped
2. **Comped users** — `isComped === true` is always skipped (unified in `isProtectedUser`)
3. **Idempotency** — Stripe event IDs are persisted in the `StripeEvent` table; duplicate events are skipped

This ensures admin-assigned access levels (KW Legacy, Owner, Beta) are never clobbered by Stripe events.

---

## 13. Admin Transfer & Billing Handoff

When a community's TEAM_ADMIN role is transferred (via `assignTeamAdmin()` in `src/app/admin/organizations/actions.ts`), billing ownership is seamlessly transferred:

1. **Stripe customer email updated** — `stripe.customers.update()` sets the customer's email to the new admin's email, so billing receipts, failed payment notifications, and portal access go to the new admin.
2. **New admin gets Stripe fields** — the org's `stripeCustomerId`, `stripeSubscriptionId`, `stripeStatus` are copied to the new admin's User record, enabling billing portal access.
3. **Old admin's Stripe fields cleared** — the old admin loses `stripeCustomerId`, `stripeSubscriptionId`, `stripeStatus` on their User record, revoking billing portal access.
4. **Subscription stays active** — no cancel/recreate needed. The subscription remains on the Organization record. No billing interruption for community members.
5. **All within a sequential `$transaction`** — demote + promote + Stripe field transfer are atomic.

The confirmation modal in the Communities admin UI (`CommunitiesAdminClient.tsx`) warns that the new admin will take over billing responsibility.

This follows the industry-standard pattern (Slack, Notion, Linear) where org-level subscriptions belong to the organization, not the individual. Stripe's documentation confirms that non-billing updates (like changing customer email) apply immediately without prorations.

---

## 14. Account Status & Access Control

`AccountStatus` enum values:
| Status | Meaning |
|---|---|
| `ACTIVE` | Full access, subscription current |
| `TRIAL` | Trial period (not currently used) |
| `PAST_DUE` | Payment failed, grace period |
| `CANCELED` | Subscription canceled (legacy — now uses ARCHIVED) |
| `EXPIRED` | Access expired (admin-set expiration) |
| `COMPED` | Complimentary access, protected from webhook overwrites |
| `ARCHIVED` | No dashboard access — used when seat removed, org subscription deleted, or member removed from org |

**ARCHIVED users** see an "Access Paused" screen with a "Subscribe to Continue" CTA linking to `/dashboard/billing`. They do NOT fall back to `CALENDAR_ONLY` (which is internal-only). Instead, they must subscribe to their own membership.

**`shouldBlockDashboardAccess()`** in `src/lib/account-access.ts` checks account status and blocks ARCHIVED/EXPIRED users from the dashboard.

---

## 15. Stripe-Managed Communications

Stripe automatically handles the following customer communications (no code needed):

- **Invoice emails** — sent automatically when an invoice is created, paid, or fails. Configurable in Stripe Dashboard → Settings → Emails → Invoice emails.
- **Receipt emails** — sent after successful charges. Configurable in Settings → Emails → Successful payment emails.
- **Failed payment emails** — Stripe sends dunning emails with a link to update card details. Smart Retries can be enabled in Dashboard.
- **Customer Portal** — customers can view all past invoices (with PDFs), update payment methods, and cancel subscriptions. Already wired via `POST /api/stripe/portal`.
- **Custom branding** — logo, business name, and statement descriptor can be set in Stripe Dashboard.

No need to build invoice/receipt infrastructure — Stripe handles it all.

---

## 16. Future Considerations

- **Annual discounts**: Solo annual saves ~$401 vs monthly ($1,999 vs $2,400)
- **Proration**: Stripe handles proration on plan changes by default
- **Tax**: Stripe Tax can be enabled on checkout sessions if needed
- **Coupons**: Checkout sessions already support promotion codes (`allow_promotion_codes: true`)
- **Seat management**: Communities seat count changes via the in-app SeatManager (with reconciliation). Stripe portal has `subscription_update` disabled to prevent bypassing reconciliation.
- **Statement descriptor**: Set to "The Local Post" in Stripe Dashboard for customer-facing charge descriptions
