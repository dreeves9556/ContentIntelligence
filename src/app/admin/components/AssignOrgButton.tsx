"use client";

import { useState, useTransition } from "react";
import { Building2, Loader2, Check, AlertCircle, X } from "lucide-react";
import {
  getAssignableOrganizations,
  assignUserToOrganization,
  type AssignableOrg,
} from "../organizations/actions";

interface AssignOrgButtonProps {
  userId: string;
  userName: string | null;
  onAssigned: () => void;
}

export default function AssignOrgButton({ userId, userName, onAssigned }: AssignOrgButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [orgs, setOrgs] = useState<AssignableOrg[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function openModal() {
    setOpen(true);
    setActionError(null);
    setSuccess(false);
    setSelectedOrgId(null);
    setLoadError(null);
    setOrgs([]);
    setLoading(true);
    startTransition(async () => {
      const res = await getAssignableOrganizations();
      setLoading(false);
      if (res.data) {
        setOrgs(res.data);
      } else {
        setLoadError(res.error ?? "Failed to load organizations.");
      }
    });
  }

  function handleAssign() {
    if (!selectedOrgId) return;
    setActionError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await assignUserToOrganization(userId, selectedOrgId);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          onAssigned();
        }, 700);
      } else {
        setActionError(res.error ?? "Failed to assign user to organization.");
      }
    });
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border-primary bg-background-secondary text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors"
      >
        <Building2 className="w-3 h-3" />
        Assign to org
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="max-w-md w-full max-h-[80vh] overflow-y-auto bg-background-card border border-border-primary rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border-primary sticky top-0 bg-background-card z-10">
              <div>
                <h2 className="text-base font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                  Assign to organization
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {userName || "Unnamed"} becomes a member. Promote to co-admin afterwards.
                </p>
              </div>
              <button
                onClick={() => !isPending && setOpen(false)}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {loading && (
                <div className="flex items-center justify-center py-8 text-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}

              {loadError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {loadError}
                </p>
              )}

              {!loading && !loadError && orgs.length === 0 && (
                <p className="text-xs text-text-muted py-6 text-center">
                  No organizations have a free seat. Raise a seat limit or remove a member first.
                </p>
              )}

              {!loading && !loadError && orgs.length > 0 && (
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {orgs.map((org) => {
                    const selected = selectedOrgId === org.id;
                    return (
                      <li key={org.id}>
                        <button
                          onClick={() => setSelectedOrgId(org.id)}
                          disabled={isPending}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                            selected
                              ? "border-accent-primary/50 bg-accent-primary/10"
                              : "border-border-primary bg-background-secondary hover:border-accent-primary/30"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{org.name}</p>
                            <p className="text-xs text-text-muted">
                              {org.freeSeats} free of {org.seatLimit} seats
                            </p>
                          </div>
                          {selected && <Check className="w-4 h-4 text-accent-primary shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {actionError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {actionError}
                </p>
              )}
              {success && (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Assigned. Refreshing…
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border-primary">
                <button
                  onClick={() => !isPending && setOpen(false)}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary border border-border-primary rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={isPending || !selectedOrgId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
