"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2, RotateCcw, CheckCircle2, ArrowLeft } from "lucide-react";
import type { RecoveryListRow, RecoveryDetailRow } from "@/lib/seat-recovery-service";
import { getRecoveryOp, resolveRecoveryOp } from "./actions";

interface Props {
  initialRows: RecoveryListRow[];
}

export default function SeatReconciliationAdminClient({ initialRows }: Props) {
  const [rows] = useState(initialRows);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecoveryDetailRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();

  async function loadDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setError(null);
    setSuccess(null);
    setLoadingDetail(true);
    const res = await getRecoveryOp(id);
    setLoadingDetail(false);
    if (res.error) {
      setError(res.error);
    } else if (res.row) {
      setDetail(res.row);
    }
  }

  function handleResolve(resolution: "RESTORE_ORIGINAL" | "COMPLETED_DB") {
    if (!selectedId) return;
    if (confirmation !== "RESOLVE") {
      setError('Type "RESOLVE" in the confirmation field to proceed.');
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await resolveRecoveryOp(selectedId, resolution, confirmation);
      if (res.success) {
        setSuccess(res.summary || "Recovery resolved successfully.");
        setConfirmation("");
        // Reload detail
        loadDetail(selectedId);
      } else {
        setError(res.error || "Failed to resolve recovery operation.");
      }
    });
  }

  if (selectedId) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setSelectedId(null);
            setDetail(null);
            setError(null);
            setSuccess(null);
          }}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </button>

        <h1
          className="text-2xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Recovery Operation Detail
        </h1>

        {loadingDetail && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            {success}
          </div>
        )}

        {detail && (
          <div className="space-y-4">
            <div className="bg-background-card border border-border-primary rounded-lg p-6 space-y-3">
              <h2 className="text-lg font-semibold text-text-primary">Operation</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-text-muted">Operation ID</dt>
                  <dd className="text-text-primary font-mono">{detail.id}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Status</dt>
                  <dd className="text-red-400 font-medium">{detail.status}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Organization</dt>
                  <dd className="text-text-primary">{detail.organizationName || detail.organizationId}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Actor</dt>
                  <dd className="text-text-primary">{detail.actorEmail || detail.actorUserId}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Original Seat Limit</dt>
                  <dd className="text-text-primary">{detail.originalSeatLimit}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Original Stripe Qty</dt>
                  <dd className="text-text-primary">{detail.originalStripeQuantity ?? "unknown"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Target Seats</dt>
                  <dd className="text-text-primary">{detail.targetSeats}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Attempts</dt>
                  <dd className="text-text-primary">{detail.attempts}</dd>
                </div>
              </dl>
            </div>

            {detail.lastError && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <p className="text-xs font-medium text-red-400 mb-1">Last Error</p>
                <p className="text-sm text-text-muted font-mono break-all">{detail.lastError}</p>
              </div>
            )}

            {detail.resolutionType && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                <p className="text-xs font-medium text-green-400 mb-1">Already Resolved</p>
                <p className="text-sm text-text-muted">
                  {detail.resolutionType} — {detail.resolutionSummary}
                </p>
              </div>
            )}

            {!detail.resolutionType && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-6 space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Resolve Recovery</h2>
                <p className="text-sm text-text-muted">
                  This operation has Stripe at <strong>{detail.targetSeats}</strong> seats but the
                  database still shows <strong>{detail.originalSeatLimit}</strong> seats. Choose a
                  resolution:
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => handleResolve("RESTORE_ORIGINAL")}
                    disabled={pending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border-primary text-text-primary hover:bg-background-secondary disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore Stripe to original ({detail.originalStripeQuantity})
                  </button>
                  <p className="text-xs text-text-muted pl-1">
                    Restores the Stripe subscription to the original quantity. DB members and
                    seatLimit remain unchanged. Use when DB changes were never committed.
                  </p>

                  <button
                    onClick={() => handleResolve("COMPLETED_DB")}
                    disabled={pending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border-primary text-text-primary hover:bg-background-secondary disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Complete DB reconciliation (seatLimit → {detail.targetSeats})
                  </button>
                  <p className="text-xs text-text-muted pl-1">
                    Applies the DB member/seatLimit changes. Requires Stripe to be at target and
                    membership state to be compatible. Blocks if state has drifted.
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-text-muted mb-1">
                    Type <strong>RESOLVE</strong> to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="RESOLVE"
                    className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-primary text-text-primary text-sm"
                  />
                </div>

                {pending && (
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resolving...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Seat Reconciliation Recovery
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Operations that failed after Stripe succeeded and compensation also failed.
          These require admin intervention to reconcile.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-text-muted">No recovery-required operations.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => loadDetail(row.id)}
              className="w-full text-left bg-background-card border border-border-primary rounded-lg p-4 hover:border-accent-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">
                  {row.organizationName || row.organizationId}
                </span>
                <span className="text-xs text-red-400 font-medium">{row.status}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-text-muted">
                <div>
                  <span className="block">Original</span>
                  <span className="text-text-primary">{row.originalStripeQuantity ?? "?"}</span>
                </div>
                <div>
                  <span className="block">Target</span>
                  <span className="text-text-primary">{row.targetSeats}</span>
                </div>
                <div>
                  <span className="block">Attempts</span>
                  <span className="text-text-primary">{row.attempts}</span>
                </div>
                <div>
                  <span className="block">Created</span>
                  <span className="text-text-primary">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {row.lastError && (
                <p className="text-xs text-red-400/70 mt-2 truncate font-mono">
                  {row.lastError}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
