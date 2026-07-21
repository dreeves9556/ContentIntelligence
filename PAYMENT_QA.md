# The Local Post — Payment System QA Checklist

> Use this checklist to verify the billing system after deployments, schema changes, or Stripe config updates.
> **Updated July 2026** — Reflects webhook idempotency, solo/community separation, deferred switch-to-solo, portal quantity lock, and checkout guard.

---

## 1. Environment & Configuration

- [ ] `STRIPE_SECRET_KEY` set in `.env.local` (test key for dev, live key for prod)
- [ ] `STRIPE_SOLO_MONTHLY_PRICE_ID` set and valid
- [ ] `STRIPE_SOLO_ANNUAL_PRICE_ID` set and valid
- [ ] `STRIPE_COMMUNITY_MONTHLY_PRICE_ID` set and valid
- [ ] `STRIPE_COMMUNITY_ANNUAL_PRICE_ID` set and valid
- [ ] `STRIPE_WEBHOOK_SECRET` set (after webhook endpoint registered in Stripe Dashboard)
- [ ] `NEXT_PUBLIC_APP_URL` set to correct app URL
- [ ] `npm run stripe:check-env` passes without errors
- [ ] `npm run stripe:verify-pricing` passes — all 4 prices match expected amounts

---

## 2. Checkout API (`POST /api/stripe/checkout`)

### Solo Membership
- [ ] POST with `{ purchaseType: "solo", billingInterval: "monthly" }` returns `{ url }` — Stripe checkout URL
- [ ] POST with `{ purchaseType: "solo", billingInterval: "annual" }` returns `{ url }`
- [ ] Checkout page shows Solo product at $200/mo or $1,999/yr
- [ ] Unauthenticated request returns 401
- [ ] Missing `purchaseType` returns 400
- [ ] Missing `billingInterval` returns 400
- [ ] Legacy `{ plan: "CREATOR" }` returns 400 (not accepted — CREATOR plan sunset)

### Communities Membership
- [ ] POST with `{ purchaseType: "community", billingInterval: "monthly", seats: 3, organizationName: "Test Org" }` returns `{ url }`
- [ ] POST with `{ purchaseType: "community", billingInterval: "annual", seats: 5, organizationName: "Test Org" }` returns `{ url }`
- [ ] Checkout page shows Communities product with correct graduated pricing
- [ ] `seats < 2` returns 400
- [ ] Missing `organizationName` returns 400
- [ ] Missing `seats` returns 400

---

## 3. Webhook (`POST /api/stripe/webhook`)

### Solo Checkout Completion
- [ ] `checkout.session.completed` with `purchaseType=solo` metadata:
  - User's `plan` set to `PRO`
  - `stripeCustomerId`, `stripeSubscriptionId`, `stripeStatus` set on User
  - `accountStatus` set to `ACTIVE`
  - `organizationId` set to null (Solo clears org membership)
  - `isComped` set to false

### Communities Checkout Completion
- [ ] `checkout.session.completed` with `purchaseType=community` metadata:
  - Organization created with provided `organizationName`
  - Org's `stripeCustomerId`, `stripeSubscriptionId`, `stripeStatus` set on Organization record
  - User's `role` set to `TEAM_ADMIN`
  - User's `organizationId` set to new org ID
  - User's `plan` set to `PRO`
  - User's `accountStatus` set to `ACTIVE`
  - Stripe billing fields NOT set on User (they live on the Organization)

### Protection Rules
- [ ] ADMIN user checkout completion: webhook skips — plan/role NOT changed
- [ ] Comped user (`isComped=true`) checkout completion: webhook skips — plan NOT changed
- [ ] ADMIN user linked to org but Stripe fields NOT set on user (community)
- [ ] Comped user linked to org but Stripe fields NOT set on user (community)

### Subscription Updated
- [ ] `customer.subscription.updated` with `purchaseType=community` syncs org's `stripeStatus` and `seatLimit`
- [ ] Community event with no matching org: does NOT fall through to user lookup (warns and returns)
- [ ] `customer.subscription.updated` with `purchaseType=solo` syncs user's `stripeStatus`
- [ ] ADMIN/comped users are skipped

