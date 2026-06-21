"use client";

import { useState, useTransition } from "react";
import { UserPlus, X, Link2, Copy, Check, Loader2, Mail } from "lucide-react";
import { createInviteLink } from "../actions";

export function InviteClientButton() {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setShowModal(false);
    setEmail("");
    setGeneratedUrl(null);
    setError(null);
    setCopied(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createInviteLink(email);
      if ("error" in result) {
        setError(result.error);
      } else {
        setGeneratedUrl(result.url);
      }
    });
  }

  function handleCopy() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
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

            {!generatedUrl ? (
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
                    Generate a secure registration link to send to your client.
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
                        Generating…
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" />
                        Generate Invite Link
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
                    Link Generated
                  </h3>
                  <p className="text-sm text-[#787878]">
                    An invitation email has been sent to <span className="text-[#c8952a]">{email}</span>. You can also copy the link below to share manually. Expires in 7 days.
                  </p>
                </div>

                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 mb-4">
                  <p className="text-xs text-[#787878] break-all font-mono">{generatedUrl}</p>
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
