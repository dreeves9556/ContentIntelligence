"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CreditCard, Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { getStripeBillingDetails, type StripeBillingDetails } from "../actions/billing-actions";

interface BillingModalUser {
  id: string;
  email: string | null;
  name: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripeStatus: string | null;
  trialEndsAt: Date | null;
  hasUsedTrial: boolean;
}

interface Props {
  user: BillingModalUser;
  onClose: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatStatus(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    trialing: { label: "Trial", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    active: { label: "Active", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    past_due: { label: "Past Due", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    canceled: { label: "Canceled", color: "text-red-400 bg-red-500/10 border-red-500/20" },
    unpaid: { label: "Unpaid", color: "text-red-400 bg-red-500/10 border-red-500/20" },
    incomplete: { label: "Incomplete", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    incomplete_expired: { label: "Expired", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  };
  return map[status] ?? { label: status, color: "text-text-muted bg-background-secondary border-border-primary" };
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function BillingModal({ user, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<StripeBillingDetails | null>(null);

  useEffect(() => {
    if (!user.stripeSubscriptionId) {
      setError("No Stripe subscription found for this user");
      setLoading(false);
      return;
    }

    setLoading(true);
    getStripeBillingDetails(user.stripeSubscriptionId)
      .then((res) => {
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          setDetails(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, [user.stripeSubscriptionId]);

  const statusInfo = details ? formatStatus(details.status) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background-card rounded-xl border border-border-primary shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-accent-primary/10 rounded-full flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Stripe Billing</h2>
              <p className="text-xs text-text-muted">{user.name || user.email || "Unknown user"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
              <span className="ml-3 text-sm text-text-muted">Loading billing details...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/5 rounded-lg border border-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {details && !loading && (
            <>
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusInfo?.color}`}>
                  {details.status === "active" && <CheckCircle2 className="h-4 w-4" />}
                  {details.status === "trialing" && <Clock className="h-4 w-4" />}
                  {details.status === "past_due" && <AlertCircle className="h-4 w-4" />}
                  {statusInfo?.label}
                </span>
                {details.cancelAtPeriodEnd && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-orange-500/10 text-orange-400 border-orange-500/20">
                    Cancels at period end
                  </span>
                )}
              </div>

              {/* Trial info */}
              {details.trialEnd && (
                <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/20 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <p className="text-sm font-medium text-text-primary">Trial Period</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-text-muted">Trial start</p>
                      <p className="text-text-primary">{format(new Date(details.trialStart!), "MMM d, yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Trial end</p>
                      <p className="text-text-primary">{format(new Date(details.trialEnd), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  {details.status === "trialing" && (
                    <p className="text-xs text-blue-400 font-medium">
                      {daysUntil(details.trialEnd) > 0
                        ? `${daysUntil(details.trialEnd)} days remaining`
                        : daysUntil(details.trialEnd) === 0
                        ? "Trial ends today"
                        : `Trial expired ${Math.abs(daysUntil(details.trialEnd))} days ago`}
                    </p>
                  )}
                </div>
              )}

              {/* Billing period */}
              {details.currentPeriodEnd && (
                <div className="p-4 bg-background-secondary rounded-lg border border-border-primary space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-accent-primary" />
                    <p className="text-sm font-medium text-text-primary">Current Billing Period</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-text-muted">Period start</p>
                      <p className="text-text-primary">{format(new Date(details.currentPeriodStart!), "MMM d, yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Period end</p>
                      <p className="text-text-primary">{format(new Date(details.currentPeriodEnd), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  {details.status === "active" && (
                    <p className="text-xs text-text-muted">
                      {daysUntil(details.currentPeriodEnd) > 0
                        ? `${daysUntil(details.currentPeriodEnd)} days until next billing date`
                        : `Billing date is today`}
                    </p>
                  )}
                </div>
              )}

              {/* Price */}
              {details.amount != null && (
                <div className="p-4 bg-background-secondary rounded-lg border border-border-primary">
                  <p className="text-sm font-medium text-text-primary mb-2">Pricing</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-text-muted">Amount</p>
                      <p className="text-text-primary">
                        {formatCurrency(details.amount, details.currency ?? "usd")}
                        {details.interval && ` / ${details.interval}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-muted">Quantity</p>
                      <p className="text-text-primary">{details.quantity ?? 1}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Latest invoice */}
              {details.latestInvoiceId && (
                <div className="p-4 bg-background-secondary rounded-lg border border-border-primary">
                  <p className="text-sm font-medium text-text-primary mb-2">Latest Invoice</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-text-muted">Invoice ID</p>
                      <p className="text-text-primary font-mono text-xs">{details.latestInvoiceId}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Status</p>
                      <p className="text-text-primary">{details.latestInvoiceStatus ?? "—"}</p>
                    </div>
                    {details.latestInvoiceAmount != null && (
                      <div>
                        <p className="text-text-muted">Amount paid</p>
                        <p className="text-text-primary">
                          {formatCurrency(details.latestInvoiceAmount, details.currency ?? "usd")}
                        </p>
                      </div>
                    )}
                    {details.latestInvoicePaidAt && (
                      <div>
                        <p className="text-text-muted">Paid at</p>
                        <p className="text-text-primary">{format(new Date(details.latestInvoicePaidAt), "MMM d, yyyy")}</p>
                      </div>
                    )}
                    {details.nextInvoiceAttempt && (
                      <div className="col-span-2">
                        <p className="text-text-muted">Next payment attempt</p>
                        <p className="text-text-primary">{format(new Date(details.nextInvoiceAttempt), "MMM d, yyyy h:mm a")}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Subscription IDs */}
              <div className="p-4 bg-background-secondary rounded-lg border border-border-primary space-y-2">
                <p className="text-sm font-medium text-text-primary">Stripe IDs</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Subscription</span>
                    <span className="text-text-primary font-mono">{details.subscriptionId}</span>
                  </div>
                  {details.priceId && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Price ID</span>
                      <span className="text-text-primary font-mono">{details.priceId}</span>
                    </div>
                  )}
                  {details.customerEmail && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Customer email</span>
                      <span className="text-text-primary">{details.customerEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              {details.canceledAt && (
                <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                  <p className="text-sm font-medium text-red-400">Subscription Canceled</p>
                  <p className="text-xs text-text-muted mt-1">
                    Canceled on {format(new Date(details.canceledAt), "MMM d, yyyy")}
                  </p>
                </div>
              )}
            </>
          )}

          {!loading && !error && !details && (
            <div className="text-center py-12">
              <p className="text-sm text-text-muted">No billing data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
