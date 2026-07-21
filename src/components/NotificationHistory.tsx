"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  fetchNotifications,
  dismissNotification,
  dismissAllNotifications,
} from "@/app/dashboard/notifications/actions";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  posting_reminder: "📅",
  post_published: "✅",
  post_failed: "❌",
  new_comment: "💬",
  analytics_milestone: "🎉",
  streak_warning: "🔥",
  weekly_digest: "📊",
  account_disconnected: "⚠️",
  admin_broadcast: "📢",
};

export function NotificationHistory() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    fetchNotifications().then((data) => {
      if (cancelled) return;
      setNotifications(data.notifications);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    startTransition(async () => {
      await dismissNotification(id);
    });
  };

  const handleDismissAll = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(async () => {
      await dismissAllNotifications();
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="bg-background-card rounded-xl p-6 border border-border-primary">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-accent-primary" />
          <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            Notification History
          </h3>
          {unreadCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary font-medium">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleDismissAll}
            disabled={isPending}
            className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-text-muted text-sm py-6 text-center">
          No notifications yet. Enable push notifications above to start receiving updates.
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                n.read
                  ? "border-border-primary/50 bg-background-secondary/50"
                  : "border-border-primary bg-background-secondary"
              }`}
            >
              <span className="text-lg shrink-0">{TYPE_ICONS[n.type] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{n.title}</p>
                <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{n.body}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-text-muted/60">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                  {!n.read && (
                    <button
                      onClick={() => handleDismiss(n.id)}
                      className="text-[10px] text-accent-primary hover:text-accent-primary/80"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-accent-primary shrink-0 mt-1.5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
