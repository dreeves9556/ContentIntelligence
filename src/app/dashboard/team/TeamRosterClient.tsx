"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isPast } from "date-fns";
import {
  Users,
  UserCheck,
  Mail,
  UserPlus,
  Send,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
  UserMinus,
  Check,
  Clock,
} from "lucide-react";
import {
  createTeamInvite,
  cancelTeamInvite,
  resendTeamInvite,
  removeTeamMember,
  transferTeamAdmin,
  getTeamRoster,
  type TeamRosterData,
} from "./actions";
import { PLAN_LABELS, ROLE_LABELS } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";
import { TagBadge, StatusBadge, CompedBadge } from "@/app/admin/components/AccountBadges";
import type { AccountStatus } from "@/lib/account-access";

interface TeamRosterClientProps {
  initialData: TeamRosterData;
}

export default function TeamRosterClient({ initialData }: TeamRosterClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string; email: string } | null>(null);

  const { organization, usage, members, pendingInvites } = data;
  const canInvite = usage.availableSeats > 0 && !usage.isOverLimit;

  function refreshData() {
    startTransition(async () => {
      const res = await getTeamRoster();
      if (res.data) setData(res.data);
    });
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createTeamInvite(inviteEmail, inviteName || undefined);
      if (res.success) {
        setInviteEmail("");
        setInviteName("");
        setSuccess(res.error ?? "Invite sent successfully.");
        refreshData();
      } else {
        setError(res.error ?? "Failed to send invite.");
      }
    });
  }

  function handleCancelInvite(inviteId: string) {
    startTransition(async () => {
      await cancelTeamInvite(inviteId);
      refreshData();
    });
  }

  function handleResendInvite(inviteId: string) {
    startTransition(async () => {
      const res = await resendTeamInvite(inviteId);
      if (res.success) {
        setSuccess("Invite email resent.");
        setError(null);
      } else {
        setError(res.error ?? "Failed to resend invite.");
      }
    });
  }

  function handleRemoveMember(userId: string) {
    startTransition(async () => {
      const res = await removeTeamMember(userId);
      if (res.success) {
        refreshData();
      } else {
        setError(res.error ?? "Failed to remove member.");
      }
    });
  }

  function handleTransferAdmin() {
    if (!transferTarget) return;
    startTransition(async () => {
      const res = await transferTeamAdmin(transferTarget.id);
      if (res.success) {
        setSuccess(`Admin role transferred to ${transferTarget.name || transferTarget.email}. You are now a regular member.`);
        setTransferTarget(null);
        refreshData();
      } else {
        setError(res.error ?? "Failed to transfer admin role.");
      }
    });
  }

  const statCards = [
    {
      label: "Purchased Seats",
      value: usage.seatLimit,
      icon: Users,
    },
    {
      label: "Active Members",
      value: usage.activeUsers,
      icon: UserCheck,
    },
    {
      label: "Pending Invites",
      value: usage.pendingInvites,
      icon: Mail,
    },
    {
      label: "Available Seats",
      value: usage.availableSeats,
      icon: UserPlus,
      highlight: usage.availableSeats <= 0,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Team Roster
        </h1>
        <p className="text-text-muted mt-1">
          Invite and manage the accounts included with your organization&apos;s plan.
        </p>
        <p className="text-sm text-text-muted mt-2">
          <span className="font-medium text-text-primary">{organization.name}</span>
          {" · "}
          {PLAN_LABELS[organization.seatPlan as UserPlan]} plan
        </p>
      </div>

      {/* Over-limit warning */}
      {usage.isOverLimit && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Your organization is over its seat limit.
            </p>
            <p className="text-xs text-red-400/80 mt-0.5">
              You have {usage.usedSeats} used seats but only {usage.seatLimit} purchased.
              Remove members or cancel pending invites to free up seats, or contact your account manager to purchase more.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-background-card rounded-lg p-5 border border-border-primary"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider">{card.label}</p>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      card.highlight ? "text-amber-400" : "text-text-primary"
                    }`}
                  >
                    {card.value}
                  </p>
                </div>
                <div className="p-2.5 bg-background-secondary rounded-lg">
                  <Icon className="h-5 w-5 text-text-muted" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite form */}
      <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
        <div className="p-6 border-b border-border-primary">
          <h3
            className="text-lg font-semibold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Send Team Invite
          </h3>
          <p className="text-sm text-text-muted mt-1">
            Invited users will receive an email to create their account. Pending invites reserve a
            seat until they expire or are cancelled.
          </p>
        </div>

        <form onSubmit={handleInvite} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted/60" />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  disabled={!canInvite || isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Name <span className="text-text-muted/50 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
                disabled={!canInvite || isPending}
                className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {!canInvite && (
            <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {usage.isOverLimit
                ? "Your organization is over its seat limit. Remove members or cancel invites to free seats."
                : "Your organization has reached its seat limit."}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={!canInvite || isPending || !inviteEmail.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending Invite…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Team Invite
              </>
            )}
          </button>
        </form>
      </div>

      {/* Active members */}
      <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
        <div className="p-6 border-b border-border-primary">
          <h3
            className="text-lg font-semibold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Active Members
          </h3>
          <p className="text-sm text-text-muted mt-1">
            {members.length} {members.length === 1 ? "member" : "members"} in your organization
          </p>
        </div>

        {members.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
            <p className="text-text-muted">No active members yet</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border-primary">
              {members.map((member) => (
                <div key={member.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {member.name || "Unnamed User"}
                      </p>
                      <p className="text-xs text-text-muted truncate">{member.email ?? "—"}</p>
                    </div>
                    <span className="text-xs text-text-muted shrink-0">
                      {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <TagBadge tag={member.internalTag} />
                    <StatusBadge status={member.accountStatus as AccountStatus} />
                    <CompedBadge isComped={member.isComped} />
                    <span className="px-2 py-0.5 rounded-md border border-border-primary bg-background-secondary text-text-muted">
                      {PLAN_LABELS[member.plan as UserPlan]}
                    </span>
                    <span className="flex items-center gap-1 text-text-muted">
                      <Clock className="h-3 w-3" />
                      {format(new Date(member.createdAt), "MMM d, yyyy")}
                    </span>
                    {member.onboardingComplete ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="h-3 w-3" />
                        Onboarded
                      </span>
                    ) : (
                      <span className="text-amber-400">Pending onboarding</span>
                    )}
                  </div>
                  {member.role === "USER" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setTransferTarget({ id: member.id, name: member.name || "Unnamed User", email: member.email ?? "" })}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors disabled:opacity-50"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Make Admin
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Remove from org
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
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
                      Onboarding
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="text-right py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-background-secondary/50 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-medium text-text-primary">
                          {member.name || "Unnamed User"}
                        </p>
                        <p className="text-sm text-text-muted">{member.email ?? "—"}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm text-text-primary">
                            {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                          </span>
                          <TagBadge tag={member.internalTag} />
                          <StatusBadge status={member.accountStatus as AccountStatus} />
                          <CompedBadge isComped={member.isComped} />
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-text-muted">
                          {PLAN_LABELS[member.plan as UserPlan]}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {member.onboardingComplete ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <Check className="h-3 w-3" />
                            Complete
                          </span>
                        ) : (
                          <span className="text-xs text-amber-400">Pending</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-text-muted">
                          {format(new Date(member.createdAt), "MMM d, yyyy")}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {member.role === "USER" ? (
                          <div className="inline-flex items-center gap-3">
                            <button
                              onClick={() => setTransferTarget({ id: member.id, name: member.name || "Unnamed User", email: member.email ?? "" })}
                              disabled={isPending}
                              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors disabled:opacity-50"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Make Admin
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={isPending}
                              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Pending invites */}
      <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
        <div className="p-6 border-b border-border-primary">
          <h3
            className="text-lg font-semibold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Pending Invites
          </h3>
          <p className="text-sm text-text-muted mt-1">
            {pendingInvites.length} {pendingInvites.length === 1 ? "invite" : "invites"} pending
            {" · "}
            Pending invites reserve a seat until they expire or are cancelled.
          </p>
        </div>

        {pendingInvites.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
            <p className="text-text-muted">No pending invitations</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border-primary">
              {pendingInvites.map((invite) => {
                const expired = isPast(new Date(invite.expiresAt));
                return (
                  <div key={invite.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">{invite.email}</p>
                        <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {expired ? "Expired " : "Expires "}
                          {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                          expired
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {expired ? "Expired" : "Pending"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleResendInvite(invite.id)}
                        disabled={isPending || expired}
                        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Resend
                      </button>
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-primary">
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {pendingInvites.map((invite) => {
                    const expired = isPast(new Date(invite.expiresAt));
                    return (
                      <tr key={invite.id} className="hover:bg-background-secondary/50 transition-colors">
                        <td className="py-4 px-6">
                          <span className="text-sm text-text-primary">{invite.email}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-text-muted">
                            {PLAN_LABELS[invite.plan as UserPlan]}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-text-muted">
                            {format(new Date(invite.createdAt), "MMM d, yyyy")}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-text-muted">
                            {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              expired
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                expired ? "bg-red-400" : "bg-amber-400"
                              }`}
                            />
                            {expired ? "Expired" : "Pending"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              onClick={() => handleResendInvite(invite.id)}
                              disabled={isPending || expired}
                              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Resend
                            </button>
                            <button
                              onClick={() => handleCancelInvite(invite.id)}
                              disabled={isPending}
                              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {/* Transfer admin confirmation modal */}
      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background-card border border-border-primary rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-accent-primary" />
              <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                Transfer Admin Role
              </h3>
            </div>
            <p className="text-sm text-text-muted">
              You are about to transfer your team admin role to{" "}
              <span className="font-medium text-text-primary">{transferTarget.name}</span>
              {" "}({transferTarget.email}). You will become a regular member and lose access to this team roster page.
            </p>
            <p className="text-sm text-text-muted">
              This action cannot be undone from your account. The new admin will need to transfer it back if needed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setTransferTarget(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferAdmin}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-accent-primary text-white hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transfer Admin Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
