"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Send,
  Loader2,
  Trash2,
  AlertCircle,
  Clock,
  RefreshCw,
  CheckCircle2,
  MailCheck,
  MailWarning,
} from "lucide-react";
import {
  resendPendingInviteEmail,
  deletePendingStripeInvite,
  type PendingStripeInviteRow,
} from "./actions";
import { format } from "date-fns";

interface PendingInvitesClientProps {
  initialInvites: PendingStripeInviteRow[];
}

export default function PendingInvitesClient({ initialInvites }: PendingInvitesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ id: string; success: boolean; msg: string } | null>(
    null
  );
  const [search, setSearch] = useState("");

  function handleResend(inviteId: string, email: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await resendPendingInviteEmail(inviteId);
      if (res.success) {
        setFeedback({ id: inviteId, success: true, msg: `Email sent to ${email}` });
      } else {
        setFeedback({ id: inviteId, success: false, msg: res.error ?? "Failed to send" });
      }
      router.refresh();
    });
  }

  function handleDelete(inviteId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await deletePendingStripeInvite(inviteId);
      if (res.warning) {
        setFeedback({ id: inviteId, success: true, msg: res.warning });
      }
      router.refresh();
    });
  }

  const filtered = initialInvites.filter((inv) =>
    inv.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Pending Stripe Invites
        </h1>
        <p className="text-text-muted mt-1">
          Users who paid via the public homepage but haven&apos;t created their account yet.
          Resend registration emails or revoke pending invites.
        </p>
      </div>

      {initialInvites.length === 0 ? (
        <div className="bg-background-card rounded-lg border border-border-primary p-12 text-center">
          <Mail className="h-12 w-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-muted">No pending Stripe invites</p>
          <p className="text-xs text-text-muted/60 mt-1">
            Users who purchase via the homepage but haven&apos;t registered will appear here
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email…"
                className="w-full pl-10 pr-4 py-2 bg-background-card border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50"
              />
            </div>
            <span className="text-xs text-text-muted">
              {filtered.length} pending {filtered.length === 1 ? "invite" : "invites"}
            </span>
          </div>

          {feedback && (
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${
                feedback.success
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {feedback.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {feedback.msg}
            </div>
          )}

          <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border-primary">
              {filtered.map((inv) => (
                <div key={inv.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{inv.email}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {inv.purchaseType === "community" ? "Community" : "Solo"} ·{" "}
                        {inv.billingInterval} · {inv.inviteRole}
                      </p>
                      <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {inv.expired ? "Expired " : "Expires "}
                        {format(new Date(inv.expiresAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                        inv.expired
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {inv.expired ? "Expired" : "Pending"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResend(inv.id, inv.email)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-medium rounded-md disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Resend
                    </button>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-text-muted hover:text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
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
                      Type
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Role
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-right py-4 px-6 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {filtered.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-background-secondary/50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <span className="text-sm text-text-primary">{inv.email}</span>
                        {inv.organizationName && (
                          <span className="block text-xs text-text-muted mt-0.5">
                            {inv.organizationName}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-text-muted">
                          {inv.purchaseType === "community" ? "Community" : "Solo"}
                          <span className="text-text-muted/50 ml-1">({inv.billingInterval})</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-text-muted">{inv.inviteRole}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            inv.expired
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              inv.expired ? "bg-red-400" : "bg-amber-400"
                            }`}
                          />
                          {inv.expired ? "Expired" : "Pending"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-text-muted">
                          {format(new Date(inv.createdAt), "MMM d, yyyy")}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-text-muted">
                          {format(new Date(inv.expiresAt), "MMM d, yyyy")}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {inv.lastEmailError ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/10 text-red-400 border-red-500/20" title={inv.lastEmailError}>
                            <MailWarning className="h-3 w-3" />
                            Failed
                          </span>
                        ) : inv.emailSentAt ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20" title={`Sent ${format(new Date(inv.emailSentAt), "MMM d, h:mm a")}`}>
                            <MailCheck className="h-3 w-3" />
                            Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-background-secondary text-text-muted border-border-primary">
                            <Mail className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            onClick={() => handleResend(inv.id, inv.email)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 text-xs text-accent-primary hover:text-accent-primary/80 transition-colors disabled:opacity-50"
                          >
                            {isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            Resend
                          </button>
                          <button
                            onClick={() => handleDelete(inv.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