### Subscription Deleted
- [ ] `customer.subscription.deleted` (solo): user `accountStatus` set to `LOCKED`, `plan` set to `CALENDAR_ONLY`
- [ ] `customer.subscription.deleted` (solo): clears `stripeSubscriptionId` AND `stripeCustomerId` on user
- [ ] `customer.subscription.deleted` (solo): sets `stripeStatus` to `canceled`
- [ ] `customer.subscription.deleted` (community): org Stripe fields cleared (`stripeSubscriptionId`, `stripeCustomerId`)
- [ ] `customer.subscription.deleted` (community): all non-ADMIN, non-comped members set to `LOCKED` + `CALENDAR_ONLY`
- [ ] Community event with no matching org: does NOT fall through to user lookup
- [ ] ADMIN/comped users are NOT downgraded

### Invoice Events
- [ ] `invoice.paid` syncs subscription status and sets `accountStatus` to `ACTIVE`
- [ ] `invoice.payment_failed` sets `accountStatus` to `PAST_DUE`
- [ ] ADMIN/comped users are NOT modified by invoice events

### Idempotency
- [ ] Duplicate webhook event (same `event.id`): skipped — `StripeEvent` record exists
- [ ] First processing creates `StripeEvent` record with `eventId` and `eventType`
- [ ] Stripe retry of failed event: processed normally (no `StripeEvent` record yet)

---

## 4. Billing UI (`/dashboard/billing`)

### Solo Membership Card
- [ ] Shows "Solo Membership" with User icon
- [ ] Monthly: $200/month
- [ ] Annual: $1,999/year with "Two months free" note
- [ ] Feature list displays correctly
- [ ] "Start Solo Membership" button triggers checkout
- [ ] If user already has PRO and not comped: shows "Your current membership"

### Communities Membership Card
- [ ] Shows "Communities Membership" with Users icon
- [ ] Seat selector defaults to 3, min 2, max 25
- [ ] Organization name input present
- [ ] Price updates live as seats change
- [ ] Per-seat price displayed
- [ ] Annual shows "Two months free" note
- [ ] "Start Communities Membership" button triggers checkout
- [ ] Validation: seats < 2 shows error
- [ ] Validation: empty org name shows error

### Billing Interval Toggle
- [ ] Monthly/Annual toggle works — prices update on both cards
- [ ] Default is Monthly

### Current Membership Card
- [ ] Shows public label (e.g., "Full Access" for PRO, "Calendar Access" for CALENDAR_ONLY)
- [ ] Shows "Complimentary access" if comped
- [ ] Shows Stripe status if present
- [ ] "Manage Billing" button appears if `stripeCustomerId` exists
- [ ] "Manage Billing" opens Stripe portal

### Status Messages
- [ ] `?success=1` shows green success banner
- [ ] `?canceled=1` shows yellow canceled banner
- [ ] Errors display in red banner

---

## 5. Locked Feature CTAs

- [ ] `LockedTabOverlay` shows "Available with Full Access" badge
- [ ] `LockedTabOverlay` button says "Get Full Access" (not "Upgrade Your Plan")
- [ ] Analytics page locked overlay description says "Get Full Access to unlock..."
- [ ] Integrations page locked overlay description says "Get Full Access to connect..."
- [ ] `ZernioCard` at account limit shows "Get Full Access" (not "Upgrade to Pro")
- [ ] `ZernioCard` limit message says "account limit for your current membership" (not "Creator plan")

---

## 6. Sidebar & Navigation

- [ ] Sidebar shows "Membership" label (not "Plan")
- [ ] Sidebar shows public label via `PUBLIC_PLAN_LABELS` (e.g., "Full Access", "Calendar Access")
- [ ] No raw enum values like "CALENDAR_ONLY" or "PRO" visible to users

---

## 7. Admin Portal

- [ ] `PlanSwitcher` dropdown shows admin labels: "Calendar Only (Internal)", "Creator (Legacy/Deprecated)", "Pro (Full Access)"
- [ ] `AccountManagerModal` plan dropdown shows same admin labels
- [ ] `AccountManagerModal` plan label says "Plan (Internal)"
- [ ] Admin can still switch between all 3 internal plans
- [ ] `ACCOUNT_PRESETS` still work correctly (KWLG → CALENDAR_ONLY, OWNER → PRO, BETA → PRO)

---

## 8. Stripe Portal (`POST /api/stripe/portal`)

