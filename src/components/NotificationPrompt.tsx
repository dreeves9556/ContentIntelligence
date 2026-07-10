"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X, Loader2 } from "lucide-react";

const STORAGE_KEY = "tlp_notification_prompt_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      localStorage.setItem(STORAGE_KEY, "unsupported");
      return;
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) setVisible(true);
      })
      .catch(() => {});
  }, []);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const { subscribeUser } = await import("@/app/dashboard/actions");
      await subscribeUser({
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh") as ArrayBuffer))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth") as ArrayBuffer))),
        },
      });

      localStorage.setItem(STORAGE_KEY, "subscribed");
      setVisible(false);
    } catch (err) {
      console.error("[NOTIFY PROMPT] Subscribe failed:", err);
      setError("Couldn't enable notifications. You can try again later from your Profile page.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "dismissed");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-accent-primary/10 border-b border-accent-primary/20 text-sm">
      <Bell className="h-4 w-4 text-accent-primary shrink-0" />
      <p className="flex-1 text-text-secondary min-w-0">
        {error || (
          <>
            <span className="text-text-primary font-medium">Stay in the loop.</span>{" "}
            Enable push notifications for analytics milestones, streak warnings, and weekly digests.
          </>
        )}
      </p>
      {error ? (
        <button
          onClick={handleDismiss}
          className="text-text-muted hover:text-text-primary text-xs shrink-0"
        >
          Dismiss
        </button>
      ) : (
        <>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-primary text-black text-xs font-medium hover:bg-accent-primary/90 disabled:opacity-50 shrink-0"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Enable
          </button>
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="text-text-muted hover:text-text-primary shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
