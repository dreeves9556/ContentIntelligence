"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, Loader2, CheckCircle2 } from "lucide-react";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "@/app/dashboard/notifications/preferences-actions";

const PREF_CONFIG: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  {
    key: "analyticsMilestone",
    label: "Analytics Milestones",
    description: "When a post hits a view milestone (1K, 5K, 10K, 50K, 100K+).",
  },
  {
    key: "streakWarning",
    label: "Streak Warnings",
    description: "If you haven't posted in 3+ days to keep your consistency streak alive.",
  },
  {
    key: "weeklyDigest",
    label: "Weekly Digest",
    description: "Every Monday: a summary of your views, likes, comments, and top post.",
  },
  {
    key: "accountDisconnected",
    label: "Account Disconnected",
    description: "When a social account connection expires so you can reconnect.",
  },
  {
    key: "adminBroadcast",
    label: "Announcements",
    description: "Important updates and announcements from the team.",
  },
];

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getNotificationPrefs().then(setPrefs);
  }, []);

  const toggle = (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaved(false);
    startTransition(async () => {
      await updateNotificationPrefs({ [key]: newPrefs[key] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  if (!prefs) {
    return (
      <div className="bg-background-card rounded-xl p-6 border border-border-primary">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-card rounded-xl p-6 border border-border-primary">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-accent-primary" />
          <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            Notification Settings
          </h3>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>

      <p className="text-text-muted text-sm mb-4">
        Choose which notifications you want to receive. Toggle off any type you don't need.
      </p>

      <div className="space-y-1">
        {PREF_CONFIG.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4 py-3 px-3 -mx-3 rounded-lg hover:bg-background-secondary/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{label}</p>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{description}</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs[key]}
              onClick={() => toggle(key)}
              disabled={isPending}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                prefs[key] ? "bg-accent-primary" : "bg-background-secondary border border-border-primary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  prefs[key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
