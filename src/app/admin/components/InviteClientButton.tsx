"use client";

import { useState, useTransition } from "react";
import { UserPlus, X, Link2, Copy, Check, Loader2, Mail } from "lucide-react";
import { createClientProfile } from "../actions";

export function InviteClientButton() {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

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
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#c8952a] hover:bg-[#c8952a]/90 text-[#0a0a0a] font-medium rounded-lg transition-colors"
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
          <div className="relative bg-[#111111] rounded-xl border border-[#1a1a1a] p-6 max-w-md w-full shadow-2xl">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-[#787878] hover:text-[#e8e8e8] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {!generatedPassword ? (
              <>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-[#c8952a]/10 rounded-full flex items-center justify-center mb-4">
                    <UserPlus className="h-6 w-6 text-[#c8952a]" />
                  </div>
                  <h3
                    className="text-xl font-semibold text-[#e8e8e8] mb-1"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    Invite New Client
                  </h3>
                  <p className="text-sm text-[#787878]">
                    Create a client account with a randomly generated password. Share the credentials with your client so they can log in.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="invite-email"
                      className="block text-xs font-medium text-[#787878] uppercase tracking-wider mb-2"
                    >
                      Client Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787878]" />
                      <input
                        id="invite-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="client@example.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] placeholder-[#3a3a3a] focus:outline-none focus:border-[#c8952a]/50 transition-colors text-sm"
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#c8952a] hover:bg-[#c8952a]/90 disabled:opacity-60 disabled:cursor-not-allowed text-[#0a0a0a] font-medium rounded-lg transition-colors"
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
                    className="text-xl font-semibold text-[#e8e8e8] mb-1"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    Account Created
                  </h3>
                  <p className="text-sm text-[#787878]">
                    Share these credentials with <span className="text-[#c8952a]">{email}</span> so they can log in. They will be prompted to complete onboarding after their first login.
                  </p>
                </div>

                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 mb-4 space-y-2">
                  <div>
                    <p className="text-xs text-[#787878] uppercase tracking-wider mb-1">Email</p>
                    <p className="text-sm text-[#e8e8e8] font-mono break-all">{email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#787878] uppercase tracking-wider mb-1">Password</p>
                    <p className="text-sm text-[#e8e8e8] font-mono break-all">{generatedPassword}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#c8952a] hover:bg-[#c8952a]/90 text-[#0a0a0a] font-medium rounded-lg transition-colors"
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
                    className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#787878] hover:text-[#e8e8e8] font-medium rounded-lg transition-colors"
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
