import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Users, UserPlus, Crown, Shield, FileText, CalendarDays, Mail, Share2 } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { InviteClientButton } from "./components/InviteClientButton";
import PlanSwitcher from "./components/PlanSwitcher";
import RoleSwitcher from "./components/RoleSwitcher";
import ResetPasswordButton from "./components/ResetPasswordButton";
import DeleteUserButton from "./components/DeleteUserButton";
import type { UserPlan } from "@/lib/tiers";

export const dynamic = "force-dynamic";

interface UserWithStats {
  id: string;
  email: string | null;
  name: string | null;
  role: "USER" | "TEAM_ADMIN" | "ADMIN";
  plan: UserPlan;
  createdAt: Date;
  status: "ACTIVE" | "PENDING";
  _count?: {
    questionnaires: number;
    profileSurveys: number;
    calendars: number;
    zernioAccounts: number;
  };
}

async function getUsers(): Promise<UserWithStats[]> {
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
    ...user,
    plan: (user.plan ?? "CREATOR") as UserPlan,
    status:
      user.role === "ADMIN" ||
      (user._count?.questionnaires ?? 0) > 0 ||
      (user._count?.profileSurveys ?? 0) > 0 ||
      (user._count?.calendars ?? 0) > 0
        ? "ACTIVE"
        : "PENDING",
  }));
}

function StatusPill({ status }: { status: "ACTIVE" | "PENDING" }) {
  const styles = {
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-400" : "bg-amber-400"}`} />
      {status}
    </span>
  );
}

export default async function AdminPage() {
  const users = await getUsers();
  const session = await auth();
  const currentUserId = session?.user?.id;
  const totalClients = users.filter((u) => u.role === "USER").length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="space-y-8">
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-background-card rounded-lg p-6 border border-border-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Total Clients</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{totalClients}</p>
            </div>
            <div className="p-3 bg-[accent-primary-color]/10 rounded-lg">
              <Users className="h-5 w-5 text-[accent-primary-color]" />
            </div>
          </div>
        </div>

        <div className="bg-background-card rounded-lg p-6 border border-border-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Admin Users</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{adminCount}</p>
            </div>
            <div className="p-3 bg-[accent-primary-color]/10 rounded-lg">
              <Crown className="h-5 w-5 text-[accent-primary-color]" />
            </div>
          </div>
        </div>

        <div className="bg-background-card rounded-lg p-6 border border-border-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Total Users</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{users.length}</p>
            </div>
            <div className="p-3 bg-background-secondary rounded-lg">
              <UserPlus className="h-5 w-5 text-text-muted" />
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
        <div className="p-6 border-b border-border-primary">
          <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            All Users
          </h3>
        </div>

        {/* Mobile card list (hidden on sm+) */}
        <div className="sm:hidden divide-y divide-border-primary">
          {users.map((user) => (
            <div key={user.id} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[accent-primary-color]/10 rounded-full flex items-center justify-center text-[accent-primary-color] font-medium shrink-0">
                  {user.name?.split(" ").map((n) => n[0]).join("") || user.email?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">{user.name || "Unnamed User"}</p>
                  <p className="text-xs text-text-muted truncate">{user.email ?? "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleSwitcher userId={user.id} currentRole={user.role} />
                <PlanSwitcher userId={user.id} currentPlan={user.plan} />
                <ResetPasswordButton userId={user.id} userEmail={user.email} />
                <DeleteUserButton userId={user.id} userName={user.name} userEmail={user.email} isSelf={currentUserId === user.id} />
                <StatusPill status={user.status} />
                <span className="text-xs text-text-muted">{format(user.createdAt, "MMM d, yyyy")}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {(() => { const total = (user._count?.questionnaires ?? 0) + (user._count?.profileSurveys ?? 0); return total > 0 ? (
                  <Link
                    href={`/admin/clients/${user.id}/questionnaires`}
                    className="flex items-center gap-1 text-[accent-primary-color] hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    {total} survey{total !== 1 ? "s" : ""}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 text-text-muted">
                    <FileText className="h-3 w-3" />
                    0 surveys
                  </span>
                ); })()}
                <span className="flex items-center gap-1 text-text-muted">
                  <CalendarDays className="h-3 w-3" />
                  {user._count?.calendars || 0} calendar{user._count?.calendars !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 text-text-muted">
                  <Share2 className="h-3 w-3" />
                  {user._count?.zernioAccounts || 0} social{user._count?.zernioAccounts !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table (hidden on mobile) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Name / Email
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Actions
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Activity
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Date Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-background-secondary/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-[accent-primary-color]/10 rounded-full flex items-center justify-center text-[accent-primary-color] font-medium">
                        {user.name?.split(" ").map((n) => n[0]).join("") || user.email?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{user.name || "Unnamed User"}</p>
                        <p className="text-sm text-text-muted">{user.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <RoleSwitcher userId={user.id} currentRole={user.role} />
                  </td>
                  <td className="py-4 px-6">
                    <PlanSwitcher userId={user.id} currentPlan={user.plan} />
                  </td>
                  <td className="py-4 px-6">
                    <StatusPill status={user.status} />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <ResetPasswordButton userId={user.id} userEmail={user.email} />
                      <DeleteUserButton userId={user.id} userName={user.name} userEmail={user.email} isSelf={currentUserId === user.id} />
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-4 text-sm">
                      {(() => { const total = (user._count?.questionnaires ?? 0) + (user._count?.profileSurveys ?? 0); return total > 0 ? (
                        <Link
                          href={`/admin/clients/${user.id}/questionnaires`}
                          className="flex items-center gap-1.5 text-[accent-primary-color] hover:text-[accent-primary-color]/80 hover:underline transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {total} survey{total !== 1 ? 's' : ''}
                        </Link>
                      ) : (
                        <span className="text-text-muted flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          0 surveys
                        </span>
                      ); })()}
                      <span className="text-[#2a2a2a]">|</span>
                      <span className="text-text-muted flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {user._count?.calendars || 0} calendar{user._count?.calendars !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[#2a2a2a]">|</span>
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Share2 className="h-3.5 w-3.5" />
                        {user._count?.zernioAccounts || 0} social{user._count?.zernioAccounts !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-text-muted">
                      {format(user.createdAt, "MMM d, yyyy")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-[#2a2a2a] mx-auto mb-4" />
            <p className="text-text-muted">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
