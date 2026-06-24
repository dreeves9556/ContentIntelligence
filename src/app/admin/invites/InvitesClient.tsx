"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Send,
  Loader2,
  Check,
  X,
  Trash2,
  Copy,
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

const PLANS: UserPlan[] = ["CALENDAR_ONLY", "CREATOR", "PRO"];

const PLAN_STYLES: Record<UserPlan, string> = {
  CALENDAR_ONLY: "text-[#787878] bg-[#1a1a1a] border-[#2a2a2a]",
  CREATOR: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  PRO: "text-[#c8952a] bg-[#c8952a]/10 border-[#c8952a]/30",
};

interface InvitesClientProps {
  initialInvites: PendingInvite[];
}

export default function InvitesClient({ initialInvites }: InvitesClientProps) {
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<UserPlan>("CREATOR");
  const [results, setResults] = useState<BulkInviteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>(initialInvites);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setInvites(initialInvites);
  }, [initialInvites]);

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
      setInvites((prev) =>
        prev.map((i) => (i.id === inviteId ? { ...i, plan } : i))
      );
    });
  }

  function handleDelete(inviteId: string) {
    startTransition(async () => {
      await deleteInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    });
  }

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results ? results.length - successCount : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold text-[#e8e8e8]"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Bulk Invites
        </h1>
        <p className="text-[#787878] mt-1">
          Send invitations to multiple clients at once and manage their subscription tiers
        </p>
      </div>

      {/* Bulk Invite Form */}
      <div className="bg-[#111111] rounded-lg border border-[#1a1a1a] overflow-hidden">
        <div className="p-6 border-b border-[#1a1a1a]">
          <h3
            className="text-lg font-semibold text-[#e8e8e8]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Send Invitations
          </h3>
          <p className="text-sm text-[#787878] mt-1">
            Paste email addresses separated by commas, spaces, or new lines. All invites will be assigned the selected plan.
          </p>
        </div>

        <form onSubmit={handleBulkInvite} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#787878] uppercase tracking-wider mb-2">
              Email Addresses
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-[#787878]" />
              <textarea
                required
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="alice@example.com, bob@example.com, carol@example.com"
                rows={4}
                className="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] placeholder-[#3a3a3a] focus:outline-none focus:border-[#c8952a]/50 transition-colors text-sm resize-y"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787878] uppercase tracking-wider mb-2">
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
                      : "text-[#787878] bg-[#0a0a0a] border-[#2a2a2a] hover:border-[#3a3a3a]"
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
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#c8952a] hover:bg-[#c8952a]/90 disabled:opacity-60 disabled:cursor-not-allowed text-[#0a0a0a] font-medium rounded-lg transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending Invites…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Invitations
              </>
            )}
          </button>
        </form>

        {/* Results */}
        {results && (
          <div className="px-6 pb-6 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                {successCount} sent
              </span>
              {failCount > 0 && (
                <span className="text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  {failCount} failed
                </span>
              )}
            </div>

            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg divide-y divide-[#1a1a1a]">
              {results.map((r, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3">
                  <div className="shrink-0">
                    {r.success ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <span className="text-sm text-[#e8e8e8] truncate flex-1">
                    {r.email}
                  </span>
                  {r.error && (
                    <span className="text-xs text-amber-400 truncate max-w-[200px]">
                      {r.error}
                    </span>
                  )}
                  {r.url && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(r.url!);
                      }}
                      className="text-[#787878] hover:text-[#c8952a] transition-colors shrink-0"
                      title="Copy link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pending Invites — Tier Assignment */}
      <div className="bg-[#111111] rounded-lg border border-[#1a1a1a] overflow-hidden">
        <div className="p-6 border-b border-[#1a1a1a]">
          <h3
            className="text-lg font-semibold text-[#e8e8e8]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Pending Invitations
          </h3>
          <p className="text-sm text-[#787878] mt-1">
            Assign subscription tiers to invited clients before they register. Once they create an account, they&apos;ll appear in the Client Roster.
          </p>
        </div>

        {invites.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="h-12 w-12 text-[#2a2a2a] mx-auto mb-4" />
            <p className="text-[#787878]">No pending invitations</p>
            <p className="text-xs text-[#3a3a3a] mt-1">
              Sent invites will appear here until the recipient registers
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[#1a1a1a]">
              {invites.map((invite) => {
                const expired = isPast(new Date(invite.expiresAt));
                return (
                  <div key={invite.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-[#e8e8e8] truncate">
                          {invite.email}
                        </p>
                        <p className="text-xs text-[#787878] flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {expired ? "Expired " : "Expires "}
                          {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(invite.id)}
                        disabled={isPending}
                        className="text-[#787878] hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <InvitePlanDropdown
                      inviteId={invite.id}
                      currentPlan={invite.plan}
                      onChange={handlePlanChange}
                      disabled={isPending}
                    />
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="text-left py-4 px-6 text-xs font-medium text-[#787878] uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-[#787878] uppercase tracking-wider">
                      Subscription Tier
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-[#787878] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-[#787878] uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="text-right py-4 px-6 text-xs font-medium text-[#787878] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {invites.map((invite) => {
                    const expired = isPast(new Date(invite.expiresAt));
                    return (
                      <tr
                        key={invite.id}
                        className="hover:bg-[#1a1a1a]/50 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <span className="text-sm text-[#e8e8e8]">
                            {invite.email}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <InvitePlanDropdown
                            inviteId={invite.id}
                            currentPlan={invite.plan}
                            onChange={handlePlanChange}
                            disabled={isPending}
                          />
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
                        <td className="py-4 px-6">
                          <span className="text-sm text-[#787878]">
                            {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleDelete(invite.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 text-xs text-[#787878] hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoke
                          </button>
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
    </div>
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

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
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
            className="fixed z-[9999] w-44 bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {PLANS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setOpen(false);
                  if (p !== currentPlan) onChange(inviteId, p);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors hover:bg-[#1a1a1a] ${
                  p === currentPlan ? "text-[#e8e8e8]" : "text-[#787878]"
                }`}
              >
                <span
                  className={`px-2 py-0.5 rounded-md border ${PLAN_STYLES[p]}`}
                >
                  {PLAN_LABELS[p]}
                </span>
                {p === currentPlan && (
                  <Check className="w-3 h-3 text-[#c8952a]" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
