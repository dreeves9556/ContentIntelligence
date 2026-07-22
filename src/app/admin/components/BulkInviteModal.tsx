"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Send,
  Loader2,
  Check,
  X,
  Trash2,
  AlertCircle,
  ChevronDown,
  Clock,
} from "lucide-react";
import {
  bulkCreateInvites,
  updateInvitePlan,
  deleteInvite,
  type PendingInvite,
  type BulkInviteResult,
} from "../actions";
import { PLAN_LABELS } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";
import { format, isPast } from "date-fns";

const PLANS: UserPlan[] = ["CALENDAR_ONLY", "PRO"];

const PLAN_STYLES: Record<UserPlan, string> = {
  CALENDAR_ONLY: "text-text-muted bg-background-secondary border-border-primary",
  PRO: "text-accent-primary bg-accent-primary/10 border-[#c8952a]/30",
};

interface BulkInviteModalProps {
  invites: PendingInvite[];
}

export default function BulkInviteModal({ invites: initialInvites }: BulkInviteModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<UserPlan>("PRO");
  const [results, setResults] = useState<BulkInviteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState(initialInvites);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setEmails("");
    setResults(null);
    setError(null);
  }

  function handleBulkInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    startTransition(async () => {
      const res = await bulkCreateInvites(emails, selectedPlan);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResults(res.results);
      setEmails("");
      router.refresh();
    });
  }

  function handlePlanChange(inviteId: string, plan: UserPlan) {
    startTransition(async () => {
      await updateInvitePlan(inviteId, plan);
      router.refresh();
    });
  }

  function handleDelete(inviteId: string) {
    startTransition(async () => {
      await deleteInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      router.refresh();
    });
  }

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results ? results.length - successCount : 0;

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-background-secondary hover:bg-background-secondary text-text-primary font-medium rounded-lg transition-colors"
      >
        <Mail className="h-4 w-4" />
        Bulk Invite
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="relative bg-background-card rounded-xl border border-border-primary max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-background-card border-b border-border-primary p-5 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                  Bulk Invites
                </h3>
                <p className="text-sm text-text-muted mt-0.5">
                  Send invitations to multiple clients at once
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Bulk Invite Form */}
              <form onSubmit={handleBulkInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    Email Addresses
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-text-muted" />
                    <textarea
                      required
                      value={emails}
                      onChange={(e) => setEmails(e.target.value)}
                      placeholder="alice@example.com, bob@example.com, carol@example.com"
                      rows={3}
                      className="w-full pl-10 pr-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm resize-y"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    Subscription Tier
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLANS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPlan(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          selectedPlan === p
                            ? PLAN_STYLES[p] + " ring-1 ring-[#c8952a]/30"
                            : "text-text-muted bg-background-secondary border-border-primary hover:border-accent-primary/40"
                        }`}
                      >
                        {PLAN_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isPending || !emails.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending Invites…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Invites
                    </>
                  )}
                </button>
              </form>

              {/* Results */}
              {results && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <Check className="h-4 w-4" />
                      {successCount} invited
                    </span>
                    {failCount > 0 && (
                      <span className="text-red-400 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4" />
                        {failCount} failed
                      </span>
                    )}
                  </div>

                  <div className="bg-background-secondary border border-border-primary rounded-lg divide-y divide-border-primary">
                    {results.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3">
                        <div className="shrink-0">
                          {r.success ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <X className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                        <span className="text-sm text-text-primary truncate flex-1">
                          {r.email}
                        </span>
                        {r.error && (
                          <span className="text-xs text-amber-400 truncate max-w-[200px]">
                            {r.error}
                          </span>
                        )}
                        {r.success && !r.error && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1 shrink-0">
                            <Mail className="h-3 w-3" />
                            Email sent
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Invites */}
              <div className="border-t border-border-primary pt-5">
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  Pending Invitations
                </h4>

                {invites.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="h-10 w-10 text-text-muted/30 mx-auto mb-3" />
                    <p className="text-text-muted text-sm">No pending invitations</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invites.map((invite) => {
                      const expired = isPast(new Date(invite.expiresAt));
                      return (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between gap-3 p-3 bg-background-secondary border border-border-primary rounded-lg"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text-primary truncate">{invite.email}</p>
                            <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {expired ? "Expired " : "Expires "}
                              {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <InvitePlanDropdown
                              inviteId={invite.id}
                              currentPlan={invite.plan}
                              onChange={handlePlanChange}
                              disabled={isPending}
                            />
                            <button
                              onClick={() => handleDelete(invite.id)}
                              disabled={isPending}
                              className="text-text-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InvitePlanDropdown({
  inviteId,
  currentPlan,
  onChange,
  disabled,
}: {
  inviteId: string;
  currentPlan: UserPlan;
  onChange: (inviteId: string, plan: UserPlan) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
    setOpen((current) => !current);
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${PLAN_STYLES[currentPlan]} hover:opacity-80 disabled:opacity-50`}
      >
        {PLAN_LABELS[currentPlan]}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[9999] w-44 bg-background-card border border-border-primary rounded-lg shadow-xl overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {PLANS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setOpen(false);
                  if (p !== currentPlan) onChange(inviteId, p);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors hover:bg-background-secondary ${
                  p === currentPlan ? "text-text-primary" : "text-text-muted"
                }`}
              >
                <span
                  className={`px-2 py-0.5 rounded-md border ${PLAN_STYLES[p]}`}
                >
                  {PLAN_LABELS[p]}
                </span>
                {p === currentPlan && (
                  <Check className="w-3 h-3 text-accent-primary" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
