"use client";

import { useState, useTransition } from "react";
import { X, Loader2, AlertTriangle, Check } from "lucide-react";
import {
  ACCOUNT_STATUS_VALUES,
  ACCOUNT_STATUS_LABELS,
  EXPIRATION_ACTION_VALUES,
  EXPIRATION_ACTION_LABELS,
  COMMON_TAGS,
  type AccountStatus,
  type ExpirationAction,
  type UserPlan,
} from "@/lib/account-access";
import { bulkUpdateAccounts, type BulkUpdateInput } from "../actions/account-actions";

interface Props {
  selectedIds: string[];
  selectedNames: string[];
  onClear: () => void;
  onComplete: () => void;
}

type BulkField = "internalTag" | "accountStatus" | "isComped" | "compReason" | "accessExpiresAt" | "expirationAction" | "plan";

export default function BulkActionBar({ selectedIds, selectedNames, onClear, onComplete }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [field, setField] = useState<BulkField>("internalTag");
  const [tagValue, setTagValue] = useState<string>("");
  const [statusValue, setStatusValue] = useState<AccountStatus>("ACTIVE");
  const [compedValue, setCompedValue] = useState(true);
  const [compReasonValue, setCompReasonValue] = useState("");
  const [expiresValue, setExpiresValue] = useState("");
  const [actionValue, setActionValue] = useState<ExpirationAction>("NONE");
  const [planValue, setPlanValue] = useState<UserPlan>("CALENDAR_ONLY");

  function buildInput(): BulkUpdateInput {
    switch (field) {
      case "internalTag":
        return { internalTag: tagValue || null };
      case "accountStatus":
        return { accountStatus: statusValue };
      case "isComped":
        return { isComped: compedValue };
      case "compReason":
        return { compReason: compReasonValue || null };
      case "accessExpiresAt":
        return { accessExpiresAt: expiresValue ? new Date(expiresValue + "T23:59:59") : null };
      case "expirationAction":
        return { expirationAction: actionValue };
      case "plan":
        return { plan: planValue };
    }
  }

  function getFieldLabel(): string {
    const labels: Record<BulkField, string> = {
      internalTag: "Internal Tag",
      accountStatus: "Account Status",
      isComped: "Comped Status",
      compReason: "Comp Reason",
      accessExpiresAt: "Access Expires At",
      expirationAction: "Expiration Action",
      plan: "Plan",
    };
    return labels[field];
  }

  function getValueLabel(): string {
    switch (field) {
      case "internalTag":
        return tagValue || "Clear tag";
      case "accountStatus":
        return ACCOUNT_STATUS_LABELS[statusValue];
      case "isComped":
        return compedValue ? "Comped" : "Not comped";
      case "compReason":
        return compReasonValue || "Clear reason";
      case "accessExpiresAt":
        return expiresValue || "Clear date";
      case "expirationAction":
        return EXPIRATION_ACTION_LABELS[actionValue];
      case "plan":
        return planValue;
    }
  }

  function handleApply() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const input = buildInput();
      const res = await bulkUpdateAccounts(selectedIds, input);
      if (res.success) {
        setResult(`Updated ${res.processed} user${res.processed !== 1 ? "s" : ""}, skipped ${res.skipped} (ADMIN).`);
        setShowConfirm(false);
        onComplete();
        setTimeout(() => {
          setResult(null);
          onClear();
        }, 3000);
      } else {
        setError(res.errors[0] ?? "Bulk update failed.");
        setShowConfirm(false);
      }
    });
  }

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="sticky bottom-4 z-30 mx-auto max-w-2xl bg-background-card border border-border-primary rounded-xl shadow-lg p-4 space-y-3">
        {result && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <Check className="h-4 w-4" /> {result}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            {selectedIds.length} user{selectedIds.length !== 1 ? "s" : ""} selected
          </span>
          <button onClick={onClear} className="text-xs text-text-muted hover:text-text-primary">
            Clear selection
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={field}
            onChange={(e) => setField(e.target.value as BulkField)}
            className="px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
          >
            <option value="internalTag">Set Tag</option>
            <option value="accountStatus">Set Status</option>
            <option value="isComped">Set Comped</option>
            <option value="compReason">Set Comp Reason</option>
            <option value="accessExpiresAt">Set Expiration Date</option>
            <option value="expirationAction">Set Expiration Action</option>
            <option value="plan">Set Plan</option>
          </select>

          {field === "internalTag" && (
            <select
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            >
              <option value="">Clear tag</option>
              {COMMON_TAGS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          {field === "accountStatus" && (
            <select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value as AccountStatus)}
              className="px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            >
              {ACCOUNT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>{ACCOUNT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          )}
          {field === "isComped" && (
            <select
              value={compedValue ? "true" : "false"}
              onChange={(e) => setCompedValue(e.target.value === "true")}
              className="px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            >
              <option value="true">Comped</option>
              <option value="false">Not comped</option>
            </select>
          )}
          {field === "compReason" && (
            <input
              type="text"
              value={compReasonValue}
              onChange={(e) => setCompReasonValue(e.target.value)}
              placeholder="Comp reason..."
              className="flex-1 min-w-[150px] px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            />
          )}
          {field === "accessExpiresAt" && (
            <input
              type="date"
              value={expiresValue}
              onChange={(e) => setExpiresValue(e.target.value)}
              className="px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            />
          )}
          {field === "expirationAction" && (
            <select
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value as ExpirationAction)}
              className="px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            >
              {EXPIRATION_ACTION_VALUES.map((a) => (
                <option key={a} value={a}>{EXPIRATION_ACTION_LABELS[a]}</option>
              ))}
            </select>
          )}
          {field === "plan" && (
            <select
              value={planValue}
              onChange={(e) => setPlanValue(e.target.value as UserPlan)}
              className="px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            >
              <option value="CALENDAR_ONLY">Calendar Only</option>
              <option value="PRO">Pro</option>
            </select>
          )}

          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Apply to {selectedIds.length}
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="max-w-md w-full bg-background-card border border-border-primary rounded-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
              <h3 className="text-lg font-bold text-text-primary">Confirm Bulk Update</h3>
            </div>
            <div className="space-y-2 text-sm text-text-muted">
              <p>You are about to update <strong className="text-text-primary">{selectedIds.length}</strong> user{selectedIds.length !== 1 ? "s" : ""}.</p>
              <p>Field: <strong className="text-text-primary">{getFieldLabel()}</strong></p>
              <p>New value: <strong className="text-text-primary">{getValueLabel()}</strong></p>
              <div className="bg-background-secondary rounded-lg p-3 max-h-32 overflow-y-auto">
                {selectedNames.map((name, i) => (
                  <p key={i} className="text-xs text-text-muted py-0.5">{name}</p>
                ))}
              </div>
              <p className="text-xs text-amber-400">ADMIN users will be skipped automatically.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary">
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={isPending}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white text-sm font-medium rounded-lg disabled:opacity-60 flex items-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
