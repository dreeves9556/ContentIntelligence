"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Share } from "lucide-react";
import { cn } from "@/lib/utils";

type Platform = "android" | "ios" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "install-prompt-dismissed";
const SHOW_DELAY_MS = 15_000;

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isStandalone = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }, []);

  const isMobile = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1024px)").matches;
  }, []);

  const detectPlatform = useCallback((): Platform => {
    if (typeof window === "undefined") return null;
    const ua = navigator.userAgent;
    // iOS Safari (not Chrome on iOS)
    if (/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)) return "ios";
    return "android";
  }, []);

  useEffect(() => {
    if (isStandalone() || !isMobile()) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === "true") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const timer = setTimeout(() => {
      // If we got beforeinstallprompt, use that. Otherwise check iOS.
      setPlatform((prev) => prev ?? detectPlatform());
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, [isStandalone, isMobile, detectPlatform]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "true");
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
      setDeferredPrompt(null);
      handleDismiss();
    }
  }, [deferredPrompt, handleDismiss]);

  if (!visible || !platform) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 lg:hidden",
        "bg-background-secondary border-t border-accent-primary/30",
        "transform transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-primary/15">
          {platform === "ios" ? (
            <Share className="h-4 w-4 text-accent-primary" />
          ) : (
            <Download className="h-4 w-4 text-accent-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">Add to Home Screen</p>
          {platform === "ios" ? (
            <p className="text-xs text-text-muted truncate">
              Tap the Share icon, then &ldquo;Add to Home Screen&rdquo;
            </p>
          ) : (
            <p className="text-xs text-text-muted truncate">
              Install The Local Post for quick access from your home screen
            </p>
          )}
        </div>

        {platform === "android" && deferredPrompt ? (
          <Button size="sm" onClick={handleInstall} className="shrink-0">
            Install
          </Button>
        ) : platform === "ios" ? (
          <Button size="sm" variant="outline" onClick={handleDismiss} className="shrink-0">
            Got it
          </Button>
        ) : null}

        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md text-text-muted hover:text-text-primary"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
