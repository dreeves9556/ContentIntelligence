"use client";

import { useState, useEffect, useTransition } from "react";
import { Mail, Check, AlertCircle, Loader2 } from "lucide-react";
import { unsubscribeUser } from "./actions";

export function UnsubscribeClient({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error" | "already">("loading");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    searchParams.then((params) => {
      const t = params.token;
      if (!t) {
        setStatus("error");
        setMessage("No unsubscribe token provided.");
        return;
      }
      setToken(t);
      startTransition(async () => {
        const res = await unsubscribeUser(t);
        if (res.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(res.error ?? "Something went wrong.");
        }
      });
    });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC] px-4">
      <div
        className="bg-white rounded-2xl border border-[#E2E8F0] max-w-md w-full p-8 sm:p-10 text-center"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* Masthead */}
        <div className="mb-8">
          <p
            className="text-2xl font-bold text-[#101418]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            The Local Post
          </p>
          <div className="mx-auto mt-2 h-[3px] w-10 bg-[#1E56D6] rounded-full" />
          <p className="mt-3 text-[11px] font-semibold text-[#1E56D6] tracking-[0.12em] uppercase">
            Email Preferences
          </p>
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 text-[#1E56D6] animate-spin" />
            <p className="text-sm text-[#5B6472]">Processing your request…</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="p-3 bg-emerald-50 rounded-full">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <h1
              className="text-xl font-bold text-[#101418]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              You&apos;ve Been Unsubscribed
            </h1>
            <p className="text-sm text-[#5B6472] leading-relaxed">
              You will no longer receive announcement emails from The Local Post.
              You can still log in to your account — this only affects broadcast emails.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="p-3 bg-red-50 rounded-full">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <h1
              className="text-xl font-bold text-[#101418]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Something Went Wrong
            </h1>
            <p className="text-sm text-[#5B6472] leading-relaxed">
              {message || "We couldn't process your unsubscribe request. The link may be invalid or expired."}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
          <p className="text-[11px] text-[#5B6472] leading-relaxed">
            The Local Post — Be the local authority.
          </p>
        </div>
      </div>
    </div>
  );
}
