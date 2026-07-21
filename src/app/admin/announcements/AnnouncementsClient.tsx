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
  Plus,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Inbox,
  MousePointerClick,
  Eye as EyeIcon,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  enhanceWithAI,
  suggestSubject,
  sendBroadcast,
  scheduleBroadcast,
  cancelScheduledBroadcast,
  refreshBroadcastAnalytics,
  getBroadcastDetail,
  type EmailSegment,
  type ScheduledBroadcastData,
  type BroadcastEmailData,
} from "./actions";

const SEGMENTS: { value: EmailSegment; label: string }[] = [
  { value: "all", label: "All Users" },
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

function emailStatusColor(status: string) {
  const colors: Record<string, string> = {
    delivered: "text-emerald-400",
    opened: "text-blue-400",
    clicked: "text-purple-400",
    bounced: "text-red-400",
    complained: "text-orange-400",
    failed: "text-red-400",
    sent: "text-text-muted",
    delivery_delayed: "text-amber-400",
  };
  return colors[status] ?? "text-text-muted";
}

export function AnnouncementsClient({ initialBroadcasts }: { initialBroadcasts: ScheduledBroadcastData[] }) {
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [showCompose, setShowCompose] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [emailDetails, setEmailDetails] = useState<BroadcastEmailData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();
  const [loadingDetail, startDetail] = useTransition();

  function handleRefresh(broadcastId: string) {
    setRefreshingId(broadcastId);
    (async () => {
      const res = await refreshBroadcastAnalytics(broadcastId);
      if (res.success && res.analytics) {
        setBroadcasts((prev) =>
          prev.map((b) =>
            b.id === broadcastId ? { ...b, analytics: res.analytics! } : b
          )
        );
      } else {
        setError(res.error ?? "Failed to refresh analytics.");
      }
      setRefreshingId(null);
    })();
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

  function handleExpand(broadcastId: string) {
    if (expandedId === broadcastId) {
      setExpandedId(null);
      setEmailDetails(null);
      return;
    }
    setExpandedId(broadcastId);
    setEmailDetails(null);
    startDetail(async () => {
      const res = await getBroadcastDetail(broadcastId);
      if (res.success && res.emails) {
        setEmailDetails(res.emails);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Announcements
          </h1>
          <p className="text-text-muted mt-1">
            Broadcast emails to your users. Track delivery, opens, and clicks.
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          Compose
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat
          icon={<Mail className="h-4 w-4" />}
          label="Total Sent"
          value={broadcasts.filter((b) => b.status === "SENT").length}
        />
        <SummaryStat
          icon={<Clock className="h-4 w-4" />}
          label="Scheduled"
          value={broadcasts.filter((b) => b.status === "PENDING").length}
        />
        <SummaryStat
          icon={<Inbox className="h-4 w-4" />}
          label="Delivered"
          value={broadcasts.reduce((sum, b) => sum + b.analytics.delivered, 0)}
        />
        <SummaryStat
          icon={<EyeIcon className="h-4 w-4" />}
          label="Opened"
          value={broadcasts.reduce((sum, b) => sum + b.analytics.opened, 0)}
        />
      </div>

      {/* Broadcast list */}
      {broadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border-primary rounded-xl bg-background-secondary/50">
          <div className="p-4 bg-accent-primary/10 rounded-full mb-4">
            <Megaphone className="h-8 w-8 text-accent-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">No announcements yet</h3>
          <p className="text-text-muted text-sm max-w-xs mb-4">
            Click Compose to write your first broadcast email.
          </p>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            Compose
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => (
            <BroadcastRow
              key={b.id}
              broadcast={b}
              expanded={expandedId === b.id}
              onExpand={() => handleExpand(b.id)}
              onRefresh={() => handleRefresh(b.id)}
              onCancel={() => handleCancel(b.id)}
              refreshing={refreshingId === b.id}
              loadingDetail={loadingDetail}
              emailDetails={emailDetails}
            />
          ))}
        </div>
      )}

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-background-secondary border border-border-primary rounded-lg p-4">
      <div className="flex items-center gap-2 text-text-muted mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function BroadcastRow({
  broadcast,
  expanded,
  onExpand,
  onRefresh,
  onCancel,
  refreshing,
  loadingDetail,
  emailDetails,
}: {
  broadcast: ScheduledBroadcastData;
  expanded: boolean;
  onExpand: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  refreshing: boolean;
  loadingDetail: boolean;
  emailDetails: BroadcastEmailData[] | null;
}) {
  const a = broadcast.analytics;
  const openRate = a.total > 0 ? Math.round((a.opened / a.total) * 100) : 0;
  const clickRate = a.total > 0 ? Math.round((a.clicked / a.total) * 100) : 0;
  const deliveredRate = a.total > 0 ? Math.round((a.delivered / a.total) * 100) : 0;

  return (
    <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
      {/* Row header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer hover:bg-background-secondary/30 transition-colors"
        onClick={onExpand}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
            )}
            <p className="text-sm font-medium text-text-primary truncate">{broadcast.subject}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 ml-6 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateTime(broadcast.scheduledFor)}
            </span>
            <span>{SEGMENT_LABELS[broadcast.segment] ?? broadcast.segment}</span>
            {a.total > 0 && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {a.total} recipients
              </span>
            )}
          </div>
        </div>

        {/* Quick analytics */}
        {broadcast.status === "SENT" && a.total > 0 && (
          <div className="hidden sm:flex items-center gap-4 text-xs shrink-0">
            <MiniStat label="Delivered" value={`${deliveredRate}%`} color="text-emerald-400" />
            <MiniStat label="Opened" value={`${openRate}%`} color="text-blue-400" />
            <MiniStat label="Clicked" value={`${clickRate}%`} color="text-purple-400" />
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${statusBadge(broadcast.status)}`}
          >
            {broadcast.status}
          </span>
          {broadcast.status === "SENT" && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh analytics from Resend"
              className="p-1.5 text-text-muted hover:text-accent-primary rounded-md hover:bg-accent-primary/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          )}
          {broadcast.status === "PENDING" && (
            <button
              onClick={onCancel}
              disabled={loadingDetail}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border-primary p-4 space-y-4 bg-background-secondary/20">
          {/* Analytics breakdown */}
          {broadcast.status === "SENT" && a.total > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <AnalyticsStat icon={<Check className="h-3.5 w-3.5" />} label="Delivered" value={a.delivered} color="text-emerald-400" />
              <AnalyticsStat icon={<EyeIcon className="h-3.5 w-3.5" />} label="Opened" value={a.opened} color="text-blue-400" />
              <AnalyticsStat icon={<MousePointerClick className="h-3.5 w-3.5" />} label="Clicked" value={a.clicked} color="text-purple-400" />
              <AnalyticsStat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Bounced" value={a.bounced} color="text-red-400" />
              <AnalyticsStat icon={<AlertCircle className="h-3.5 w-3.5" />} label="Complained" value={a.complained} color="text-orange-400" />
              <AnalyticsStat icon={<XCircle className="h-3.5 w-3.5" />} label="Failed" value={a.failed} color="text-red-400" />
            </div>
          )}

          {/* Rates */}
          {broadcast.status === "SENT" && a.total > 0 && (
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-text-muted">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                Delivery rate: <span className="text-emerald-400 font-medium">{deliveredRate}%</span>
              </span>
              <span className="flex items-center gap-1.5 text-text-muted">
                <EyeIcon className="h-3.5 w-3.5 text-blue-400" />
                Open rate: <span className="text-blue-400 font-medium">{openRate}%</span>
              </span>
              <span className="flex items-center gap-1.5 text-text-muted">
                <MousePointerClick className="h-3.5 w-3.5 text-purple-400" />
                Click rate: <span className="text-purple-400 font-medium">{clickRate}%</span>
              </span>
            </div>
          )}

          {/* Per-recipient list */}
          {broadcast.status === "SENT" && (
            <div>
              <h4 className="text-xs font-bold tracking-wider text-text-muted uppercase mb-2">
                Recipients
              </h4>
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-sm text-text-muted py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading recipients…
                </div>
              ) : emailDetails && emailDetails.length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {emailDetails.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between text-xs bg-background-secondary rounded-md px-3 py-2"
                    >
                      <span className="text-text-primary truncate">{e.recipientEmail}</span>
                      <span className={`font-medium capitalize shrink-0 ml-2 ${emailStatusColor(e.status)}`}>
                        {e.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No recipient data available.</p>
              )}
            </div>
          )}

          {broadcast.status === "PENDING" && (
            <p className="text-sm text-text-muted">
              This broadcast is scheduled and will be sent automatically at the scheduled time.
            </p>
          )}
          {broadcast.status === "CANCELLED" && (
            <p className="text-sm text-text-muted">This broadcast was cancelled and will not be sent.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
    </div>
  );
}

function AnalyticsStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-background-secondary rounded-lg p-3 text-center">
      <div className={`flex items-center justify-center gap-1 mb-1 ${color}`}>
        {icon}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ComposeModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [plainText, setPlainText] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [segment, setSegment] = useState<EmailSegment>("all");
  const [view, setView] = useState<"write" | "preview">("write");
  const [enhancing, startEnhance] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [sending, startSend] = useTransition();
  const [scheduling, startSchedule] = useTransition();
  const [enhanced, setEnhanced] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");

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
          setTimeout(onSent, 1500);
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
        onSent();
      } else {
        setError(res.error ?? "Failed to schedule broadcast.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background-primary rounded-xl border border-border-primary w-full max-w-3xl my-8 shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-border-primary">
          <h2 className="text-lg font-bold text-text-primary">Compose Broadcast</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-background-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
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
                  rows={8}
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

              {htmlContent && (
                <div>
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    HTML (editable)
                  </label>
                  <textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    rows={10}
                    className="w-full px-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary font-mono text-xs focus:outline-none focus:border-accent-primary/50 transition-colors resize-y"
                  />
                </div>
              )}
            </div>
          )}

          {/* Preview view */}
          {view === "preview" && (
            <div>
              {htmlContent ? (
                <div className="bg-white rounded-lg border border-border-primary overflow-hidden">
                  <iframe
                    srcDoc={htmlContent}
                    title="Email Preview"
                    className="w-full min-h-[400px] border-0"
                    sandbox=""
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
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
          <div className="border-t border-border-primary pt-5 space-y-4">
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

            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">
                {htmlContent
                  ? "Ready to send immediately to all users in the selected segment."
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
        </div>
      </div>
    </div>
  );
}
