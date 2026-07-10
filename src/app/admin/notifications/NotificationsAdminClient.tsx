"use client";

import { useState, useTransition } from "react";
import { Bell, Send, Clock, X, Loader2, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  sendPushNow,
  schedulePush,
  cancelScheduledPush,
  type ScheduledPushData,
  type NotificationLogData,
} from "./actions";

const SEGMENTS = [
  { value: "all", label: "All Users" },
  { value: "CALENDAR_ONLY", label: "Calendar Only" },
  { value: "CREATOR", label: "Creator" },
  { value: "PRO", label: "Pro" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  posting_reminder: "Posting Reminder",
  post_published: "Post Published",
  post_failed: "Post Failed",
  new_comment: "New Comment",
  analytics_milestone: "Analytics Milestone",
  streak_warning: "Streak Warning",
  weekly_digest: "Weekly Digest",
  account_disconnected: "Account Disconnected",
  admin_broadcast: "Admin Broadcast",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  SENT: "text-green-400 bg-green-500/10 border-green-500/20",
  CANCELLED: "text-text-muted bg-background-secondary border-border-primary",
  FAILED: "text-red-400 bg-red-500/10 border-red-500/20",
};

export function NotificationsAdminClient({
  initialPushes,
  initialLogs,
}: {
  initialPushes: ScheduledPushData[];
  initialLogs: (NotificationLogData & { userEmail: string | null })[];
}) {
  const [pushes, setPushes] = useState(initialPushes);
  const [logs, setLogs] = useState(initialLogs);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [segment, setSegment] = useState<string>("all");
  const [scheduledFor, setScheduledFor] = useState("");
  const [mode, setMode] = useState<"send" | "schedule">("send");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSendNow = () => {
    if (!title.trim() || !body.trim()) return;
    startTransition(async () => {
      const result = await sendPushNow(title, body, url || undefined, segment as "all" | "CALENDAR_ONLY" | "CREATOR" | "PRO");
      if (result.success) {
        setMessage({ type: "success", text: `Push sent to ${result.totalUsers} users (${result.sent} delivered, ${result.failed} failed).` });
        setTitle("");
        setBody("");
        setUrl("");
        // Refresh pushes list
        const res = await fetch("/admin/notifications").then(() => null).catch(() => null);
        if (result.sent > 0 || result.failed > 0) {
          setPushes((prev) => [
            {
              id: `temp_${Date.now()}`,
              title,
              body,
              url: url || null,
              segment,
              scheduledFor: new Date().toISOString(),
              status: "SENT",
              sentCount: result.sent,
              failedCount: result.failed,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      } else {
        setMessage({ type: "error", text: result.error ?? "Failed to send push." });
      }
    });
  };

  const handleSchedule = () => {
    if (!title.trim() || !body.trim() || !scheduledFor) return;
    startTransition(async () => {
      const result = await schedulePush(title, body, url || undefined, segment as "all" | "CALENDAR_ONLY" | "CREATOR" | "PRO", scheduledFor);
      if (result.success) {
        setMessage({ type: "success", text: "Push notification scheduled." });
        setTitle("");
        setBody("");
        setUrl("");
        setScheduledFor("");
        setPushes((prev) => [
          {
            id: `temp_${Date.now()}`,
            title,
            body,
            url: url || null,
            segment,
            scheduledFor: new Date(scheduledFor).toISOString(),
            status: "PENDING",
            sentCount: 0,
            failedCount: 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setMessage({ type: "error", text: result.error ?? "Failed to schedule push." });
      }
    });
  };

  const handleCancel = (id: string) => {
    startTransition(async () => {
      const result = await cancelScheduledPush(id);
      if (result.success) {
        setPushes((prev) => prev.map((p) => p.id === id ? { ...p, status: "CANCELLED" } : p));
      } else {
        setMessage({ type: "error", text: result.error ?? "Failed to cancel." });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-1" style={{ fontFamily: "var(--font-serif)" }}>
          Push Notifications
        </h1>
        <p className="text-text-muted text-sm">
          Send push notifications to your users. Schedule for later or send immediately. Target by subscription tier or all users.
        </p>
      </div>

      {/* Compose Card */}
      <div className="bg-background-card rounded-xl p-6 border border-border-primary">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-accent-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Compose Notification</h2>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm flex items-center gap-2 ${message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span className="flex-1">{message.text}</span>
            <button onClick={() => setMessage(null)} className="shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("send")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === "send" ? "bg-accent-primary text-black" : "bg-background-secondary text-text-muted hover:text-text-primary"}`}
            >
              <Send className="h-4 w-4 inline mr-1.5" />
              Send Now
            </button>
            <button
              onClick={() => setMode("schedule")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === "schedule" ? "bg-accent-primary text-black" : "bg-background-secondary text-text-muted hover:text-text-primary"}`}
            >
              <Clock className="h-4 w-4 inline mr-1.5" />
              Schedule
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
              maxLength={100}
              className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification body text"
              rows={3}
              maxLength={500}
              className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 resize-none"
            />
          </div>

          {/* URL + Segment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1.5">Click URL (optional)</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/dashboard"
                className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1.5">Target Audience</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              >
                {SEGMENTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule datetime (only in schedule mode) */}
          {mode === "schedule" && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1.5">Schedule For</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
            </div>
          )}

          {/* Action button */}
          <Button
            onClick={mode === "send" ? handleSendNow : handleSchedule}
            disabled={isPending || !title.trim() || !body.trim() || (mode === "schedule" && !scheduledFor)}
            className="w-full bg-accent-primary text-black hover:bg-accent-primary/90"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : mode === "send" ? (
              <Send className="h-4 w-4 mr-2" />
            ) : (
              <Clock className="h-4 w-4 mr-2" />
            )}
            {mode === "send" ? "Send Push Now" : "Schedule Push"}
          </Button>
        </div>
      </div>

      {/* Scheduled/Sent Pushes History */}
      <div className="bg-background-card rounded-xl p-6 border border-border-primary">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Push History</h2>
        {pushes.length === 0 ? (
          <p className="text-text-muted text-sm">No push notifications sent yet.</p>
        ) : (
          <div className="space-y-3">
            {pushes.map((push) => (
              <div key={push.id} className="p-4 rounded-lg border border-border-primary bg-background-secondary">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary truncate">{push.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[push.status] ?? STATUS_COLORS.PENDING}`}>
                        {push.status}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted line-clamp-2">{push.body}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{SEGMENTS.find((s) => s.value === push.segment)?.label ?? push.segment}</span>
                      {push.status === "SENT" && <span>{push.sentCount} sent, {push.failedCount} failed</span>}
                      <span>{new Date(push.scheduledFor).toLocaleString()}</span>
                    </div>
                  </div>
                  {push.status === "PENDING" && (
                    <button
                      onClick={() => handleCancel(push.id)}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:text-red-300 shrink-0"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Notification Log */}
      <div className="bg-background-card rounded-xl p-6 border border-border-primary">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Notification Activity</h2>
        {logs.length === 0 ? (
          <p className="text-text-muted text-sm">No notifications have been sent yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border-primary bg-background-secondary text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-accent-primary">{TYPE_LABELS[log.type] ?? log.type}</span>
                    <span className="text-xs text-text-muted">{log.userEmail ?? "Unknown"}</span>
                  </div>
                  <p className="text-text-primary truncate mt-0.5">{log.title}</p>
                  <p className="text-text-muted text-xs truncate">{log.body}</p>
                </div>
                <span className="text-xs text-text-muted shrink-0">{new Date(log.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
