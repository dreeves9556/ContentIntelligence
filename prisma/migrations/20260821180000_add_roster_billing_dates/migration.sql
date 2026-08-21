-- Add Stripe billing dates used by the admin client roster.
ALTER TABLE "users"
ADD COLUMN "stripeCancelAt" TIMESTAMP(3),
ADD COLUMN "stripeCurrentPeriodEnd" TIMESTAMP(3);

ALTER TABLE "organizations"
ADD COLUMN "stripeCancelAt" TIMESTAMP(3),
ADD COLUMN "stripeCurrentPeriodEnd" TIMESTAMP(3);
