"use client";

import { useState, useTransition } from "react";
import { Mail, Loader2, Check, AlertCircle } from "lucide-react";
import { resendWelcomeEmail } from "../actions";

interface ResendWelcomeButtonProps {
  userId: string;
}

export default function ResendWelcomeButton({ userId }: ResendWelcomeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await resendWelcomeEmail(userId);
      if (result.success) {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setError(result.error ?? "Failed to send welcome email");
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        disabled={isPending}
        title="Re-send welcome / password-setup email"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border-primary bg-background-secondary text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : status === "success" ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : (
          <Mail className="w-3 h-3" />
        )}
        {status === "success" ? "Sent" : "Resend"}
      </button>

      {status === "success" && (
        <p className="absolute left-0 top-full mt-1 text-xs text-emerald-400 whitespace-nowrap">
          Welcome email sent
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
