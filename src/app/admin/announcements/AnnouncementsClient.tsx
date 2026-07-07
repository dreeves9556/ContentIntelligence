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
  Wand2,
  Clock,
  Calendar,
  XCircle,
} from "lucide-react";
import {
  enhanceWithAI,
  suggestSubject,
  sendBroadcast,
  scheduleBroadcast,
  cancelScheduledBroadcast,
  type EmailSegment,
  type ScheduledBroadcastData,
} from "./actions";

const SEGMENTS: { value: EmailSegment; label: string }[] = [
  { value: "all", label: "All Users" },
  { value: "CREATOR", label: "Creator Plan" },
  { value: "PRO", label: "Pro Plan" },
  { value: "CALENDAR_ONLY", label: "Calendar Only Plan" },
  { value: "connected", label: "Connected Social Accounts" },
  { value: "unconnected", label: "No Social Accounts Connected" },
];

const SEGMENT_LABELS: Record<string, string> = Object.fromEntries(
  SEGMENTS.map((s) => [s.value, s.label])
);

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    SENT: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    CANCELLED: "bg-background-secondary text-text-muted border-border-primary",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return styles[status] ?? styles.PENDING;
}

export function AnnouncementsClient({ initialBroadcasts }: { initialBroadcasts: ScheduledBroadcastData[] }) {
  const [subject, setSubject] = useState("");
  const [plainText, setPlainText] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [segment, setSegment] = useState<EmailSegment>("all");
  const [view, setView] = useState<"write" | "preview">("write");
  const [enhancing, startEnhance] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [sending, startSend] = useTransition();
  const [scheduling, startSchedule] = useTransition();
  const [cancelling, startCancel] = useTransition();
  const [enhanced, setEnhanced] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);

  function handleSuggestSubject() {
    if (!plainText.trim()) {
      setError("Write some content first.");
      return;
    }
    setError(null);
    startSuggest(async () => {
      const res = await suggestSubject(plainText);
      if (res.success && res.subject) {
        setSubject(res.subject);
      } else {
        setError(res.error ?? "Failed to generate subject line.");
      }
    });
  }

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

  function handleSchedule() {
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!htmlContent.trim()) {
      setError("Email content is required. Write your message and click AI Enhance first.");
      return;
    }
    if (!scheduledFor) {
      setError("Pick a date and time to schedule.");
      return;
    }
    setError(null);
    startSchedule(async () => {
      const res = await scheduleBroadcast(subject, htmlContent, segment, scheduledFor);
      if (res.success) {
        setSubject("");
        setPlainText("");
        setHtmlContent("");
        setEnhanced(false);
        setScheduledFor("");
        setView("write");
        window.location.reload();
      } else {
        setError(res.error ?? "Failed to schedule broadcast.");
      }
    });
  }

  function handleCancel(id: string) {
    if (!confirm("Cancel this scheduled broadcast?")) return;
    startCancel(async () => {
      const res = await cancelScheduledBroadcast(id);
      if (res.success) {
        setBroadcasts((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: "CANCELLED" } : b))
        );
      } else {
        setError(res.error ?? "Failed to cancel broadcast.");
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
              className="w-full pl-10 pr-28 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm"
            />
            <button
              onClick={handleSuggestSubject}
              disabled={suggesting || !plainText.trim()}
              title="Generate a subject line from your message"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent-primary hover:bg-accent-primary/10 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {suggesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              AI
            </button>
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

      {/* Schedule + Send */}
      <div className="border-t border-border-primary pt-6 space-y-4">
        {/* Schedule row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="h-4 w-4 text-text-muted shrink-0" />
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="flex-1 px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={handleSchedule}
            disabled={scheduling || !subject.trim() || !htmlContent.trim() || !scheduledFor}
            className="flex items-center gap-2 px-5 py-2.5 bg-background-secondary hover:bg-background-secondary/80 disabled:opacity-60 disabled:cursor-not-allowed text-text-primary font-medium rounded-lg transition-colors text-sm border border-border-primary"
          >
            {scheduling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            Schedule
          </button>
        </div>

        {/* Send now row */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {htmlContent
              ? "Ready to send. This will email all users in the selected segment immediately."
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
                Send Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scheduled broadcasts list */}
      {broadcasts.length > 0 && (
        <div className="pt-6 border-t border-border-primary">
          <h2 className="text-xs font-bold tracking-wider text-text-muted uppercase mb-4">
            Broadcast History
          </h2>
          <div className="space-y-3">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="bg-background-card rounded-lg border border-border-primary p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{b.subject}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(b.scheduledFor)}
                    </span>
                    <span>{SEGMENT_LABELS[b.segment] ?? b.segment}</span>
                    {b.status === "SENT" && (
                      <span className="text-emerald-400">{b.sentCount} sent</span>
                    )}
                    {b.status === "FAILED" && b.failedCount > 0 && (
                      <span className="text-red-400">{b.failedCount} failed</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${statusBadge(b.status)}`}
                  >
                    {b.status}
                  </span>
                  {b.status === "PENDING" && (
                    <button
                      onClick={() => handleCancel(b.id)}
                      disabled={cancelling}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
