"use client";

import { useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Bug, X, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { submitBugReport } from "./actions";

const inputClass =
  "w-full px-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all text-sm";

export default function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const { data: session } = useSession();

  const [name, setName] = useState(session?.user?.name ?? "");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [deviceInfo, setDeviceInfo] = useState<"mobile" | "browser">("browser");
  const [description, setDescription] = useState("");

  // useSession() resolves asynchronously (often after mount, especially on
  // mobile), so seed the identity fields once it arrives — but never overwrite
  // whatever the user has already typed.
  useEffect(() => {
    if (session?.user?.name) setName((prev) => prev || session.user!.name!);
    if (session?.user?.email) setEmail((prev) => prev || session.user!.email!);
  }, [session?.user?.name, session?.user?.email]);

  const handleSubmit = () => {
    if (!description.trim()) {
      setStatus("error");
      setErrorMsg("Please describe the bug.");
      return;
    }
    startTransition(async () => {
      const result = await submitBugReport({ name, email, deviceInfo, description });
      if (result.success) {
        setStatus("success");
        setDescription("");
        setTimeout(() => {
          setStatus(null);
          setOpen(false);
        }, 2000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-muted hover:text-text-primary hover:bg-background-card transition-colors w-full"
      >
        <Bug className="h-5 w-5" />
        Report a Bug
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="w-full max-w-md my-auto max-h-[90dvh] overflow-y-auto rounded-2xl border border-border-primary bg-background-card p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10">
                  <Bug className="h-5 w-5 text-red-400" />
                </div>
                <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                  Report a Bug
                </h2>
              </div>
              <button
                onClick={() => !isPending && setOpen(false)}
                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {status === "success" && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Bug report submitted. Thank you!
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Are you on mobile or browser?</label>
                <div className="flex gap-2">
                  {(["browser", "mobile"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDeviceInfo(opt)}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium capitalize transition-all border ${
                        deviceInfo === opt
                          ? "bg-accent-primary/15 border-accent-primary/50 text-accent-primary"
                          : "bg-background-secondary border-border-primary text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Describe the bug</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened? What were you trying to do? Any error messages?"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm text-text-muted border border-border-primary hover:bg-background-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-accent-primary text-white disabled:opacity-60 hover:bg-accent-primary/90 transition-colors flex-1"
              >
                <Send className="h-3.5 w-3.5" />
                {isPending ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
