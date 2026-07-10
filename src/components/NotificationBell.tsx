"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    startTransition(async () => {
      const data = await fetchNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    });
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    startTransition(async () => {
      await dismissNotification(id);
    });
  };

  const handleDismissAll = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    startTransition(async () => {
      await dismissAllNotifications();
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
        className="relative p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-background-card transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-accent-primary rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[calc(100vw-1rem)] bg-background-card border border-border-primary rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <span className="font-semibold text-sm text-text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleDismissAll}
                className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-border-primary/50 hover:bg-background-secondary transition-colors cursor-pointer group",
                    !n.read && "bg-accent-primary/5"
                  )}
                  onClick={() => {
                    if (!n.read) handleDismiss(n.id);
                    if (n.url) window.location.href = n.url;
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg shrink-0">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{n.title}</p>
                      <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-text-muted/60 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-accent-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
