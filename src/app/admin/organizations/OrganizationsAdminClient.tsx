"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  Users,
  UserCheck,
  Mail,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Shield,
  UserCog,
} from "lucide-react";
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizations,
  type AdminOrgData,
} from "./actions";
import { PLAN_LABELS, ROLE_LABELS } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";
import { TagBadge, StatusBadge, CompedBadge } from "@/app/admin/components/AccountBadges";
import type { AccountStatus } from "@/lib/account-access";

interface OrganizationsAdminClientProps {
  initialOrgs: AdminOrgData[];
}

const PLANS: UserPlan[] = ["CALENDAR_ONLY", "PRO"];

export default function OrganizationsAdminClient({ initialOrgs }: OrganizationsAdminClientProps) {
  const router = useRouter();
  const [orgs, setOrgs] = useState(initialOrgs);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: "",
    seatLimit: "5",
    seatPlan: "PRO" as UserPlan,
    teamAdminEmail: "",
    teamAdminName: "",
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    seatLimit: "5",
    seatPlan: "CALENDAR_ONLY" as UserPlan,
  });

  function refreshData() {
    startTransition(async () => {
      const res = await getOrganizations();
      if (res.data) setOrgs(res.data);
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createOrganization({
        name: createForm.name,
        seatLimit: parseInt(createForm.seatLimit, 10) || 1,
        seatPlan: createForm.seatPlan,
        teamAdminEmail: createForm.teamAdminEmail,
        teamAdminName: createForm.teamAdminName || undefined,
      });
      if (res.success) {
        setSuccess(res.error ?? "Organization created successfully.");
        setCreateForm({ name: "", seatLimit: "5", seatPlan: "PRO", teamAdminEmail: "", teamAdminName: "" });
        setShowCreateForm(false);
        refreshData();
      } else {
        setError(res.error ?? "Failed to create organization.");
      }
    });
  }

  function startEdit(org: AdminOrgData) {
    setEditingOrgId(org.id);
    setEditForm({
      name: org.name,
      seatLimit: String(org.seatLimit),
      seatPlan: org.seatPlan,
    });
    setExpandedOrgId(org.id);
  }

  function handleUpdate(orgId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateOrganization(orgId, {
        name: editForm.name,
        seatLimit: parseInt(editForm.seatLimit, 10) || 1,
        seatPlan: editForm.seatPlan,
      });
      if (res.success) {
        setSuccess("Organization updated successfully.");
        setEditingOrgId(null);
        refreshData();
      } else {
        setError(res.error ?? "Failed to update organization.");
      }
    });
  }

  function handleDelete(orgId: string, orgName: string) {
    if (!confirm(`Delete "${orgName}"? All members will be detached from the organization. This cannot be undone.`)) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await deleteOrganization(orgId);
      if (res.success) {
        setSuccess("Organization deleted.");
        refreshData();
      } else {
        setError(res.error ?? "Failed to delete organization.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            Organizations
          </h1>
          <p className="text-text-muted mt-1">
            Create and manage team accounts with seat-based access
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Organization
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
          <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-400">{success}</p>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
          <div className="p-6 border-b border-border-primary">
            <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
              Create Organization
            </h3>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Acme Media Co."
                  className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Team Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={createForm.teamAdminEmail}
                  onChange={(e) => setCreateForm({ ...createForm, teamAdminEmail: e.target.value })}
                  placeholder="admin@acme.com"
                  className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Seat Limit
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={createForm.seatLimit}
                  onChange={(e) => setCreateForm({ ...createForm, seatLimit: e.target.value })}
                  className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Seat Plan
                </label>
                <select
                  value={createForm.seatPlan}
                  onChange={(e) => setCreateForm({ ...createForm, seatPlan: e.target.value as UserPlan })}
                  className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors text-sm"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              If the team admin email doesn&apos;t have an account yet, an invite email will be sent.
              If they already have a USER account, they&apos;ll be promoted to Team Admin.
              The team admin counts as one seat against the seat limit.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Organization
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2.5 text-text-muted hover:text-text-primary font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Organizations list */}
      {orgs.length === 0 ? (
        <div className="bg-background-card rounded-lg border border-border-primary p-12 text-center">
          <Building2 className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-muted">No organizations yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => {
            const isExpanded = expandedOrgId === org.id;
            const isEditing = editingOrgId === org.id;

            return (
              <div key={org.id} className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
                {/* Org header row */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-background-secondary rounded-lg shrink-0">
                      <Building2 className="h-5 w-5 text-text-muted" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{org.name}</p>
                      <p className="text-xs text-text-muted flex items-center gap-2 mt-0.5">
                        <span>{PLAN_LABELS[org.seatPlan]}</span>
                        <span>·</span>
                        <span>{org.seatLimit} seats</span>
                        <span>·</span>
                        <span className={org.isOverLimit ? "text-red-400" : ""}>
                          {org.usedSeats} used
                        </span>
                        {org.teamAdmin && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <UserCog className="h-3 w-3" />
                              {org.teamAdmin.name || org.teamAdmin.email}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(org)}
                      className="p-2 text-text-muted hover:text-accent-primary transition-colors rounded-md hover:bg-background-secondary"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(org.id, org.name)}
                      disabled={isPending}
                      className="p-2 text-text-muted hover:text-red-400 transition-colors rounded-md hover:bg-background-secondary"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setExpandedOrgId(isExpanded ? null : org.id)}
                      className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-md hover:bg-background-secondary"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Over-limit warning */}
                {org.isOverLimit && (
                  <div className="px-5 pb-3">
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Over seat limit — {org.usedSeats} used, {org.seatLimit} purchased. New invites are blocked.
                    </div>
                  </div>
                )}

                {/* Edit form */}
                {isEditing && isExpanded && (
                  <div className="p-5 border-t border-border-primary space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary">Edit Organization</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                          Seat Limit
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editForm.seatLimit}
                          onChange={(e) => setEditForm({ ...editForm, seatLimit: e.target.value })}
                          className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                          Seat Plan
                        </label>
                        <select
                          value={editForm.seatPlan}
                          onChange={(e) => setEditForm({ ...editForm, seatPlan: e.target.value as UserPlan })}
                          className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
                        >
                          {PLANS.map((p) => (
                            <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-text-muted">
                      Changing the seat plan will update all current non-admin members to the new plan.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleUpdate(org.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingOrgId(null)}
                        className="px-4 py-2 text-text-muted hover:text-text-primary text-sm font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded members list */}
                {isExpanded && !isEditing && (
                  <div className="border-t border-border-primary">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-px bg-border-primary">
                      <div className="bg-background-card px-5 py-3">
                        <p className="text-xs text-text-muted uppercase tracking-wider">Active</p>
                        <p className="text-lg font-bold text-text-primary mt-0.5">{org.activeUsers}</p>
                      </div>
                      <div className="bg-background-card px-5 py-3">
                        <p className="text-xs text-text-muted uppercase tracking-wider">Pending</p>
                        <p className="text-lg font-bold text-text-primary mt-0.5">{org.pendingInvites}</p>
                      </div>
                      <div className="bg-background-card px-5 py-3">
                        <p className="text-xs text-text-muted uppercase tracking-wider">Available</p>
                        <p className={`text-lg font-bold mt-0.5 ${org.isOverLimit ? "text-red-400" : "text-text-primary"}`}>
                          {Math.max(0, org.seatLimit - org.usedSeats)}
                        </p>
                      </div>
                    </div>

                    {/* Members */}
                    {org.members.length > 0 && (
                      <div className="divide-y divide-border-primary">
                        {org.members.map((member) => (
                          <div key={member.id} className="px-5 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">
                                {member.name || "Unnamed User"}
                              </p>
                              <p className="text-xs text-text-muted truncate">{member.email ?? "—"}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
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
                        ))}
                      </div>
                    )}

                    {org.members.length === 0 && (
                      <div className="px-5 py-8 text-center">
                        <Users className="h-8 w-8 text-text-muted/40 mx-auto mb-2" />
                        <p className="text-sm text-text-muted">No members yet</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
