"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Check, AlertCircle } from "lucide-react";
import { adminResetPassword } from "../actions";

interface ResetPasswordButtonProps {
  userId: string;
  userEmail: string | null;
}

export default function ResetPasswordButton({ userId, userEmail }: ResetPasswordButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!userEmail) return;
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await adminResetPassword(userId);
      if (result.success) {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setError(result.error ?? "Failed to send reset email");
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        disabled={isPending || !userEmail}
        title={userEmail ? "Send password reset email" : "User has no email"}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border-primary bg-background-secondary text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : status === "success" ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : (
          <KeyRound className="w-3 h-3" />
        )}
        {status === "success" ? "Sent" : "Reset"}
      </button>

      {status === "success" && (
        <p className="absolute left-0 top-full mt-1 text-xs text-emerald-400 whitespace-nowrap">
          Reset email sent
        </p>
      )}
      {status === "error" && (
        <p className="absolute left-0 top-full mt-1 text-xs text-red-400 whitespace-nowrap flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
