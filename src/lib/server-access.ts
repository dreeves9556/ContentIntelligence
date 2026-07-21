import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { AccountAccessUser } from "@/lib/account-access";
import type { UserPlan } from "@/lib/tiers";
import { evaluateDashboardAccess } from "@/lib/access-policy";

interface DashboardAccessOptions {
  requiredPlan?: UserPlan;
  expectedUserId?: string;
}

export type DashboardAccessResult =
  | {
      allowed: true;
      user: AccountAccessUser & { plan: UserPlan };
    }
  | {
      allowed: false;
      status: 401 | 403;
      error: string;
    };

/**
 * Authorize a dashboard operation at the server boundary.
 *
 * Page layouts are not an authorization boundary: Server Actions and route
 * handlers can be invoked directly. Every paid or account-scoped operation
 * should call this helper before reading data or contacting an external API.
 */
export async function requireDashboardAccess(
  options: DashboardAccessOptions = {}
): Promise<DashboardAccessResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { allowed: false, status: 401, error: "Not authenticated" };
  }

  if (options.expectedUserId && session.user.id !== options.expectedUserId) {
    return { allowed: false, status: 403, error: "Not authorized" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      plan: true,
      accountStatus: true,
      accessExpiresAt: true,
      expirationAction: true,
      isComped: true,
      internalTag: true,
    },
  });

  if (!user) {
    return { allowed: false, status: 401, error: "Not authenticated" };
  }

  const policy = evaluateDashboardAccess(user, options.requiredPlan);
  if (!policy.allowed) {
    return { allowed: false, status: 403, error: policy.error };
  }

  return {
    allowed: true,
    user: { ...user, plan: policy.effectivePlan },
  };
}
