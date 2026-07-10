"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  subscribeUser,
  unsubscribeUser,
  getPushSubscriptionStatus,
} from "@/app/dashboard/actions";

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

export function PushNotificationManager() {
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return "serviceWorker" in navigator && "PushManager" in window;
  });
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [dbSubscribed, setDbSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const registerServiceWorker = useCallback(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    const sub = await registration.pushManager.getSubscription();
    setSubscription(sub);
  }, []);

  const checkDbStatus = useCallback(async () => {
    try {
      const status = await getPushSubscriptionStatus();
      setDbSubscribed(status.subscribed);
    } catch {
      setDbSubscribed(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    registerServiceWorker();
    checkDbStatus();
  }, [isSupported, registerServiceWorker, checkDbStatus]);

  const subscribeToPush = useCallback(async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      setSubscription(sub);
      await subscribeUser({
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh") as ArrayBuffer))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth") as ArrayBuffer))),
        },
      });
      setDbSubscribed(true);
      setMessage("Push notifications enabled");
    } catch (error) {
      setMessage("Failed to enable push notifications");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribeFromPush = useCallback(async () => {
    setLoading(true);
    try {
      await subscription?.unsubscribe();
      setSubscription(null);
      await unsubscribeUser();
      setDbSubscribed(false);
      setMessage("Push notifications disabled");
    } catch (error) {
      setMessage("Failed to disable push notifications");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  if (!isSupported) {
    return (
      <div className="bg-background-card rounded-xl p-6 border border-border-primary">
        <h3 className="text-lg font-semibold text-text-primary mb-2" style={{ fontFamily: "var(--font-serif)" }}>
          Push Notifications
        </h3>
        <p className="text-text-muted text-sm">
          Push notifications are not supported in this browser.
        </p>
      </div>
    );
  }

  const isSubscribed = !!subscription || dbSubscribed;

  return (
    <div className="bg-background-card rounded-xl p-6 border border-border-primary">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
          Push Notifications
        </h3>
        {isSubscribed ? (
          <Bell className="h-5 w-5 text-green-400" />
        ) : (
          <BellOff className="h-5 w-5 text-text-muted" />
        )}
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-md text-sm ${message.includes("Failed") ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
          {message}
        </div>
      )}

      <p className="text-text-muted text-sm mb-4">
        {isSubscribed
          ? "You are subscribed to push notifications. You will receive updates even when the app is closed."
          : "Enable push notifications to stay updated even when the app is not open."}
      </p>

      {isSubscribed ? (
        <Button
          variant="outline"
          onClick={unsubscribeFromPush}
          disabled={loading}
          className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
          Disable Push Notifications
        </Button>
      ) : (
        <Button
          onClick={subscribeToPush}
          disabled={loading}
          className="w-full bg-accent-primary text-black hover:bg-accent-primary/90"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
          Enable Push Notifications
        </Button>
      )}
    </div>
  );
}

