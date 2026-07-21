"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, CreditCard, User, Users, Minus, Plus, AlertTriangle, Trash2, XCircle, ArrowRightLeft } from "lucide-react";
import type { UserPlan } from "@/lib/tiers";
import { PUBLIC_PLAN_LABELS } from "@/lib/tiers";
import type { BillingInterval } from "@/lib/pricing";
import { calculateCommunityTotal, formatCurrency } from "@/lib/pricing";
import SeatManager from "./SeatManager";

interface BillingClientProps {
  plan: UserPlan;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  accountStatus: string;
  isComped: boolean;
  stripeCheckoutReady: boolean;
  organizationId: string | null;
  orgSeatLimit: number;
  orgMemberCount: number;
  orgName: string;
  canManageSeats: boolean;
  orgAdminEmail: string | null;
  userRole: string;
}

const SOLO_FEATURES = [
  "Full AI content calendar",
  "Weekly content generation",
  "Content library & resources",
  "Brand Brain memory system",
  "Deep-dive questionnaires",
  "Analytics dashboard",
  "Social media integrations",
];

const COMMUNITY_FEATURES = [
  "Everything in Solo Membership",
  "Seat-based graduated pricing",
  "Team roster management",
  "Shared content calendar",
  "Admin controls & roles",
  "Priority support",
];

