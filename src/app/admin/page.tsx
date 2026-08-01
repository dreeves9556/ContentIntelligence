import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { InviteClientButton } from "./components/InviteClientButton";
import BulkInviteModal from "./components/BulkInviteModal";
import AdminRosterClient, { type RosterUser } from "./components/AdminRosterClient";
import type { UserPlan } from "@/lib/tiers";
import { getPendingInvites } from "./actions";

export const dynamic = "force-dynamic";

async function getUsers(): Promise<RosterUser[]> {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          questionnaires: true,
          profileSurveys: true,
          calendars: true,
          zernioAccounts: true,
        },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: (user.plan ?? "PRO") as UserPlan,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt ?? null,
    lastAccessCheckAt: user.lastAccessCheckAt ?? null,
    status:
      user.role === "ADMIN" ||
      (user._count?.questionnaires ?? 0) > 0 ||
      (user._count?.profileSurveys ?? 0) > 0 ||
      (user._count?.calendars ?? 0) > 0
        ? ("ACTIVE" as const)
        : ("PENDING" as const),
    accountStatus: user.accountStatus,
    internalTag: user.internalTag,
    isComped: user.isComped,
    compReason: user.compReason,
    accessExpiresAt: user.accessExpiresAt,
    expirationAction: user.expirationAction,
    organizationId: user.organizationId,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    stripeStatus: user.stripeStatus,
    trialEndsAt: user.trialEndsAt,
    hasUsedTrial: user.hasUsedTrial,
    _count: user._count,
  }));
}

/**
 * Find emails with expired, unconsumed password-setup tokens.
 * consumePasswordResetToken deletes the row on use, so any remaining row
 * with expiresAt < now was issued but never acted on.
 */
async function getExpiredTokenEmails(): Promise<Set<string>> {
  const expired = await prisma.passwordResetToken.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { email: true },
  });
  return new Set(expired.map((r) => r.email));
}

export default async function AdminPage() {
  const users = await getUsers();
  const session = await auth();
  const currentUserId = session?.user?.id;
  const invites = await getPendingInvites();
  const expiredTokenEmails = await getExpiredTokenEmails();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            Client Roster
          </h1>
          <p className="text-text-muted mt-1">
            Manage your clients and their platform access
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BulkInviteModal invites={invites} />
          <InviteClientButton />
        </div>
      </div>

      <AdminRosterClient users={users} currentUserId={currentUserId} expiredTokenEmails={expiredTokenEmails} />
    </div>
  );
}
