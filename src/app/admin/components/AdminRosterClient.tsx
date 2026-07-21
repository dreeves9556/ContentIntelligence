"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { FileText, CalendarDays, Share2, Users, Crown, UserPlus, Settings2, Filter, X, Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import type { UserPlan } from "@/lib/tiers";
import type { AccountStatus, UserRole } from "@/lib/account-access";
import {
  ACCOUNT_STATUS_VALUES,
  ACCOUNT_STATUS_LABELS,
  COMMON_TAGS,
  TAG_LABELS,
} from "@/lib/account-access";
import PlanSwitcher from "./PlanSwitcher";
import RoleSwitcher from "./RoleSwitcher";
import ResetPasswordButton from "./ResetPasswordButton";
import DeleteUserButton from "./DeleteUserButton";
import { TagBadge, StatusBadge, CompedBadge } from "./AccountBadges";
import AccountManagerModal, { type AccountModalUser } from "./AccountManagerModal";
import BulkActionBar from "./BulkActionBar";

export interface RosterUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  plan: UserPlan;
  createdAt: Date;
  status: "ACTIVE" | "PENDING";
  accountStatus: AccountStatus;
  internalTag: string | null;
  isComped: boolean;
  compReason: string | null;
  accessExpiresAt: Date | null;
  expirationAction: string;
  organizationId: string | null;
  _count?: {
    questionnaires: number;
    profileSurveys: number;
    calendars: number;
    zernioAccounts: number;
  };
}

interface Props {
  users: RosterUser[];
  currentUserId?: string;
}

type FilterTag = string | "ALL";
type FilterStatus = AccountStatus | "ALL";
type FilterRole = UserRole | "ALL";
type FilterPlan = UserPlan | "ALL";

