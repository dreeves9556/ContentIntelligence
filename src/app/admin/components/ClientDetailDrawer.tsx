"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  X,
  Activity,
  CreditCard,
  Settings2,
  FileText,
  CalendarDays,
  Share2,
  ExternalLink,
} from "lucide-react";
import type { UserPlan } from "@/lib/tiers";
import {
  ACCOUNT_STATUS_LABELS,
  EXPIRATION_ACTION_LABELS,
  getEffectiveAccountStatus,
  type AccountStatus,
  type ExpirationAction,
  type UserRole,
} from "@/lib/account-access";
import { humanizeStripeStatus } from "@/lib/stripe-status";
import { StatusBadge, TagBadge, CompedBadge, PlanBadge } from "./AccountBadges";
import PlanSwitcher from "./PlanSwitcher";
import RoleSwitcher from "./RoleSwitcher";
import ResetPasswordButton from "./ResetPasswordButton";
import DeleteUserButton from "./DeleteUserButton";
import AccountManagerModal, { type AccountModalUser } from "./AccountManagerModal";
import BillingModal from "./BillingModal";
import AssignOrgButton from "./AssignOrgButton";

export interface DrawerUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  plan: UserPlan;
  createdAt: Date;
  updatedAt: Date | null;
  lastAccessCheckAt: Date | null;
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
  user: DrawerUser;
  currentUserId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ClientDetailDrawer({ user, currentUserId, onClose, onSaved }: Props) {
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const effective = getEffectiveAccountStatus(user);
  const stripe = user.stripeSubscriptionId
    ? humanizeStripeStatus(user.stripeStatus)
    : null;

  const q = user._count?.questionnaires ?? 0;
  const ps = user._count?.profileSurveys ?? 0;
  const cal = user._count?.calendars ?? 0;
  const zernio = user._count?.zernioAccounts ?? 0;
  const totalActivity = q + ps + cal + zernio;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background-card border-l border-border-primary shadow-2xl overflow-y-auto"
        role="dialog"
        aria-label={`Client details: ${user.name || user.email || user.id}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background-card border-b border-border-primary p-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 bg-[accent-primary-color]/10 rounded-full flex items-center justify-center text-[accent-primary-color] font-medium shrink-0">
              {user.name?.split(" ").map((n) => n[0]).join("") || user.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text-primary truncate">{user.name || "Unnamed User"}</p>
              <p className="text-xs text-text-muted truncate">{user.email ?? "—"}</p>
              <p className="text-xs text-text-muted mt-0.5">
                Joined {format(user.createdAt, "MMM d, yyyy")}
                {user.updatedAt && (
                  <> · Updated {format(user.updatedAt, "MMM d, yyyy")}</>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Status overview */}
          <section>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Status</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={effective} />
              <PlanBadge plan={user.plan} />
              {user.internalTag && <TagBadge tag={user.internalTag} />}
              {user.isComped && <CompedBadge isComped reason={user.compReason} />}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-text-muted">Account status</dt>
              <dd className="text-text-primary">{ACCOUNT_STATUS_LABELS[user.accountStatus]}</dd>
              {user.accessExpiresAt && (
                <>
                  <dt className="text-text-muted">Expires</dt>
                  <dd className="text-text-primary">
                    {format(user.accessExpiresAt, "MMM d, yyyy")}
                  </dd>
                  <dt className="text-text-muted">On expiry</dt>
                  <dd className="text-text-primary">
                    {EXPIRATION_ACTION_LABELS[user.expirationAction]}
                  </dd>
                </>
              )}
              {user.compReason && (
                <>
                  <dt className="text-text-muted">Comp reason</dt>
                  <dd className="text-text-primary">{user.compReason}</dd>
                </>
              )}
              {user.lastAccessCheckAt && (
                <>
                  <dt className="text-text-muted">Last access check</dt>
                  <dd className="text-text-primary">{format(user.lastAccessCheckAt, "MMM d, yyyy")}</dd>
                </>
              )}
            </dl>
          </section>

          {/* Access & plan controls */}
          <section>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Access &amp; Plan</h3>
            <div className="flex flex-wrap items-center gap-2">
              <RoleSwitcher userId={user.id} currentRole={user.role} />
              <PlanSwitcher userId={user.id} currentPlan={user.plan} />
              <button
                onClick={() => setShowAccountModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border-primary bg-background-secondary text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors"
              >
                <Settings2 className="w-3 h-3" />
                Edit account
              </button>
              {user.role === "USER" && !user.organizationId && (
                <AssignOrgButton
                  userId={user.id}
                  userName={user.name}
                  onAssigned={onSaved}
                />
              )}
            </div>
          </section>

          {/* Billing */}
          <section>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Billing</h3>
            {stripe ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${stripe.badgeClass}`}>
                    <CreditCard className="h-3 w-3" />
                    {stripe.label}
                  </span>
                  {user.stripeStatus === "trialing" && user.trialEndsAt && (
                    <span className="text-xs text-text-muted">
                      Trial ends {format(user.trialEndsAt, "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowBillingModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border-primary bg-background-secondary text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors"
                >
                  <CreditCard className="w-3 h-3" />
                  Open billing details
                </button>
              </div>
            ) : (
              <p className="text-xs text-text-muted">No Stripe subscription.</p>
            )}
          </section>

          {/* Activity */}
          <section>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Activity</h3>
            {totalActivity === 0 ? (
              <p className="text-xs text-text-muted">No activity yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center gap-2 text-text-primary">
                  <FileText className="h-3.5 w-3.5 text-text-muted" />
                  {q + ps} questionnaire{q + ps !== 1 ? "s" : ""} / profile survey{(q + ps) !== 1 ? "s" : ""}
                </li>
                <li className="flex items-center gap-2 text-text-primary">
                  <CalendarDays className="h-3.5 w-3.5 text-text-muted" />
                  {cal} calendar{cal !== 1 ? "s" : ""}
                </li>
                <li className="flex items-center gap-2 text-text-primary">
                  <Share2 className="h-3.5 w-3.5 text-text-muted" />
                  {zernio} Zernio account{zernio !== 1 ? "s" : ""}
                </li>
              </ul>
            )}
            <Link
              href={`/admin/clients/${user.id}/freshness`}
              onClick={onClose}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent-primary hover:underline"
            >
              <Activity className="h-3.5 w-3.5" />
              Open freshness debug
              <ExternalLink className="h-3 w-3" />
            </Link>
          </section>

          {/* Danger zone */}
          <section className="pt-2 border-t border-border-primary">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Account Actions</h3>
            <div className="flex flex-wrap items-center gap-2">
              <ResetPasswordButton userId={user.id} userEmail={user.email} />
              <DeleteUserButton
                userId={user.id}
                userName={user.name}
                userEmail={user.email}
                isSelf={currentUserId === user.id}
              />
            </div>
          </section>
        </div>
      </aside>

      {/* Modals launched from the drawer */}
      {showAccountModal && (
        <AccountManagerModal
          user={user as AccountModalUser}
          onClose={() => setShowAccountModal(false)}
          onSaved={() => {
            setShowAccountModal(false);
            onSaved();
          }}
        />
      )}
      {showBillingModal && (
        <BillingModal
          user={user}
          onClose={() => setShowBillingModal(false)}
        />
      )}
    </>
  );
}
