"use client";

import { useState, useTransition, useEffect } from "react";
import { X, Loader2, Tag, Check } from "lucide-react";
import {
  ACCOUNT_STATUS_VALUES,
  ACCOUNT_STATUS_LABELS,
  EXPIRATION_ACTION_VALUES,
  EXPIRATION_ACTION_LABELS,
  COMMON_TAGS,
  TAG_HELPER_TEXT,
  ACCOUNT_PRESETS,
  type AccountStatus,
  type ExpirationAction,
  type UserPlan,
  type UserRole,
} from "@/lib/account-access";
import { updateUserAccount, applyAccountPreset } from "../actions/account-actions";

export interface AccountModalUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  plan: UserPlan;
  accountStatus: AccountStatus;
  internalTag: string | null;
  isComped: boolean;
  compReason: string | null;
  accessExpiresAt: Date | null;
  expirationAction: ExpirationAction;
  organizationId: string | null;
}

interface Props {
  user: AccountModalUser;
  onClose: () => void;
  onSaved: () => void;
}

export default function AccountManagerModal({ user, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [plan, setPlan] = useState<UserPlan>(user.plan);
  const [role, setRole] = useState<UserRole>(user.role);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(user.accountStatus);
  const [internalTag, setInternalTag] = useState<string>(user.internalTag ?? "");
  const [isComped, setIsComped] = useState(user.isComped);
  const [compReason, setCompReason] = useState(user.compReason ?? "");
  const [accessExpiresAt, setAccessExpiresAt] = useState<string>(
    user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString().slice(0, 10) : ""
  );
  const [expirationAction, setExpirationAction] = useState<ExpirationAction>(user.expirationAction);

  const isAdmin = user.role === "ADMIN";

  function handlePreset(presetKey: string) {
    const preset = ACCOUNT_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    setInternalTag(preset.internalTag);
    setAccountStatus(preset.accountStatus);
    setIsComped(preset.isComped);
    setCompReason(preset.compReason);
    setPlan(preset.plan);
    setExpirationAction(preset.expirationAction);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const expiresDate = accessExpiresAt ? new Date(accessExpiresAt + "T23:59:59") : null;
      const result = await updateUserAccount(user.id, {
        plan,
        role,
        accountStatus,
        internalTag: internalTag || null,
        isComped,
        compReason: compReason || null,
        accessExpiresAt: expiresDate,
        expirationAction,
      });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
      } else {
        setError(result.error ?? "Failed to update account.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-background-card border border-border-primary rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border-primary sticky top-0 bg-background-card z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
              Manage Account
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              {user.name || "Unnamed"} · {user.email ?? "—"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isAdmin && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400">
              This is an ADMIN user. Expiration and access fields are disabled — admins always have full access.
            </div>
          )}

          {/* Presets */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePreset(preset.key)}
                  className="px-3 py-1.5 text-xs font-medium bg-background-secondary hover:bg-accent-primary/10 text-text-primary hover:text-accent-primary border border-border-primary rounded-lg transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Role + Plan */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={isAdmin}
                className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50 disabled:opacity-50"
              >
                <option value="USER">User</option>
                <option value="TEAM_ADMIN">Team Admin</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Plan
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as UserPlan)}
                className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
              >
                <option value="CALENDAR_ONLY">Calendar Only</option>
                <option value="CREATOR">Creator</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
          </div>

          {/* Tag */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Internal Tag
            </label>
            <div className="flex gap-2 flex-wrap mb-2">
              {COMMON_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setInternalTag(tag)}
                  className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                    internalTag === tag
                      ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                      : "bg-background-secondary text-text-muted border-border-primary hover:text-text-primary"
                  }`}
                >
                  {tag}
                </button>
              ))}
              <button
                onClick={() => setInternalTag("")}
                className="px-2.5 py-1 text-xs font-medium rounded border bg-background-secondary text-text-muted border-border-primary hover:text-text-primary"
              >
                Clear
              </button>
            </div>
            <input
              type="text"
              value={internalTag}
              onChange={(e) => setInternalTag(e.target.value.toUpperCase())}
              placeholder="Custom tag..."
              className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
            />
            {internalTag && TAG_HELPER_TEXT[internalTag] && (
              <p className="text-xs text-text-muted mt-1.5">{TAG_HELPER_TEXT[internalTag]}</p>
            )}
          </div>

          {/* Account Status */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Account Status
            </label>
            <select
              value={accountStatus}
              onChange={(e) => setAccountStatus(e.target.value as AccountStatus)}
              disabled={isAdmin}
              className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50 disabled:opacity-50"
            >
              {ACCOUNT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {ACCOUNT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Comped */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isComped}
                onChange={(e) => setIsComped(e.target.checked)}
                className="h-4 w-4 rounded border-border-primary accent-accent-primary"
              />
              <span className="text-sm text-text-primary">Comped (free access)</span>
            </label>
            {isComped && (
              <input
                type="text"
                value={compReason}
                onChange={(e) => setCompReason(e.target.value)}
                placeholder="Comp reason (e.g. Brokerage-covered, Beta tester...)"
                className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
              />
            )}
          </div>

          {/* Expiration */}
          <div className={`space-y-4 ${isAdmin ? "opacity-50 pointer-events-none" : ""}`}>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Access Expires At
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={accessExpiresAt}
                  onChange={(e) => setAccessExpiresAt(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
                />
                {accessExpiresAt && (
                  <button
                    onClick={() => setAccessExpiresAt("")}
                    className="px-3 py-2 text-xs text-text-muted hover:text-text-primary bg-background-secondary border border-border-primary rounded-lg"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setAccessExpiresAt("2026-10-01")}
                  className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary bg-background-secondary border border-border-primary rounded"
                >
                  Oct 1, 2026
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    setAccessExpiresAt(d.toISOString().slice(0, 10));
                  }}
                  className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary bg-background-secondary border border-border-primary rounded"
                >
                  +1 month
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 3);
                    setAccessExpiresAt(d.toISOString().slice(0, 10));
                  }}
                  className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary bg-background-secondary border border-border-primary rounded"
                >
                  +3 months
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Expiration Action
              </label>
              <select
                value={expirationAction}
                onChange={(e) => setExpirationAction(e.target.value as ExpirationAction)}
                className="w-full px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50"
              >
                {EXPIRATION_ACTION_VALUES.map((a) => (
                  <option key={a} value={a}>
                    {EXPIRATION_ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1.5">
                {expirationAction === "NONE" && "No action will be taken when access expires."}
                {expirationAction === "DOWNGRADE_TO_CALENDAR_ONLY" && "User will be downgraded to Calendar Only plan on expiration."}
                {expirationAction === "DISABLE_ACCESS" && "User will be blocked from the dashboard entirely on expiration."}
              </p>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <Check className="h-4 w-4" /> Account updated successfully.
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border-primary">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
