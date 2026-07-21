import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStripeCheckoutConfigured } from "@/lib/stripe-config";
import type { UserPlan } from "@/lib/tiers";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeStatus: true,
      accountStatus: true,
      isComped: true,
      organizationId: true,
      role: true,
    },
  });

  if (!user) redirect("/login");

  const plan = user.plan as UserPlan;
  const stripeCheckoutReady = isStripeCheckoutConfigured();

  // If user has an org, fetch org details and member count for SeatManager
  let orgSeatLimit = 0;
  let orgMemberCount = 0;
  let orgName = "";
  let canManageSeats = false;
  let orgAdminEmail: string | null = null;

  if (user.organizationId) {
    const [org, memberCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { id: true, name: true, seatLimit: true, seatPlan: true },
      }),
      prisma.user.count({
        where: {
          organizationId: user.organizationId,
          accountStatus: { not: "ARCHIVED" },
        },
      }),
    ]);

    if (org) {
      orgSeatLimit = org.seatLimit;
      orgMemberCount = memberCount;
      orgName = org.name;
      canManageSeats = user.role === "TEAM_ADMIN" || user.role === "ADMIN";

      // For non-admin members, fetch the team admin's email so they can contact them
      if (!canManageSeats) {
        const admin = await prisma.user.findFirst({
          where: {
            organizationId: user.organizationId,
            role: "TEAM_ADMIN",
            accountStatus: { not: "ARCHIVED" },
          },
          select: { email: true },
        });
        orgAdminEmail = admin?.email ?? null;
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-text-primary mb-2"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Billing &amp; Membership
        </h1>
        <p className="text-text-muted">
          Manage your The Local Post membership, update payment methods, or modify your subscription.
        </p>
      </div>

      <BillingClient
        plan={plan}
        stripeCustomerId={user.stripeCustomerId}
        stripeSubscriptionId={user.stripeSubscriptionId}
        stripeStatus={user.stripeStatus}
        accountStatus={user.accountStatus}
        isComped={user.isComped}
        stripeCheckoutReady={stripeCheckoutReady}
        organizationId={user.organizationId}
        orgSeatLimit={orgSeatLimit}
        orgMemberCount={orgMemberCount}
        orgName={orgName}
        canManageSeats={canManageSeats}
        orgAdminEmail={orgAdminEmail}
        userRole={user.role}
      />
    </div>
  );
}