- [ ] Returns `{ url }` for user with `stripeCustomerId`
- [ ] Returns 400 for user without `stripeCustomerId`
- [ ] Unauthenticated request returns 401
- [ ] Portal URL redirects back to `/dashboard/billing`
- [ ] Portal configuration has `subscription_update` disabled (no quantity changes)
- [ ] Portal allows cancel at period end
- [ ] Portal allows payment method updates
- [ ] Portal shows invoice history

---

## 9. End-to-End Flow (Test Mode)

### Solo Flow
1. [ ] Create a test user with `CALENDAR_ONLY` plan
2. [ ] Go to `/dashboard/billing` — verify Solo and Communities cards show
3. [ ] Click "Start Solo Membership" — complete Stripe checkout (test card 4242...)
4. [ ] Verify webhook fires and user upgraded to `PRO`, `ACTIVE`
5. [ ] Verify sidebar now shows "Full Access"
6. [ ] Go to `/dashboard/billing` — verify "Your current membership" on Solo card
7. [ ] Click "Manage Billing" — verify Stripe portal opens
8. [ ] Verify portal does NOT show option to change quantity
9. [ ] Cancel subscription in portal — verify webhook fires
10. [ ] Verify user downgraded to `LOCKED` + `CALENDAR_ONLY`, Stripe fields cleared

### Community Flow
11. [ ] Create another test user with `CALENDAR_ONLY` plan
12. [ ] Start Communities checkout with 3 seats — complete checkout
13. [ ] Verify org created, user set as `TEAM_ADMIN` with `PRO` plan
14. [ ] Verify Stripe fields are on the Organization, NOT on the User
15. [ ] Invite a second user to the org
16. [ ] Cancel org subscription — verify webhook fires
17. [ ] Verify org Stripe fields cleared, all members set to `LOCKED` + `CALENDAR_ONLY`

### Switch-to-Solo Flow
18. [ ] As TEAM_ADMIN, click "Start Solo Membership" — confirmation modal appears
19. [ ] Confirm — redirects to Stripe solo checkout
20. [ ] **Abandon checkout** — verify community is untouched (no org changes)
21. [ ] Start switch again — **complete checkout** this time
22. [ ] Verify webhook fires: org subscription scheduled to cancel at period end
23. [ ] Verify TEAM_ADMIN role transferred to oldest active member
24. [ ] Verify original admin removed from org, role set to USER
25. [ ] Verify original admin now has solo PRO subscription

---

## 10. Protection E2E

1. [ ] Create a comped user (set `isComped=true`, `plan=PRO`)
2. [ ] Simulate `checkout.session.completed` webhook for this user
3. [ ] Verify user's plan/role/accountStatus are NOT changed
4. [ ] Create an ADMIN user
5. [ ] Simulate `customer.subscription.deleted` webhook for this user
6. [ ] Verify ADMIN user is NOT downgraded

## 11. Checkout Guard

- [ ] User with `PRO` plan, `ACTIVE` status, and `stripeSubscriptionId`: checkout returns 400
- [ ] User with `PRO` plan but `LOCKED` status: checkout allowed (re-subscribing)
- [ ] User with `CALENDAR_ONLY` plan: checkout allowed
- [ ] Comped user with `PRO` plan: checkout allowed (not blocked by guard)

## 12. Registration Plan Fallback

- [ ] Invite with `plan=PRO`: registered user gets `PRO` plan
- [ ] Invite with `plan=CALENDAR_ONLY`: registered user gets `CALENDAR_ONLY` plan
- [ ] Invite with `plan=null` (not set): registered user gets `CREATOR` (default — admin must set plan via invite token)
- [ ] Invite with `plan=CREATOR`: registered user gets `CREATOR` plan

## 13. Idempotency E2E

1. [ ] Trigger a test webhook event (e.g., `stripe trigger checkout.session.completed`)
2. [ ] Verify `StripeEvent` record created in DB with correct `eventId` and `eventType`
3. [ ] Trigger the SAME event again (manually resend from Stripe Dashboard)
4. [ ] Verify duplicate event is skipped (console log: "Duplicate event ... — skipping")
5. [ ] Verify no duplicate DB changes
6. [ ] Verify only one `StripeEvent` record exists for that `eventId`
