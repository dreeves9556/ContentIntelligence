import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Mail } from "lucide-react";
import Link from "next/link";
import { InviteClientButton } from "./components/InviteClientButton";
import AdminRosterClient, { type RosterUser } from "./components/AdminRosterClient";
import type { UserPlan } from "@/lib/tiers";

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
    plan: (user.plan ?? "CREATOR") as UserPlan,
    createdAt: user.createdAt,
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
    _count: user._count,
  }));
}

export default async function AdminPage() {
  const users = await getUsers();
  const session = await auth();
  const currentUserId = session?.user?.id;

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
          <Link
            href="/admin/invites"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-background-secondary hover:bg-background-secondary text-text-primary font-medium rounded-lg transition-colors"
          >
            <Mail className="h-4 w-4" />
            Bulk Invite
          </Link>
          <InviteClientButton />
        </div>
      </div>

      <AdminRosterClient users={users} currentUserId={currentUserId} />
    </div>
  );
}
