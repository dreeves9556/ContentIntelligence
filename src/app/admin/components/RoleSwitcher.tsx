"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2, Shield, Users } from "lucide-react";
import { updateUserRole } from "../actions";

const ROLES = ["USER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  USER: "Client",
  ADMIN: "Admin",
};

const ROLE_STYLES: Record<Role, string> = {
  USER: "text-[#787878] bg-[#1a1a1a] border-[#2a2a2a]",
  ADMIN: "text-[#c8952a] bg-[#c8952a]/10 border-[#c8952a]/20",
};

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  USER: <Users className="w-3 h-3" />,
  ADMIN: <Shield className="w-3 h-3" />,
};

interface RoleSwitcherProps {
  userId: string;
  currentRole: Role;
}

export default function RoleSwitcher({ userId, currentRole }: RoleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(currentRole);
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

  const handleSelect = (next: Role) => {
    if (next === role) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateUserRole(userId, next);
      if (result.success) {
        setRole(next);
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
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${ROLE_STYLES[role]} hover:opacity-80 disabled:opacity-50`}
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : saved ? (
          <Check className="w-3 h-3" />
        ) : (
          ROLE_ICONS[role]
        )}
        {ROLE_LABELS[role]}
        <ChevronsUpDown className="w-3 h-3 opacity-50" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] w-36 bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => handleSelect(r)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors hover:bg-[#1a1a1a] ${
                  r === role ? "text-[#e8e8e8]" : "text-[#787878]"
                }`}
              >
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${ROLE_STYLES[r]}`}>
                  {ROLE_ICONS[r]}
                  {ROLE_LABELS[r]}
                </span>
                {r === role && <Check className="w-3 h-3 text-[#c8952a]" />}
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
