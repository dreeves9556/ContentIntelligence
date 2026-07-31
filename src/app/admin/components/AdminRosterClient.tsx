"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Users, Search, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import type { UserPlan } from "@/lib/tiers";
import type { AccountStatus, ExpirationAction, UserRole } from "@/lib/account-access";
import {
  ACCOUNT_STATUS_VALUES,
  ACCOUNT_STATUS_LABELS,
  COMMON_TAGS,
  TAG_LABELS,
  getEffectiveAccountStatus,
} from "@/lib/account-access";
import { StatusCell } from "./AccountBadges";
import BulkActionBar from "./BulkActionBar";
import ClientDetailDrawer, { type DrawerUser } from "./ClientDetailDrawer";

export interface RosterUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  plan: UserPlan;
  createdAt: Date;
  updatedAt: Date | null;
  lastAccessCheckAt: Date | null;
  status: "ACTIVE" | "PENDING";
  accountStatus: AccountStatus;
  internalTag: string | null;
  isComped: boolean;
  compReason: string | null;
  accessExpiresAt: Date | null;
  expirationAction: ExpirationAction;
  organizationId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  trialEndsAt: Date | null;
  hasUsedTrial: boolean;
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

type QuickFilter =
  | "ALL"
  | "CLIENTS"
  | "TEAM"
  | "TRIALS"
  | "NEEDS_ATTENTION"
  | "COMPED"
  | "PAST_DUE";

type SortKey = "name" | "status" | "expires" | "created";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "CLIENTS", label: "Clients" },
  { key: "TEAM", label: "Team & Admins" },
  { key: "TRIALS", label: "Trials" },
  { key: "NEEDS_ATTENTION", label: "Needs Attention" },
  { key: "COMPED", label: "Comped" },
  { key: "PAST_DUE", label: "Past Due" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  USER: "Client",
  TEAM_ADMIN: "Team Admin",
  ADMIN: "Admin",
};

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <span className="inline-block w-3" />;
  return sortDir === "asc" ? (
    <ChevronUp className="inline h-3 w-3" />
  ) : (
    <ChevronDown className="inline h-3 w-3" />
  );
}

function matchesQuickFilter(u: RosterUser, qf: QuickFilter): boolean {
  switch (qf) {
    case "ALL":
      return true;
    case "CLIENTS":
      return u.role === "USER";
    case "TEAM":
      return u.role === "TEAM_ADMIN" || u.role === "ADMIN";
    case "TRIALS":
      return u.stripeStatus === "trialing" || u.accountStatus === "TRIAL";
    case "NEEDS_ATTENTION":
      return getAttentionReason(u) !== null;
    case "COMPED":
      return u.isComped;
    case "PAST_DUE":
      return u.stripeStatus === "past_due" || u.accountStatus === "PAST_DUE";
  }
}

/**
 * Returns a short human reason when a user needs admin attention, else null.
 * Surfaced on the row so the "Needs Attention" chip is self-explanatory.
 */
function getAttentionReason(u: RosterUser): string | null {
  const eff = getEffectiveAccountStatus(u);
  if (eff === "EXPIRED") return "Access expired";
  if (eff === "PAST_DUE") return "Payment past due";
  if (eff === "TRIAL") {
    if (u.trialEndsAt) {
      const d = daysUntil(u.trialEndsAt);
      if (d < 0) return `Trial ended ${Math.abs(d)}d ago`;
      if (d <= 7) return `Trial ends in ${d}d`;
    }
    return "On trial";
  }
  if (u.accessExpiresAt) {
    const d = daysUntil(u.accessExpiresAt);
    if (d < 0) return `Access expired ${Math.abs(d)}d ago`;
    if (d <= 7) return `Access expires in ${d}d`;
  }
  return null;
}