export default function AdminRosterClient({ users, currentUserId }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalUser, setModalUser] = useState<RosterUser | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filterTag, setFilterTag] = useState<FilterTag>("ALL");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [filterRole, setFilterRole] = useState<FilterRole>("ALL");
  const [filterPlan, setFilterPlan] = useState<FilterPlan>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filterTag !== "ALL" && u.internalTag !== filterTag) return false;
      if (filterStatus !== "ALL" && u.accountStatus !== filterStatus) return false;
      if (filterRole !== "ALL" && u.role !== filterRole) return false;
      if (filterPlan !== "ALL" && u.plan !== filterPlan) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, filterTag, filterStatus, filterRole, filterPlan, searchQuery]);

  const activeFilterCount =
    (filterTag !== "ALL" ? 1 : 0) +
    (filterStatus !== "ALL" ? 1 : 0) +
    (filterRole !== "ALL" ? 1 : 0) +
    (filterPlan !== "ALL" ? 1 : 0) +
    (searchQuery ? 1 : 0);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
    }
  }

  function clearFilters() {
    setFilterTag("ALL");
    setFilterStatus("ALL");
    setFilterRole("ALL");
    setFilterPlan("ALL");
    setSearchQuery("");
  }

  const selectedUsers = users.filter((u) => selectedIds.has(u.id));
  const selectedNames = selectedUsers.map((u) => u.name || u.email || u.id);

  const totalClients = users.filter((u) => u.role === "USER").length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const compedCount = users.filter((u) => u.isComped).length;

  function handleModalSave() {
    router.refresh();
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-background-card rounded-lg p-4 border border-border-primary">
          <p className="text-xs text-text-muted">Total Clients</p>
          <p className="text-xl font-bold text-text-primary mt-1">{totalClients}</p>
        </div>
        <div className="bg-background-card rounded-lg p-4 border border-border-primary">
          <p className="text-xs text-text-muted">Admins</p>
          <p className="text-xl font-bold text-text-primary mt-1">{adminCount}</p>
        </div>
        <div className="bg-background-card rounded-lg p-4 border border-border-primary">
          <p className="text-xs text-text-muted">Comped</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{compedCount}</p>
        </div>
        <div className="bg-background-card rounded-lg p-4 border border-border-primary">
          <p className="text-xs text-text-muted">Total</p>
          <p className="text-xl font-bold text-text-primary mt-1">{users.length}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-border-primary space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="flex-1 px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                activeFilterCount > 0
                  ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                  : "bg-background-secondary text-text-muted border-border-primary hover:text-text-primary"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent-primary/20 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-2 text-xs text-text-muted hover:text-text-primary"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 pt-2">
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value as FilterTag)}
                className="px-3 py-1.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
              >
                <option value="ALL">All Tags</option>
                {COMMON_TAGS.map((t) => (
                  <option key={t} value={t}>{TAG_LABELS[t] ?? t}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="px-3 py-1.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
              >
                <option value="ALL">All Statuses</option>
                {ACCOUNT_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>{ACCOUNT_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as FilterRole)}
                className="px-3 py-1.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
              >
                <option value="ALL">All Roles</option>
                <option value="USER">User</option>
                <option value="TEAM_ADMIN">Team Admin</option>
                <option value="ADMIN">Admin</option>
              </select>
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value as FilterPlan)}
                className="px-3 py-1.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
              >
                <option value="ALL">All Plans</option>
                <option value="CALENDAR_ONLY">Calendar Only</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
          )}
        </div>

        {/* Select all bar */}
        {filteredUsers.length > 0 && (
          <div className="px-6 py-2 border-b border-border-primary flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-border-primary accent-accent-primary"
            />
            <span className="text-xs text-text-muted">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : `Showing ${filteredUsers.length} of ${users.length}`}
            </span>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="w-10 py-3 px-4"></th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Name / Email
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Tag
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Expires
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Activity
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Manage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={`hover:bg-background-secondary/50 transition-colors ${selectedIds.has(user.id) ? "bg-accent-primary/5" : ""}`}
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      className="h-4 w-4 rounded border-border-primary accent-accent-primary"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-[accent-primary-color]/10 rounded-full flex items-center justify-center text-[accent-primary-color] font-medium text-sm shrink-0">
                        {user.name?.split(" ").map((n) => n[0]).join("") || user.email?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-sm truncate">{user.name || "Unnamed User"}</p>
                        <p className="text-xs text-text-muted truncate">{user.email ?? "—"}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <RoleSwitcher userId={user.id} currentRole={user.role} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      <TagBadge tag={user.internalTag} />
                      <CompedBadge isComped={user.isComped} reason={user.compReason} />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={user.accountStatus} />
                  </td>
                  <td className="py-3 px-3">
                    <PlanSwitcher userId={user.id} currentPlan={user.plan} />
                  </td>
                  <td className="py-3 px-3">
                    {user.accessExpiresAt ? (
                      <div>
                        <p className="text-xs text-text-primary">{format(user.accessExpiresAt, "MMM d, yyyy")}</p>
                        <p className="text-xs text-text-muted">{user.expirationAction.replace(/_/g, " ").toLowerCase()}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">No expiry</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-muted flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {(user._count?.questionnaires ?? 0) + (user._count?.profileSurveys ?? 0)}
                      </span>
                      <span className="text-text-muted flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {user._count?.calendars || 0}
                      </span>
                      <span className="text-text-muted flex items-center gap-1">
                        <Share2 className="h-3 w-3" />
                        {user._count?.zernioAccounts || 0}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/clients/${user.id}/freshness`}
                        className="p-1.5 rounded-lg text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                        title="Freshness Debug"
                      >
                        <Activity className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setModalUser(user)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                        title="Manage Account"
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                      <ResetPasswordButton userId={user.id} userEmail={user.email} />
                      <DeleteUserButton
                        userId={user.id}
                        userName={user.name}
                        userEmail={user.email}
                        isSelf={currentUserId === user.id}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-border-primary">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(user.id)}
                  onChange={() => toggleSelect(user.id)}
                  className="h-4 w-4 rounded border-border-primary accent-accent-primary"
                />
                <div className="h-10 w-10 bg-[accent-primary-color]/10 rounded-full flex items-center justify-center text-[accent-primary-color] font-medium shrink-0">
                  {user.name?.split(" ").map((n) => n[0]).join("") || user.email?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">{user.name || "Unnamed User"}</p>
                  <p className="text-xs text-text-muted truncate">{user.email ?? "—"}</p>
                </div>
                <Link
                  href={`/admin/clients/${user.id}/freshness`}
                  className="p-2 rounded-lg text-text-muted hover:text-accent-primary hover:bg-accent-primary/10"
                  title="Freshness Debug"
                >
                  <Activity className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setModalUser(user)}
                  className="p-2 rounded-lg text-text-muted hover:text-accent-primary hover:bg-accent-primary/10"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TagBadge tag={user.internalTag} />
                <StatusBadge status={user.accountStatus} />
                <CompedBadge isComped={user.isComped} reason={user.compReason} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleSwitcher userId={user.id} currentRole={user.role} />
                <PlanSwitcher userId={user.id} currentPlan={user.plan} />
                <ResetPasswordButton userId={user.id} userEmail={user.email} />
                <DeleteUserButton
                  userId={user.id}
                  userName={user.name}
                  userEmail={user.email}
                  isSelf={currentUserId === user.id}
                />
              </div>
              {user.accessExpiresAt && (
                <p className="text-xs text-text-muted">
                  Expires: {format(user.accessExpiresAt, "MMM d, yyyy")} · {user.expirationAction.replace(/_/g, " ").toLowerCase()}
                </p>
              )}
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-text-muted/30 mx-auto mb-4" />
            <p className="text-text-muted">No users match your filters</p>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        selectedNames={selectedNames}
        onClear={() => setSelectedIds(new Set())}
        onComplete={handleModalSave}
      />

      {/* Account manager modal */}
      {modalUser && (
        <AccountManagerModal
          user={modalUser as AccountModalUser}
          onClose={() => setModalUser(null)}
          onSaved={handleModalSave}
        />
      )}
    </div>
  );
}
