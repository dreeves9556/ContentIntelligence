"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Link2, Copy, Check, Loader2, Mail, MailCheck } from "lucide-react";
import { createClientProfile } from "../actions";

export function InviteClientButton() {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();

  function handleClose() {
    setShowModal(false);
    setEmail("");
    setGeneratedPassword(null);
    setError(null);
    setCopied(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createClientProfile(email);
      if ("password" in result) {
        setGeneratedPassword(result.password);
        setEmailSent(!result.error);
        router.refresh();
        if (result.error) {
          setError(result.error);
        }
      } else if ("error" in result) {
        setError(result.error);
      }
    });
  }

  function handleCopy() {
    if (!generatedPassword) return;
    const credentials = `Email: ${email}\nPassword: ${generatedPassword}`;
    navigator.clipboard.writeText(credentials).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium rounded-lg transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Invite New Client
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="relative bg-background-card rounded-xl border border-border-primary p-6 max-w-md w-full shadow-2xl">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {!generatedPassword ? (
              <>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-accent-primary/10 rounded-full flex items-center justify-center mb-4">
                    <UserPlus className="h-6 w-6 text-accent-primary" />
                  </div>
                  <h3
                    className="text-xl font-semibold text-text-primary mb-1"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Invite New Client
                  </h3>
                  <p className="text-sm text-text-muted">
                    Create a client account with a randomly generated password. Share the credentials with your client so they can log in.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="invite-email"
                      className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
                    >
                      Client Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <input
                        id="invite-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="client@example.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Account…
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" />
                        Create Client Account
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3
                    className="text-xl font-semibold text-text-primary mb-1"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Account Created
                  </h3>
                  <p className="text-sm text-text-muted">
                    {emailSent ? (
                      <>A welcome email with a password setup link has been sent to <span className="text-accent-primary">{email}</span>. The temporary password below is a backup — share it only if they cannot access the email.</>
                    ) : (
                      <>Share these credentials with <span className="text-accent-primary">{email}</span> so they can log in. They will be prompted to complete onboarding after their first login.</>
                    )}
                  </p>
                </div>

                {emailSent && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">
                    <MailCheck className="h-4 w-4 shrink-0" />
                    Welcome email delivered successfully.
                  </div>
                )}

                <div className="bg-background-secondary border border-border-primary rounded-lg p-4 mb-4 space-y-2">
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Email</p>
                    <p className="text-sm text-text-primary font-mono break-all">{email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Password</p>
                    <p className="text-sm text-text-primary font-mono break-all">{generatedPassword}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium rounded-lg transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy to Clipboard
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2.5 bg-background-secondary hover:bg-background-secondary text-text-muted hover:text-text-primary font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
