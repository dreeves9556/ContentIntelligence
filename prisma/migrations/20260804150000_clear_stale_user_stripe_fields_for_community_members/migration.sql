-- Clear stale Stripe fields from User records of community members.
--
-- Before the Finding 3 fix, registerWithToken() and assignTeamAdmin() copied
-- the organization's stripeCustomerId / stripeSubscriptionId / stripeStatus
-- onto the User record. This broke the cancel route (treated the community
-- sub as a solo sub, updated User.stripeStatus instead of
-- Organization.stripeStatus) and the duplicate-purchase guard.
--
-- The code fix stops NEW copies from happening, but existing community
-- members still carry stale fields. This migration clears them so the
-- cancel/portal routes fall through to the Organization lookup as intended.
--
-- Only touches users who belong to an organization (organizationId IS NOT
-- NULL). Solo subscribers (organizationId IS NULL) keep their Stripe fields
-- — those legitimately live on the User record.

UPDATE "users"
SET "stripeCustomerId" = NULL,
    "stripeSubscriptionId" = NULL,
    "stripeStatus" = NULL
WHERE "organizationId" IS NOT NULL
  AND ("stripeSubscriptionId" IS NOT NULL
    OR "stripeCustomerId" IS NOT NULL);
