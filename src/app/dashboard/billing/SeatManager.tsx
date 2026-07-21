"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Users,
  UserCheck,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  Check,
  Lock,
  UserX,
  X,
} from "lucide-react";
import {
  getOrgMembersForReconciliation,
  lockMembers,
  removeMembers,
  type ReconcileMember,
} from "./seat-actions";

interface SeatManagerProps {
  seatLimit: number;
  memberCount: number;
  organizationName: string;
}

export default function SeatManager({
  seatLimit: initialSeatLimit,
  memberCount: initialMemberCount,
  organizationName,
}: SeatManagerProps) {
  const [seatLimit, setSeatLimit] = useState(initialSeatLimit);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [loading, setLoading] = useState<"add" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showReconcile, setShowReconcile] = useState(false);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  async function handleAddSeat() {
    setError(null);
    setSuccess(null);
    const newQuantity = seatLimit + 1;
    setLoading("add");
    try {
      const res = await fetch("/api/stripe/update-seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", newQuantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add seat");
        return;
      }
      setSeatLimit(newQuantity);
      setSuccess(`Seat added — now ${newQuantity} seats. A prorated charge will appear on your next invoice.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleRemoveSeat() {
    setError(null);
    setSuccess(null);
    const newQuantity = seatLimit - 1;

    if (newQuantity < 2) {
      setError("Communities membership requires a minimum of 2 seats.");
      return;
    }

    // If members > new quantity, need reconciliation
    if (memberCount > newQuantity) {
      setShowReconcile(true);
      return;
    }

    // Simple case: no reconciliation needed
    setLoading("remove");
    try {
      const res = await fetch("/api/stripe/update-seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", newQuantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to remove seat");
        return;
      }
      setSeatLimit(newQuantity);
      setSuccess(`Seat reduced to ${newQuantity}. This takes effect at your next billing period.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  function handleReconcileComplete(newSeatLimit: number) {
    setSeatLimit(newSeatLimit);
    setMemberCount((prev) => prev - (seatLimit - newSeatLimit));
    setShowReconcile(false);
    setSuccess(`Seats reduced to ${newSeatLimit}. Reconciliation complete — affected members have been notified.`);
  }

  const availableSeats = seatLimit - memberCount;

  return (
    <div className="space-y-4">
      {/* Seat stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background-secondary rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-1">
            <Users className="h-4 w-4 text-text-muted mr-1.5" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Seats</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{seatLimit}</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-1">
            <UserCheck className="h-4 w-4 text-text-muted mr-1.5" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Members</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{memberCount}</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-1">
            <Plus className="h-4 w-4 text-text-muted mr-1.5" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Available</p>
          </div>
          <p className={`text-2xl font-bold ${availableSeats <= 0 ? "text-amber-400" : "text-text-primary"}`}>
            {Math.max(0, availableSeats)}
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      {/* Add/Remove buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAddSeat}
          disabled={loading !== null || seatLimit >= 25}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border border-border-primary text-text-primary hover:bg-background-secondary transition-colors disabled:opacity-50"
        >
          {loading === "add" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add Seat
        </button>
        <button
          onClick={handleRemoveSeat}
          disabled={loading !== null || seatLimit <= 2}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border border-border-primary text-text-primary hover:bg-background-secondary transition-colors disabled:opacity-50"
        >
          {loading === "remove" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Minus className="h-4 w-4" />
          )}
          Remove Seat
        </button>
      </div>

      {seatLimit >= 25 && (
        <p className="text-xs text-text-muted text-center">
          Maximum 25 seats reached. Contact support for larger teams.
        </p>
      )}

      {/* Reconciliation modal */}
      {showReconcile && (
        <SeatReconciliationModal
          currentSeats={seatLimit}
          targetSeats={seatLimit - 1}
          memberCount={memberCount}
          organizationName={organizationName}
          onClose={() => setShowReconcile(false)}
          onComplete={handleReconcileComplete}
        />
      )}
    </div>
  );
}

// ─── Seat Reconciliation Modal ──────────────────────────────────────────────

interface SeatReconciliationModalProps {
  currentSeats: number;
  targetSeats: number;
  memberCount: number;
  organizationName: string;
  onClose: () => void;
  onComplete: (newSeatLimit: number) => void;
}

type MemberAction = "lock" | "remove";

interface MemberSelection {
  memberId: string;
  action: MemberAction;
}

function SeatReconciliationModal({
  currentSeats,
  targetSeats,
  memberCount,
  organizationName,
  onClose,
  onComplete,
}: SeatReconciliationModalProps) {
  const [members, setMembers] = useState<ReconcileMember[]>([]);
  const [selections, setSelections] = useState<Record<string, MemberAction>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "confirm">("select");

  const mustSelect = memberCount - targetSeats;
  const selectedCount = Object.keys(selections).length;

  useEffect(() => {
    async function loadMembers() {
      const res = await getOrgMembersForReconciliation();
      if (res.error) {
        setError(res.error);
      } else if (res.members) {
        setMembers(res.members);
      }
      setLoading(false);
    }
    loadMembers();
  }, []);

  function toggleMember(memberId: string, action: MemberAction) {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[memberId] === action) {
        delete next[memberId];
      } else {
        // Check if we can still select more
        if (Object.keys(next).length >= mustSelect && !next[memberId]) {
          return prev;
        }
        next[memberId] = action;
      }
      return next;
    });
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const lockIds = Object.entries(selections)
      .filter(([, action]) => action === "lock")
      .map(([id]) => id);
    const removeIds = Object.entries(selections)
      .filter(([, action]) => action === "remove")
      .map(([id]) => id);

    try {
      // First, update Stripe subscription
      const stripeRes = await fetch("/api/stripe/update-seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", newQuantity: targetSeats }),
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) {
        setError(stripeData.error || "Failed to update seat count with Stripe.");
        setSubmitting(false);
        return;
      }

      // Then, apply lock/remove actions
      if (lockIds.length > 0) {
        const lockRes = await lockMembers(lockIds);
        if (!lockRes.success) {
          setError(lockRes.error || "Failed to lock some members.");
          setSubmitting(false);
          return;
        }
      }

      if (removeIds.length > 0) {
        const removeRes = await removeMembers(removeIds);
        if (!removeRes.success) {
          setError(removeRes.error || "Failed to remove some members.");
          setSubmitting(false);
          return;
        }
      }

      onComplete(targetSeats);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const lockSelectedCount = Object.values(selections).filter((a) => a === "lock").length;
  const removeSelectedCount = Object.values(selections).filter((a) => a === "remove").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-background-card border border-border-primary rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background-card border-b border-border-primary p-6 flex items-center justify-between">
          <div>
            <h3
              className="text-lg font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Reduce Seats — Reconciliation Required
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {organizationName} · {currentSeats} → {targetSeats} seats
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted">
                You have no members to reconcile. You can safely reduce your seat count.
              </p>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="mt-4 px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium rounded-lg text-sm transition-colors"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Seat Reduction"}
              </button>
            </div>
          ) : (
            <>
              {/* Explanation */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-400">
                    <p className="font-medium">
                      You&apos;re reducing from {currentSeats} to {targetSeats} seats, but you have {memberCount} members.
                    </p>
                    <p className="mt-1">
                      Select <span className="font-bold">{mustSelect}</span> member{mustSelect > 1 ? "s" : ""} to lock or remove.
                      The seat reduction takes effect at your next billing period.
                    </p>
                  </div>
                </div>
              </div>

              {/* Selection counter */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  Selected: <span className={`font-bold ${selectedCount === mustSelect ? "text-green-400" : "text-amber-400"}`}>
                    {selectedCount}
                  </span> / {mustSelect} required
                </p>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    {lockSelectedCount} lock
                  </span>
                  <span className="flex items-center gap-1">
                    <UserX className="h-3 w-3" />
                    {removeSelectedCount} remove
                  </span>
                </div>
              </div>

              {/* Member list */}
              <div className="space-y-2">
                {members.map((member) => {
                  const selection = selections[member.id];
                  const isLocked = member.accountStatus === "ARCHIVED";
                  const canSelect = selectedCount < mustSelect || !!selection;

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        selection
                          ? "border-accent-primary/40 bg-accent-primary/5"
                          : "border-border-primary bg-background-secondary"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {member.name || "Unnamed User"}
                        </p>
                        <p className="text-xs text-text-muted truncate">{member.email ?? "—"}</p>
                        {isLocked && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                            <Lock className="h-3 w-3" />
                            Already locked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={() => canSelect && toggleMember(member.id, "lock")}
                          disabled={!canSelect && !selection}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selection === "lock"
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                              : "border-border-primary text-text-muted hover:text-text-primary hover:bg-background-secondary"
                          } disabled:opacity-30 disabled:cursor-not-allowed`}
                        >
                          <Lock className="h-3 w-3 inline mr-1" />
                          Lock
                        </button>
                        <button
                          onClick={() => canSelect && toggleMember(member.id, "remove")}
                          disabled={!canSelect && !selection}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selection === "remove"
                              ? "bg-red-500/20 border-red-500/40 text-red-400"
                              : "border-border-primary text-text-muted hover:text-text-primary hover:bg-background-secondary"
                          } disabled:opacity-30 disabled:cursor-not-allowed`}
                        >
                          <UserX className="h-3 w-3 inline mr-1" />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action descriptions */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-background-secondary rounded-lg p-3">
                  <p className="font-medium text-amber-400 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Lock
                  </p>
                  <p className="text-text-muted mt-1">
                    Member stays in the org but loses access. They can be unlocked later if you add seats back.
                  </p>
                </div>
                <div className="bg-background-secondary rounded-lg p-3">
                  <p className="font-medium text-red-400 flex items-center gap-1.5">
                    <UserX className="h-3.5 w-3.5" />
                    Remove
                  </p>
                  <p className="text-text-muted mt-1">
                    Member is detached from the org and locked out. They can subscribe to their own membership.
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting || selectedCount !== mustSelect}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    `Confirm — Reduce to ${targetSeats} seats`
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
