"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
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
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [authRequired, setAuthRequired] = useState(false);

  const isIOS = typeof window !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  const pathname = usePathname();

  const registerServiceWorker = useCallback(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    const sub = await registration.pushManager.getSubscription();
    setSubscription(sub);
    return sub;
  }, []);

  const checkDbStatus = useCallback(async (endpoint?: string) => {
    try {
      const status = await getPushSubscriptionStatus(endpoint);
      if (!status.success) {
        const isAuthError = status.error === "Not authenticated";
        setAuthRequired(isAuthError);
        setDeviceSubscribed(false);
        if (isAuthError) {
          setMessage("Your session has expired. Sign in again to manage push notifications.");
        }
        return;
      }
      setAuthRequired(false);
      setDeviceSubscribed(status.subscribed);
    } catch {
      setDeviceSubscribed(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    let cancelled = false;

    void (async () => {
      let sub: PushSubscription | null = null;
      try {
        sub = await registerServiceWorker();
      } catch (error) {
        console.error("[PUSH] Service worker setup failed:", error);
      }

      if (!cancelled) {
        await checkDbStatus(sub?.endpoint);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSupported, registerServiceWorker, checkDbStatus]);

  const subscribeToPush = useCallback(async () => {
    setLoading(true);
    setAuthRequired(false);
    setErrorDetail("");
    try {
      const authStatus = await getPushSubscriptionStatus();
      if (!authStatus.success) {
        if (authStatus.error === "Not authenticated") {
          setAuthRequired(true);
          setMessage("Your session has expired. Sign in again to enable push notifications.");
        } else {
          setMessage(authStatus.error);
        }
        return;
      }

      if (isIOS && !isStandalone) {
        setMessage("On iPhone, you need to add this app to your Home Screen first. Tap the Share button at the bottom of Safari, then 'Add to Home Screen', then open The Local Post from your home screen icon.");
        return;
      }

      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setMessage("Push notifications are not configured on this server. Contact support.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notification permission was denied. Go to Settings → The Local Post → Notifications to allow notifications, then try again.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      const result = await subscribeUser({
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh") as ArrayBuffer))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth") as ArrayBuffer))),
        },
      });
      if (!result.success) {
        if (result.error === "Not authenticated") {
          await sub.unsubscribe().catch(() => undefined);
          setSubscription(null);
          setDeviceSubscribed(false);
          setAuthRequired(true);
          setMessage("Your session has expired. Sign in again to enable push notifications.");
          return;
        }
        throw new Error(result.error);
      }
      setSubscription(sub);
      setDeviceSubscribed(true);
      setMessage("Push notifications enabled");
    } catch (error) {
      const isSecureContext = window.isSecureContext;
      const errStr = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error("[PUSH] Subscribe failed:", error);

      if (errStr.includes("Not authenticated")) {
        setAuthRequired(true);
        setMessage("Your session has expired. Sign in again to enable push notifications.");
        setErrorDetail("");
        return;
      } else if (!isSecureContext) {
        setMessage("Push notifications require HTTPS on mobile. They work on localhost on your computer, but your phone needs a secure connection.");
      } else if (errStr.includes("aborted") || errStr.includes("AbortError")) {
        setMessage("Notification permission was denied. Go to Settings → The Local Post → Notifications to allow notifications, then try again.");
      } else if (errStr.includes("activation") || errStr.includes("registering")) {
        setMessage("Service worker failed to activate. Close the app completely, reopen it from your Home Screen, and try again.");
      } else if (isIOS) {
        setMessage(`Push setup failed on iOS. Make sure you opened this from your Home Screen icon (not Safari). Error: ${errStr}`);
      } else {
        setMessage(`Failed to enable push notifications. Error: ${errStr}`);
      }
      setErrorDetail(errStr);
    } finally {
      setLoading(false);
    }
  }, [isIOS, isStandalone]);

  const unsubscribeFromPush = useCallback(async () => {
    setLoading(true);
    setAuthRequired(false);
    try {
      const endpoint = subscription?.endpoint;
      if (!endpoint || !subscription) {
        setMessage("This device is not subscribed to push notifications.");
        return;
      }
      await subscription.unsubscribe();
      const result = await unsubscribeUser(endpoint);
      if (!result.success) throw new Error(result.error);
      setSubscription(null);
      setDeviceSubscribed(false);
      setMessage("Push notifications disabled on this device");
    } catch (error) {
      if (error instanceof Error && error.message === "Not authenticated") {
        setAuthRequired(true);
        setMessage("Your session has expired. Sign in again to manage push notifications.");
      } else {
        setMessage(error instanceof Error ? error.message : "Failed to disable push notifications");
      }
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

  const isSubscribed = deviceSubscribed;
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(pathname || "/onboarding")}`;

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
        <div className={`mb-4 p-3 rounded-md text-sm ${authRequired || message.includes("Failed") || message.includes("denied") || message.includes("not configured") || message.includes("Home Screen") || message.includes("failed") ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
          <p>{message}</p>
          {authRequired && (
            <a href={loginUrl} className="mt-2 inline-block font-medium underline">
              Sign in again
            </a>
          )}
          {errorDetail && (
            <details className="mt-2 text-xs opacity-70">
              <summary>Technical details</summary>
              {errorDetail}
            </details>
          )}
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