export default function AdminRosterClient({ users, currentUserId }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerUser, setDrawerUser] = useState<RosterUser | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [filterTag, setFilterTag] = useState<FilterTag>("ALL");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [filterRole, setFilterRole] = useState<FilterRole>("ALL");
  const [filterPlan, setFilterPlan] = useState<FilterPlan>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  // Reset to first page whenever filters/search/sort change (render-time, no effect).
  const filterSignature = `${quickFilter}|${filterTag}|${filterStatus}|${filterRole}|${filterPlan}|${searchQuery}|${sortKey}|${sortDir}`;
  const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature);
  if (filterSignature !== lastFilterSignature) {
    setLastFilterSignature(filterSignature);
    setPage(0);
  }

  const filteredUsers = useMemo(() => {
    const result = users.filter((u) => {
      if (!matchesQuickFilter(u, quickFilter)) return false;
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

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id);
          break;
        case "status": {
          const ea = getEffectiveAccountStatus(a);
          const eb = getEffectiveAccountStatus(b);
          cmp = ea.localeCompare(eb);
          break;
        }
        case "expires": {
          const ta = a.accessExpiresAt?.getTime() ?? Infinity;
          const tb = b.accessExpiresAt?.getTime() ?? Infinity;
          cmp = ta - tb;
          break;
        }
        case "created":
        default:
          cmp = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [users, quickFilter, filterTag, filterStatus, filterRole, filterPlan, searchQuery, sortKey, sortDir]);

  const activeAdvancedFilterCount =
    (filterTag !== "ALL" ? 1 : 0) +
    (filterStatus !== "ALL" ? 1 : 0) +
    (filterRole !== "ALL" ? 1 : 0) +
    (filterPlan !== "ALL" ? 1 : 0);

  // Summary strip counts (computed from full list, not filtered)
  const totalClients = users.filter((u) => u.role === "USER").length;
  const teamCount = users.filter((u) => u.role === "TEAM_ADMIN" || u.role === "ADMIN").length;
  const trialsEndingSoon = users.filter(
    (u) => u.accessExpiresAt && daysUntil(u.accessExpiresAt) <= 7 && daysUntil(u.accessExpiresAt) >= 0
  ).length;
  const pastDueCount = users.filter(
    (u) => u.stripeStatus === "past_due" || u.accountStatus === "PAST_DUE"
  ).length;
  const compedCount = users.filter((u) => u.isComped).length;

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredUsers.length);
  const pageUsers = filteredUsers.slice(pageStart, pageEnd);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (pageUsers.every((u) => selectedIds.has(u.id))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageUsers.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageUsers.forEach((u) => next.add(u.id));
        return next;
      });
    }
  }

  function clearFilters() {
    setQuickFilter("ALL");
    setFilterTag("ALL");
    setFilterStatus("ALL");
    setFilterRole("ALL");
    setFilterPlan("ALL");
    setSearchQuery("");
  }

  function setSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created" ? "desc" : "asc");
    }
  }

  const selectedUsers = users.filter((u) => selectedIds.has(u.id));
  const selectedNames = selectedUsers.map((u) => u.name || u.email || u.id);

  function handleSaved() {
    setDrawerUser(null);
    // Trigger a refresh via router passed up — but we don't have router here.
    // The parent page is server-rendered; we reload to reflect changes.
    window.location.reload();
  }

  const summaryStats = [
    { label: "Clients", value: totalClients, onClick: () => setQuickFilter("CLIENTS") },
    { label: "Team & Admins", value: teamCount, onClick: () => setQuickFilter("TEAM") },
    {
      label: "Trials ending ≤7d",
      value: trialsEndingSoon,
      onClick: () => setQuickFilter("NEEDS_ATTENTION"),
      highlight: trialsEndingSoon > 0,
    },
    {
      label: "Past due",
      value: pastDueCount,
      onClick: () => setQuickFilter("PAST_DUE"),
      highlight: pastDueCount > 0,
    },
    { label: "Comped", value: compedCount, onClick: () => setQuickFilter("COMPED") },
  ];

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {summaryStats.map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors"
          >
            <span className={`font-bold ${s.highlight ? "text-amber-400" : "text-text-primary"}`}>
              {s.value}
            </span>
            <span className="text-xs">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Quick filter chips + search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.key}
              onClick={() => setQuickFilter(qf.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                quickFilter === qf.key
                  ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                  : "bg-background-secondary text-text-muted border-border-primary hover:text-text-primary"
              }`}
            >
              {qf.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 bg-background-card border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              activeAdvancedFilterCount > 0
                ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                : "bg-background-card text-text-muted border-border-primary hover:text-text-primary"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            More
            {activeAdvancedFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent-primary/20 text-xs">
                {activeAdvancedFilterCount}
              </span>
            )}
          </button>
          {(activeAdvancedFilterCount > 0 || searchQuery || quickFilter !== "ALL") && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-2 text-xs text-text-muted hover:text-text-primary"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap gap-2 p-3 bg-background-card border border-border-primary rounded-lg">
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
              <option value="USER">Client</option>
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

      {/* Table */}
      <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
        {/* Select-all bar */}
        {filteredUsers.length > 0 && (
          <div className="px-4 py-2 border-b border-border-primary flex items-center gap-3">
            <input
              type="checkbox"
              checked={pageUsers.length > 0 && pageUsers.every((u) => selectedIds.has(u.id))}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-border-primary accent-accent-primary"
            />
            <span className="text-xs text-text-muted">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : `Showing ${pageStart + 1}–${pageEnd} of ${filteredUsers.length}`}
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
                  <button onClick={() => setSort("name")} className="inline-flex items-center gap-1 hover:text-text-primary">
                    Client <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  <button onClick={() => setSort("status")} className="inline-flex items-center gap-1 hover:text-text-primary">
                    Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  <button onClick={() => setSort("expires")} className="inline-flex items-center gap-1 hover:text-text-primary">
                    Expires <SortIcon col="expires" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">Activity</th>
                <th className="w-10 py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {pageUsers.map((user) => {
                const q = (user._count?.questionnaires ?? 0) + (user._count?.profileSurveys ?? 0);
                const cal = user._count?.calendars ?? 0;
                const zernio = user._count?.zernioAccounts ?? 0;
                const totalActivity = q + cal + zernio;
                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-background-secondary/50 transition-colors cursor-pointer ${selectedIds.has(user.id) ? "bg-accent-primary/5" : ""}`}
                    onClick={() => setDrawerUser(user)}
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
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
                          <p className="text-xs text-text-muted mt-0.5">{ROLE_LABELS[user.role]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <StatusCell user={user} />
                      {(() => {
                        const reason = getAttentionReason(user);
                        return reason ? (
                          <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {reason}
                          </p>
                        ) : null;
                      })()}
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
                      {totalActivity === 0 ? (
                        <span className="text-xs text-text-muted">No activity</span>
                      ) : (
                        <p className="text-xs text-text-muted">
                          {q > 0 && <>{q} questionnaire{q !== 1 ? "s" : ""} · </>}
                          {cal > 0 && <>{cal} calendar{cal !== 1 ? "s" : ""} · </>}
                          {zernio > 0 && <>{zernio} zernio</>}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-text-muted">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDrawerUser(user); }}
                        className="p-1.5 rounded-lg hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                        aria-label="Open client details"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-border-primary">
          {pageUsers.map((user) => {
            const q = (user._count?.questionnaires ?? 0) + (user._count?.profileSurveys ?? 0);
            const cal = user._count?.calendars ?? 0;
            const zernio = user._count?.zernioAccounts ?? 0;
            const totalActivity = q + cal + zernio;
            return (
              <button
                key={user.id}
                onClick={() => setDrawerUser(user)}
                className="w-full text-left p-4 space-y-3 hover:bg-background-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(user.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-border-primary accent-accent-primary"
                  />
                  <div className="h-10 w-10 bg-[accent-primary-color]/10 rounded-full flex items-center justify-center text-[accent-primary-color] font-medium shrink-0">
                    {user.name?.split(" ").map((n) => n[0]).join("") || user.email?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary truncate">{user.name || "Unnamed User"}</p>
                    <p className="text-xs text-text-muted truncate">{user.email ?? "—"}</p>
                    <p className="text-xs text-text-muted mt-0.5">{ROLE_LABELS[user.role]}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
                </div>
                <StatusCell user={user} />
                {(() => {
                  const reason = getAttentionReason(user);
                  return reason ? (
                    <p className="text-xs text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {reason}
                    </p>
                  ) : null;
                })()}
                {user.accessExpiresAt && (
                  <p className="text-xs text-text-muted">
                    Expires {format(user.accessExpiresAt, "MMM d, yyyy")} · {user.expirationAction.replace(/_/g, " ").toLowerCase()}
                  </p>
                )}
                {totalActivity > 0 && (
                  <p className="text-xs text-text-muted">
                    {q > 0 && <>{q} questionnaire{q !== 1 ? "s" : ""} · </>}
                    {cal > 0 && <>{cal} calendar{cal !== 1 ? "s" : ""} · </>}
                    {zernio > 0 && <>{zernio} zernio</>}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-text-muted/30 mx-auto mb-4" />
            <p className="text-text-muted">No users match your filters</p>
          </div>
        )}

        {/* Pagination */}
        {filteredUsers.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-border-primary flex items-center justify-between text-xs text-text-muted">
            <span>
              Page {safePage + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={safePage === 0}
                className="p-1.5 rounded-lg hover:bg-background-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="p-1.5 rounded-lg hover:bg-background-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-background-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={safePage >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-background-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        selectedNames={selectedNames}
        onClear={() => setSelectedIds(new Set())}
        onComplete={() => setSelectedIds(new Set())}
      />

      {/* Detail drawer */}
      {drawerUser && (
        <ClientDetailDrawer
          user={drawerUser as DrawerUser}
          currentUserId={currentUserId}
          onClose={() => setDrawerUser(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