export default function BillingClient({
  plan,
  stripeCustomerId,
  stripeStatus,
  isComped,
  stripeCheckoutReady,
  organizationId,
  orgSeatLimit,
  orgMemberCount,
  orgName,
  canManageSeats,
  orgAdminEmail,
  userRole,
}: BillingClientProps) {
  const searchParams = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [seats, setSeats] = useState(3);
  const [checkoutOrgName, setCheckoutOrgName] = useState("");
  const [soloLoading, setSoloLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);

  const showSuccess = searchParams.get("success") === "1";
  const showCanceled = searchParams.get("canceled") === "1";

  const hasFullAccess = plan === "PRO";
  const membershipLabel = PUBLIC_PLAN_LABELS[plan];
  const hasCommunityMembership = hasFullAccess && !!organizationId;
  const hasSoloMembership = hasFullAccess && !organizationId;
  const isCancelScheduled = stripeStatus === "cancel_at_period_end";
  const hasActiveSubscription = !!stripeCustomerId && !isComped;
  const canShowDangerZone = hasActiveSubscription || hasFullAccess;
  const isTeamAdminSwitching = userRole === "TEAM_ADMIN" && hasCommunityMembership && !isComped;

  const communityTotal = calculateCommunityTotal(seats, billingInterval);
  const perSeat = seats > 0 ? communityTotal / seats : 0;

  async function handleSoloCheckout() {
    // If TEAM_ADMIN with community membership, show switch modal instead
    if (isTeamAdminSwitching) {
      setShowSwitchModal(true);
      return;
    }
    setError(null);
    setSoloLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseType: "solo", billingInterval }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSoloLoading(false);
    }
  }

  async function handleCommunityCheckout() {
    setError(null);
    if (seats < 2) {
      setError("Communities membership requires at least 2 seats.");
      return;
    }
    if (!checkoutOrgName.trim()) {
      setError("Organization name is required.");
      return;
    }
    setCommunityLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseType: "community",
          billingInterval,
          seats,
          organizationName: checkoutOrgName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCommunityLoading(false);
    }
  }

  async function handlePortal() {
    setError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to open billing portal");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleCancelSubscription() {
    setError(null);
    setCancelLoading(true);
    try {
      const res = await fetch("/api/stripe/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel subscription");
        return;
      }
      setShowCancelModal(false);
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setError(null);
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete account");
        return;
      }
      window.location.href = "/login";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleSwitchToSolo() {
    setError(null);
    setSwitchLoading(true);
    try {
      const res = await fetch("/api/stripe/switch-to-solo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingInterval }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to switch to solo");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSwitchLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {showSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-sm text-green-400">
          Payment successful! Your membership has been updated.
        </div>
      )}
      {showCanceled && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-400">
          Checkout was canceled. Your membership was not changed.
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Current membership card */}
      <div className="bg-background-card border border-border-primary rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Current Membership</p>
            <h2
              className="text-2xl font-bold text-accent-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {membershipLabel}
            </h2>
            {isComped && (
              <p className="text-xs text-green-400 mt-1">Complimentary access</p>
            )}
            {stripeStatus && (
              <p className="text-xs text-text-muted mt-1">
                Status:{" "}
                <span className={isCancelScheduled ? "text-yellow-400" : "capitalize"}>
                  {isCancelScheduled ? "Cancellation scheduled at period end" : stripeStatus}
                </span>
              </p>
            )}
          </div>
          {stripeCustomerId && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border-primary text-text-primary hover:bg-background-secondary transition-colors disabled:opacity-50"
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Not configured warning */}
      {!stripeCheckoutReady && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-400">
          Stripe checkout is not fully configured. Add <code className="text-xs bg-black/20 px-1 rounded">STRIPE_SECRET_KEY</code>, the four Solo/Community price IDs, and <code className="text-xs bg-black/20 px-1 rounded">NEXT_PUBLIC_APP_URL</code> to <code className="text-xs bg-black/20 px-1 rounded">.env.local</code> to enable memberships. Run <code className="text-xs bg-black/20 px-1 rounded">npm run stripe:check-env</code> to diagnose.
        </div>
      )}

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-2 p-1 bg-background-card border border-border-primary rounded-xl w-fit mx-auto">
        <button
          onClick={() => setBillingInterval("monthly")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            billingInterval === "monthly"
              ? "bg-accent-primary text-white"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingInterval("annual")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            billingInterval === "annual"
              ? "bg-accent-primary text-white"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Annual <span className="text-xs opacity-80">(2 months free)</span>
        </button>
      </div>

      {/* Membership cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Solo Membership */}
        <div className="bg-background-card border border-border-primary rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-accent-primary" />
            <h3
              className="text-lg font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Solo Membership
            </h3>
          </div>

          <div className="mb-4">
            <span className="text-3xl font-bold text-text-primary">
              {billingInterval === "monthly" ? "$200" : "$1,999"}
            </span>
            <span className="text-sm text-text-muted">
              /{billingInterval === "monthly" ? "month" : "year"}
            </span>
            {billingInterval === "annual" && (
              <p className="text-xs text-green-400 mt-1">Two months free</p>
            )}
          </div>

          <ul className="space-y-2 mb-6 flex-1">
            {SOLO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                <Check className="h-4 w-4 text-accent-primary shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          {hasSoloMembership && !isComped ? (
            <div className="text-center py-2.5 text-sm font-medium text-accent-primary">
              Your current membership
            </div>
          ) : (
            <button
              onClick={handleSoloCheckout}
              disabled={soloLoading || !stripeCheckoutReady}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 bg-accent-primary text-white"
            >
              {soloLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Start Solo Membership
            </button>
          )}
        </div>

        {/* Communities Membership */}
        <div className="bg-background-card border border-border-primary rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-accent-primary" />
            <h3
              className="text-lg font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Communities Membership
            </h3>
          </div>

          {hasCommunityMembership && !isComped ? (
            /* Existing community member — manage seats or view community info */
            <div className="space-y-4">
              <div className="mb-1">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                  Your Community
                </p>
                <p className="text-xl font-bold text-text-primary">{orgName}</p>
                <p className="text-xs text-accent-primary mt-1">Your current membership</p>
              </div>
              {canManageSeats ? (
                <SeatManager
                  seatLimit={orgSeatLimit}
                  memberCount={orgMemberCount}
                  organizationName={orgName}
                />
              ) : (
                <div className="space-y-3">
                  {orgAdminEmail && (
                    <div className="bg-background-secondary rounded-lg p-4">
                      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                        Team Admin
                      </p>
                      <a
                        href={`mailto:${orgAdminEmail}`}
                        className="text-sm text-accent-primary hover:underline"
                      >
                        {orgAdminEmail}
                      </a>
                      <p className="text-xs text-text-muted mt-2">
                        Contact your team admin for seat changes or billing questions.
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-text-muted">
                    Contact your team admin to manage seats.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Seat selector */}
              <div className="mb-3">
                <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                  Seats (min 2)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSeats(Math.max(2, seats - 1))}
                    className="p-2 rounded-lg border border-border-primary text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors"
                    disabled={seats <= 2}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={2}
                    max={25}
                    value={seats}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setSeats(Math.max(2, Math.min(25, v)));
                    }}
                    className="w-16 text-center bg-background-secondary border border-border-primary rounded-lg py-2 text-sm font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                  <button
                    onClick={() => setSeats(Math.min(25, seats + 1))}
                    className="p-2 rounded-lg border border-border-primary text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors"
                    disabled={seats >= 25}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Organization name */}
              <div className="mb-3">
                <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={checkoutOrgName}
                  onChange={(e) => setCheckoutOrgName(e.target.value)}
                  placeholder="e.g. KW Legacy Team"
                  className="w-full bg-background-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                />
              </div>

              {/* Price display */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-text-primary">
                  {formatCurrency(communityTotal)}
                </span>
                <span className="text-sm text-text-muted">
                  /{billingInterval === "monthly" ? "month" : "year"}
                </span>
                <p className="text-xs text-text-muted mt-1">
                  {formatCurrency(perSeat)}/seat
                </p>
                {billingInterval === "annual" && (
                  <p className="text-xs text-green-400 mt-1">Two months free</p>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {COMMUNITY_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                    <Check className="h-4 w-4 text-accent-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleCommunityCheckout}
                disabled={communityLoading || !stripeCheckoutReady}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 bg-accent-primary text-white"
              >
                {communityLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Start Communities Membership
              </button>
            </>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      {canShowDangerZone && (
        <div className="bg-background-card border border-red-500/20 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3
              className="text-lg font-bold text-red-400"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Danger Zone
            </h3>
          </div>

          {/* Cancel subscription at period end */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-border-primary">
            <div className="max-w-md">
              <p className="text-sm font-medium text-text-primary">
                Cancel Subscription
              </p>
              <p className="text-xs text-text-muted mt-1">
                Cancel at the end of your current billing period. You won't be charged again and will keep access until then. Your data is preserved and your account will be locked when the period ends.
              </p>
              {isCancelScheduled && (
                <p className="text-xs text-yellow-400 mt-2">
                  Cancellation is already scheduled. You can still resubscribe via the billing portal.
                </p>
              )}
            </div>
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={isCancelScheduled || cancelLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="h-4 w-4" />
              {isCancelScheduled ? "Cancellation Scheduled" : "Cancel Subscription"}
            </button>
          </div>

          {/* Delete account and all data */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="max-w-md">
              <p className="text-sm font-medium text-text-primary">
                Delete Account & All Data
              </p>
              <p className="text-xs text-text-muted mt-1">
                Permanently delete your account, all content, calendars, social connections, analytics, and settings. This cannot be undone. If you have an active subscription, it will be canceled immediately.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={deleteLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Everything
            </button>
          </div>
        </div>
      )}

      {/* Cancel subscription confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background-card border border-border-primary rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-yellow-400" />
              <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                Cancel Subscription
              </h3>
            </div>
            <p className="text-sm text-text-muted">
              Your subscription will be canceled at the end of your current billing period. You'll keep full access until then, and you won't be charged again.
            </p>
            <p className="text-sm text-text-muted">
              When the period ends, your account will be archived. Your data will be preserved in case you want to come back later.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 transition-all disabled:opacity-50"
              >
                {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel at Period End"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background-card border border-red-500/20 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-bold text-red-400" style={{ fontFamily: "var(--font-serif)" }}>
                Delete Account & All Data
              </h3>
            </div>
            <p className="text-sm text-text-muted">
              This will permanently delete your account and all associated data, including:
            </p>
            <ul className="text-xs text-text-muted space-y-1 pl-4">
              <li>• Content calendars and archives</li>
              <li>• Social media connections and tokens</li>
              <li>• Analytics and follower stats</li>
              <li>• Brand Brain memories and questionnaires</li>
              <li>• Notification preferences and push subscriptions</li>
              <li>• Any active Stripe subscription (canceled immediately)</li>
            </ul>
            <p className="text-sm font-medium text-red-400">
              This action cannot be undone.
            </p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Type DELETE to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-red-500/50 transition-colors text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== "DELETE"}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
              >
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch to Solo confirmation modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background-card border border-border-primary rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-accent-primary" />
              <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                Switch to Solo Membership
              </h3>
            </div>
            <p className="text-sm text-text-muted">
              You&apos;re currently the admin of <span className="font-medium text-text-primary">{orgName}</span> with {orgMemberCount} {orgMemberCount === 1 ? "member" : "members"}.
            </p>
            <div className="bg-background-secondary rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-text-primary uppercase tracking-wider">What happens next:</p>
              <ul className="text-xs text-text-muted space-y-1.5">
                <li>1. You&apos;ll complete solo checkout first — your community is not changed yet</li>
                <li>2. After your solo payment is processed, your community subscription is scheduled to cancel at period end</li>
                <li>3. Your team admin role is automatically transferred to the longest-tenured active member</li>
                <li>4. Your team members keep full access until the billing period ends</li>
                <li>5. You are removed from the organization and switched to solo membership</li>
              </ul>
            </div>
            {orgMemberCount <= 1 && (
              <p className="text-xs text-yellow-400">
                You&apos;re the only member. The community will simply cancel at period end — no successor is needed.
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSwitchModal(false)}
                disabled={switchLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Stay on Community
              </button>
              <button
                onClick={handleSwitchToSolo}
                disabled={switchLoading}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-accent-primary text-white hover:opacity-90 transition-all disabled:opacity-50"
              >
                {switchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Switch to Solo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
