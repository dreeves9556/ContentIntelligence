"use client";

import { useState, useTransition } from "react";
import {
  Megaphone,
  Sparkles,
  Send,
  Eye,
  Code,
  Loader2,
  Check,
  AlertCircle,
  Mail,
} from "lucide-react";
import { enhanceWithAI, sendBroadcast, type EmailSegment } from "./actions";

const SEGMENTS: { value: EmailSegment; label: string }[] = [
  { value: "all", label: "All Users" },
  { value: "CREATOR", label: "Creator Plan" },
  { value: "PRO", label: "Pro Plan" },
  { value: "CALENDAR_ONLY", label: "Calendar Only Plan" },
  { value: "connected", label: "Connected Social Accounts" },
  { value: "unconnected", label: "No Social Accounts Connected" },
];

export function AnnouncementsClient() {
  const [subject, setSubject] = useState("");
  const [plainText, setPlainText] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [segment, setSegment] = useState<EmailSegment>("all");
  const [view, setView] = useState<"write" | "preview">("write");
  const [enhancing, startEnhance] = useTransition();
  const [sending, startSend] = useTransition();
  const [enhanced, setEnhanced] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleEnhance() {
    if (!plainText.trim()) {
      setError("Write some content first.");
      return;
    }
    setError(null);
    startEnhance(async () => {
      const res = await enhanceWithAI(plainText);
      if (res.success && res.html) {
        setHtmlContent(res.html);
        setEnhanced(true);
        setView("preview");
      } else {
        setError(res.error ?? "Failed to enhance email.");
      }
    });
  }

  function handleSend() {
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!htmlContent.trim()) {
      setError("Email content is required. Write your message and click AI Enhance first.");
      return;
    }
    setError(null);
    setResult(null);
    startSend(async () => {
      const res = await sendBroadcast(subject, htmlContent, segment);
      if (res.success || res.sent > 0) {
        setResult({ sent: res.sent, failed: res.failed, errors: res.errors });
        if (res.success) {
          setSubject("");
          setPlainText("");
          setHtmlContent("");
          setEnhanced(false);
          setView("write");
        }
      } else {
        setError(res.errors[0] ?? "Failed to send broadcast.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Announcements
        </h1>
        <p className="text-text-muted mt-1">
          Compose a broadcast email to your users. Write your message, enhance it with AI, and send.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p>Broadcast sent: {result.sent} delivered, {result.failed} failed.</p>
            {result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-emerald-400/70">View errors</summary>
                <ul className="mt-1 text-xs space-y-1 text-emerald-400/70">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Subject + Segment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Subject Line
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your announcement subject…"
              className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Send To
          </label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as EmailSegment)}
            className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors text-sm appearance-none"
          >
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 border-b border-border-primary">
        <button
          onClick={() => setView("write")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            view === "write"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          <Code className="h-4 w-4" />
          Write
        </button>
        <button
          onClick={() => setView("preview")}
          disabled={!htmlContent}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 ${
            view === "preview"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
      </div>

      {/* Write view */}
      {view === "write" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Your Message
            </label>
            <textarea
              value={plainText}
              onChange={(e) => {
                setPlainText(e.target.value);
                if (enhanced) setEnhanced(false);
              }}
              placeholder="Write your announcement in plain text. When you're happy with the content, click AI Enhance to transform it into a beautifully branded HTML email."
              rows={10}
              className="w-full px-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm leading-relaxed resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleEnhance}
              disabled={enhancing || !plainText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
            >
              {enhancing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enhancing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI Enhance
                </>
              )}
            </button>
            {enhanced && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Enhanced — switch to Preview to see the result
              </span>
            )}
          </div>

          {/* Show raw HTML if already enhanced */}
          {htmlContent && (
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                HTML (editable)
              </label>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary font-mono text-xs focus:outline-none focus:border-accent-primary/50 transition-colors resize-y"
              />
              <p className="text-xs text-text-muted mt-1.5">
                You can edit the HTML directly, or switch to Preview to see how it renders.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preview view */}
      {view === "preview" && (
        <div className="space-y-4">
          {htmlContent ? (
            <div className="bg-white rounded-lg border border-border-primary overflow-hidden">
              <iframe
                srcDoc={htmlContent}
                title="Email Preview"
                className="w-full min-h-[500px] border-0"
                sandbox=""
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-accent-primary/10 rounded-full mb-4">
                <Megaphone className="h-8 w-8 text-accent-primary" />
              </div>
              <p className="text-text-muted text-sm max-w-xs">
                Write your message and click AI Enhance to generate a preview.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Send button */}
      <div className="flex items-center justify-between border-t border-border-primary pt-6">
        <p className="text-xs text-text-muted">
          {htmlContent
            ? "Ready to send. This will email all users in the selected segment."
            : "Write your message and enhance it before sending."}
        </p>
        <button
          onClick={handleSend}
          disabled={sending || !subject.trim() || !htmlContent.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Broadcast
            </>
          )}
        </button>
      </div>
    </div>
  );
}
