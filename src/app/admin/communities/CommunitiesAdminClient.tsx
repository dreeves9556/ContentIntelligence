"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  UsersRound,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Check,
  Crown,
  UserCog,
  X,
} from "lucide-react";
import {
  getOrganizations,
  assignTeamAdmin,
  type AdminOrgData,
} from "../organizations/actions";
import { PLAN_LABELS, ROLE_LABELS } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";
import { TagBadge, StatusBadge, CompedBadge } from "@/app/admin/components/AccountBadges";
import type { AccountStatus } from "@/lib/account-access";

interface CommunitiesAdminClientProps {
  initialOrgs: AdminOrgData[];
}

export default function CommunitiesAdminClient({ initialOrgs }: CommunitiesAdminClientProps) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [transferOrgId, setTransferOrgId] = useState<string | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<{
    orgId: string;
    orgName: string;
    userId: string;
    userName: string;
    currentAdminName: string | null;
  } | null>(null);

  function refreshData() {
    startTransition(async () => {
      const res = await getOrganizations();
      if (res.data) setOrgs(res.data);
    });
  }

  function confirmTransferAdmin(
    orgId: string,
    orgName: string,
    targetUserId: string,
    targetName: string,
    currentAdminName: string | null
  ) {
    setPendingTransfer({ orgId, orgName, userId: targetUserId, userName: targetName, currentAdminName });
  }

  function handleTransferAdmin() {
    if (!pendingTransfer) return;
    const { orgId, userId, userName } = pendingTransfer;
    setPendingTransfer(null);
    setTransferOrgId(orgId);
    setTransferTargetId(userId);
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await assignTeamAdmin(orgId, userId);
      if (res.success) {
        setSuccess(`Admin transferred to ${userName}.`);
        setTransferOrgId(null);
        setTransferTargetId(null);
        refreshData();
      } else {
        setError(res.error ?? "Failed to transfer admin.");
        setTransferOrgId(null);
        setTransferTargetId(null);
      }
    });
  }

  const totalCommunities = orgs.length;
  const totalMembers = orgs.reduce((sum, o) => sum + o.activeUsers, 0);
  const totalSeats = orgs.reduce((sum, o) => sum + o.seatLimit, 0);
  const totalAvailable = orgs.reduce((sum, o) => sum + Math.max(0, o.seatLimit - o.usedSeats), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
          Communities
        </h1>
        <p className="text-text-muted mt-1">
          Manage communities, view logins, seats, and transfer admin roles
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-background-card rounded-lg border border-border-primary p-4">
          <div className="flex items-center gap-2 mb-1">
            <UsersRound className="h-4 w-4 text-accent-primary" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Communities</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{totalCommunities}</p>
        </div>
        <div className="bg-background-card rounded-lg border border-border-primary p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-accent-primary" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Members</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{totalMembers}</p>
        </div>
        <div className="bg-background-card rounded-lg border border-border-primary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Seats</p>
          <p className="text-2xl font-bold text-text-primary">{totalSeats}</p>
        </div>
        <div className="bg-background-card rounded-lg border border-border-primary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Available</p>
          <p className="text-2xl font-bold text-emerald-400">{totalAvailable}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
          <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-400">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400/60 hover:text-emerald-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Communities list */}
      {orgs.length === 0 ? (
        <div className="bg-background-card rounded-lg border border-border-primary p-12 text-center">
          <UsersRound className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-muted">No communities yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => {
            const isExpanded = expandedOrgId === org.id;
            const availableSeats = Math.max(0, org.seatLimit - org.usedSeats);

            return (
              <div key={org.id} className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
                {/* Community header */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-background-secondary rounded-lg shrink-0">
                      <UsersRound className="h-5 w-5 text-accent-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{org.name}</p>
                      <p className="text-xs text-text-muted flex items-center gap-2 mt-0.5 flex-wrap">
                        <span>{PLAN_LABELS[org.seatPlan]}</span>
                        <span>·</span>
                        <span>{org.seatLimit} seats</span>
                        <span>·</span>
                        <span className={availableSeats === 0 ? "text-amber-400" : "text-emerald-400"}>
                          {availableSeats} available
                        </span>
                        {org.isOverLimit && (
                          <>
                            <span>·</span>
                            <span className="text-red-400 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Over limit
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Current admin badge */}
                    {org.teamAdmin ? (
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 rounded-lg">
                        <Crown className="h-3.5 w-3.5 text-accent-primary" />
                        <span className="text-xs font-medium text-accent-primary">
                          {org.teamAdmin.name || org.teamAdmin.email}
                        </span>
                      </div>
                    ) : (
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-lg">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-amber-400">No admin</span>
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedOrgId(isExpanded ? null : org.id)}
                      className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-md hover:bg-background-secondary"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Mobile admin badge */}
                {org.teamAdmin && (
                  <div className="sm:hidden px-5 pb-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 rounded-lg">
                      <Crown className="h-3.5 w-3.5 text-accent-primary" />
                      <span className="text-xs font-medium text-accent-primary">
                        {org.teamAdmin.name || org.teamAdmin.email}
                      </span>
                    </div>
                  </div>
                )}

                {/* Expanded view */}
                {isExpanded && (
                  <div className="border-t border-border-primary">
                    {/* Seat stats */}
                    <div className="grid grid-cols-4 gap-px bg-border-primary">
                      <div className="bg-background-card px-4 py-3">
                        <p className="text-xs text-text-muted uppercase tracking-wider">Active</p>
                        <p className="text-lg font-bold text-text-primary mt-0.5">{org.activeUsers}</p>
                      </div>
                      <div className="bg-background-card px-4 py-3">
                        <p className="text-xs text-text-muted uppercase tracking-wider">Pending</p>
                        <p className="text-lg font-bold text-text-primary mt-0.5">{org.pendingInvites}</p>
                      </div>
                      <div className="bg-background-card px-4 py-3">
                        <p className="text-xs text-text-muted uppercase tracking-wider">Used</p>
                        <p className={`text-lg font-bold mt-0.5 ${org.isOverLimit ? "text-red-400" : "text-text-primary"}`}>
                          {org.usedSeats}
                        </p>
                      </div>
                      <div className="bg-background-card px-4 py-3">
                        <p className="text-xs text-text-muted uppercase tracking-wider">Available</p>
                        <p className={`text-lg font-bold mt-0.5 ${availableSeats === 0 ? "text-amber-400" : "text-emerald-400"}`}>
                          {availableSeats}
                        </p>
                      </div>
                    </div>

                    {/* Members list */}
                    {org.members.length > 0 ? (
                      <div className="divide-y divide-border-primary">
                        {org.members.map((member) => {
                          const isAdmin = member.role === "TEAM_ADMIN";
                          const isTransferring = transferOrgId === org.id && transferTargetId === member.id;

                          return (
                            <div key={member.id} className="px-5 py-3 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-text-primary truncate">
                                    {member.name || "Unnamed User"}
                                  </p>
                                  {isAdmin && (
                                    <span className="inline-flex items-center gap-1 text-xs text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded">
                                      <Crown className="h-3 w-3" />
                                      Admin
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-muted truncate">{member.email ?? "—"}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <TagBadge tag={member.internalTag} />
                                  <StatusBadge status={member.accountStatus as AccountStatus} />
                                  <CompedBadge isComped={member.isComped} />
                                  <span className="text-xs text-text-muted">
                                    {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                                  </span>
                                  <span className="text-xs text-text-muted">·</span>
                                  <span className="text-xs text-text-muted">
                                    {PLAN_LABELS[member.plan as UserPlan]}
                                  </span>
                                  <span className="text-xs text-text-muted">·</span>
                                  <span className="text-xs text-text-muted">
                                    {format(new Date(member.createdAt), "MMM d, yyyy")}
                                  </span>
                                </div>
                              </div>

                              {/* Transfer admin button */}
                              {!isAdmin && member.role !== "ADMIN" && member.accountStatus !== "ARCHIVED" && (
                                <button
                                  onClick={() =>
                                    confirmTransferAdmin(
                                      org.id,
                                      org.name,
                                      member.id,
                                      member.name || member.email || "this user",
                                      org.teamAdmin?.name || org.teamAdmin?.email || null
                                    )
                                  }
                                  disabled={isPending}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20 disabled:opacity-60 rounded-lg transition-colors shrink-0"
                                >
                                  {isTransferring ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <UserCog className="h-3.5 w-3.5" />
                                  )}
                                  Make Admin
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-5 py-8 text-center">
                        <Users className="h-8 w-8 text-text-muted/40 mx-auto mb-2" />
                        <p className="text-sm text-text-muted">No members in this community</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transfer admin confirmation modal */}
      {pendingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background-card rounded-lg border border-border-primary max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent-primary/10 rounded-lg">
                <UserCog className="h-5 w-5 text-accent-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                Transfer Community Admin
              </h3>
            </div>
            <p className="text-sm text-text-muted">
              You are about to make <span className="font-medium text-text-primary">{pendingTransfer.userName}</span> the admin of{" "}
              <span className="font-medium text-text-primary">{pendingTransfer.orgName}</span>.
              {pendingTransfer.currentAdminName && (
                <>
                  {" "}The current admin <span className="font-medium text-text-primary">{pendingTransfer.currentAdminName}</span> will be demoted to a regular member.
                </>
              )}
              {" "}The new admin will take over billing responsibility for this community, including the Stripe subscription and billing portal access.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingTransfer(null)}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferAdmin}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 rounded-lg transition-colors"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
