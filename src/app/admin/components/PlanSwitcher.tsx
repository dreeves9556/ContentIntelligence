"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { updateUserPlan } from "../actions";
import { PLAN_LABELS } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";

const PLANS: UserPlan[] = ["CALENDAR_ONLY", "CREATOR", "PRO"];

const PLAN_STYLES: Record<UserPlan, string> = {
  CALENDAR_ONLY: "text-[#787878] bg-[#1a1a1a] border-[#2a2a2a]",
  CREATOR: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  PRO: "text-[#c8952a] bg-[#c8952a]/10 border-[#c8952a]/30",
};

interface PlanSwitcherProps {
  userId: string;
  currentPlan: UserPlan;
}

export default function PlanSwitcher({ userId, currentPlan }: PlanSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<UserPlan>(currentPlan);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    }
  }, [open]);

  const handleSelect = (next: UserPlan) => {
    if (next === plan) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateUserPlan(userId, next);
      if (result.success) {
        setPlan(next);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error ?? "Failed to update");
      }
    });
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${PLAN_STYLES[plan]} hover:opacity-80 disabled:opacity-50`}
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : saved ? (
          <Check className="w-3 h-3" />
        ) : (
          <ChevronsUpDown className="w-3 h-3" />
        )}
        {PLAN_LABELS[plan]}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] w-44 bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {PLANS.map((p) => (
              <button
                key={p}
                onClick={() => handleSelect(p)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors hover:bg-[#1a1a1a] ${
                  p === plan ? "text-[#e8e8e8]" : "text-[#787878]"
                }`}
              >
                <span className={`px-2 py-0.5 rounded-md border ${PLAN_STYLES[p]}`}>
                  {PLAN_LABELS[p]}
                </span>
                {p === plan && <Check className="w-3 h-3 text-[#c8952a]" />}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="absolute left-0 top-full mt-1 text-xs text-red-400 whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  );
}
