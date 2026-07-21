# Marketing Homepage & Public Checkout — QA Checklist

> Last updated: July 2026

## 1. Public Marketing Homepage (`/`)

- [ ] `/` loads without redirect to `/login`
- [ ] Hero section displays headline, subheadline, and CTA buttons
- [ ] Rotating tagline appears under logo
- [ ] "Start Your Membership" button scrolls to `#pricing`
- [ ] "Explore Features" button scrolls to `#features`
- [ ] Social proof section shows 3 columns (Local First, AI Powered, Multi-Platform)
- [ ] Feature grid shows 6 features with icons
- [ ] Pricing section shows Solo and Communities cards
- [ ] FAQ accordion expands/collapses on click
- [ ] Footer shows logo, nav links, and copyright year
- [ ] Header is sticky and shows login button (or Dashboard if logged in)
- [ ] Header nav links scroll to correct sections
- [ ] SEO metadata present in page source (title, description, OpenGraph)

## 2. Pricing Section

- [ ] Monthly/Annual toggle switches prices correctly
- [ ] Solo price shows $200/mo or $1,999/yr
- [ ] Communities seat slider works (min 2, max 25)
- [ ] Seat +/- buttons increment/decrement correctly
- [ ] Community total updates in real-time as seats change
- [ ] Per-seat price displays correctly
- [ ] Annual shows "Two months free" label
- [ ] Organization name input appears for Communities
- [ ] Organization name is required before community checkout
- [ ] "Start Solo Membership" button triggers checkout
- [ ] "Start Communities Membership" button triggers checkout
- [ ] Error messages display for invalid input
- [ ] Loading spinner shows during checkout redirect

## 3. Pricing Calculator Verification

- [ ] 1 seat: $200/month
- [ ] 2 seats: $350/month ($200 + $150)
- [ ] 3 seats: $500/month ($200 + $150×2)
- [ ] 4 seats: $650/month ($200 + $150×3)
- [ ] 5 seats: $780/month ($200 + $150×3 + $130)
- [ ] 10 seats: $1,410/month ($200 + $150×3 + $130×5 + $110×1)
- [ ] 25 seats: $3,060/month ($200 + $150×3 + $130×5 + $110×16)
- [ ] Annual = monthly × 10 for all seat counts

## 4. Public Checkout API (`POST /api/stripe/public-checkout`)

- [ ] Returns 400 for invalid `purchaseType`
- [ ] Returns 400 for invalid `billingInterval`
- [ ] Returns 400 for community with < 2 seats
- [ ] Returns 400 for community with > 25 seats
- [ ] Returns 400 for community without organization name
- [ ] Returns 400 for invalid JSON
- [ ] Returns 503 when Stripe not configured
- [ ] Returns 503 when price ID not found
- [ ] Returns `{ url }` on success
- [ ] Checkout session metadata includes `checkoutSource: "public_homepage"`
- [ ] Checkout session includes correct price ID
- [ ] Success URL points to `/checkout/success?session_id={CHECKOUT_SESSION_ID}`
- [ ] Cancel URL points to `/?checkout=cancelled#pricing`

## 5. Checkout Success Page (`/checkout/success`)

- [ ] Page loads without authentication
- [ ] Shows success icon and "Welcome to The Local Post" heading
- [ ] Shows email check instructions
- [ ] Shows "already have an account?" instructions
- [ ] "Member Login" button links to `/login`
- [ ] "Back to Home" button links to `/`
- [ ] Session ID displayed (truncated) when `session_id` param present

## 6. Webhook Fulfillment (Public Checkout)

- [ ] `checkout.session.completed` with `checkoutSource: "public_homepage"` triggers `handlePublicCheckoutCompleted`
- [ ] Solo checkout with existing user → user upgraded to PRO
- [ ] Solo checkout with new user → `PendingStripeInvite` created, email sent
- [ ] Community checkout with existing user → user set as TEAM_ADMIN, org created/updated
- [ ] Community checkout with new user → org created, `PendingStripeInvite` created, email sent
- [ ] Protected users (ADMIN/comped) are not modified (plan/role preserved)
- [ ] Duplicate `PendingStripeInvite` for same email updates existing record
- [ ] Paid registration email sent via Resend
- [ ] Email contains registration link with token
- [ ] Registration link expires after 14 days

## 7. Registration with PendingStripeInvite

- [ ] `/register?token={validToken}` shows registration form with paid registration copy
- [ ] "Your membership is active. Set your password to access your account." text shown
- [ ] Expiry text says "14 days" for paid registrations
- [ ] "7 days" for regular invite tokens (unchanged)
- [ ] Invalid token shows error message
- [ ] Expired token shows error message
- [ ] Existing email shows "account already exists" error
- [ ] Successful registration creates user with:
  - [ ] PRO plan
  - [ ] ACTIVE account status
  - [ ] `stripeCustomerId` from pending invite
  - [ ] `stripeSubscriptionId` from pending invite
  - [ ] `stripeStatus` from pending invite
  - [ ] Role: USER (solo) or TEAM_ADMIN (community)
  - [ ] `organizationId` set for community registrations
- [ ] `PendingStripeInvite` record deleted after registration
- [ ] Redirects to `/onboarding` after successful registration

## 8. Login Page (Unchanged)

- [ ] `/login` loads normally with editorial design
- [ ] Login form works as before
- [ ] No visual or functional changes to login page
- [ ] Login button on homepage header links to `/login`

## 9. Existing Authenticated Flows

- [ ] `/dashboard` still requires authentication
- [ ] `/admin` still requires ADMIN role
- [ ] `/onboarding` still requires authentication
- [ ] Existing billing page (`/dashboard/billing`) loads correctly
- [ ] Existing checkout routes (`/api/stripe/checkout`, `/api/stripe/portal`, etc.) work
- [ ] Existing invite token registration still works (admin → invite → register)
- [ ] Team roster management works for TEAM_ADMIN
- [ ] Organization management works for ADMIN

## 10. Dark Mode

- [ ] Homepage renders correctly in dark mode
- [ ] All sections have proper contrast
- [ ] Pricing cards readable in dark mode
- [ ] FAQ accordion readable in dark mode
- [ ] Checkout success page readable in dark mode

## 11. Responsive Design

- [ ] Homepage renders correctly on mobile (375px)
- [ ] Homepage renders correctly on tablet (768px)
- [ ] Homepage renders correctly on desktop (1280px)
- [ ] Pricing cards stack vertically on mobile
- [ ] Header nav hidden on mobile (sm:flex)
- [ ] Seat slider usable on touch devices
- [ ] Checkout success page centered on all screen sizes
