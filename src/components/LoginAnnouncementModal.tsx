"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { dismissLoginAnnouncement, type LoginAnnouncementData } from "@/app/admin/announcements/login-actions";

export function LoginAnnouncementModal({
  announcements,
}: {
  announcements: LoginAnnouncementData[];
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  const current = announcements[index];

  // Hide when there are no announcements — derived during render instead of
  // an effect to avoid the set-state-in-effect anti-pattern.
  if (announcements.length === 0) return null;

  if (!visible || !current) return null;

  const hasPrev = index > 0;
  const hasNext = index < announcements.length - 1;

  function handleDismiss() {
    setDismissing(true);
    dismissLoginAnnouncement(current.id)
      .catch(() => {})
      .finally(() => {
        if (hasNext) {
          setIndex(index + 1);
          setDismissing(false);
        } else {
          setVisible(false);
        }
      });
  }

  function handleSkip() {
    if (hasNext) {
      setIndex(index + 1);
    } else {
      setVisible(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background-primary rounded-xl border border-border-primary w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-accent-primary/10 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-accent-primary" />
            <span
              className="text-sm font-bold text-accent-primary uppercase tracking-wider"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Announcement
            </span>
          </div>
          {announcements.length > 1 && (
            <span className="text-xs text-text-muted">
              {index + 1} of {announcements.length}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <h2
            className="text-xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {current.title}
          </h2>
          <div
            className="text-sm text-text-muted leading-relaxed prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: current.message }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border-primary bg-background-secondary/30">
          <div className="flex items-center gap-1">
            {hasPrev && (
              <button
                onClick={() => setIndex(index - 1)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-background-secondary transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={handleSkip}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-background-secondary transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="flex items-center gap-2 px-5 py-2 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {dismissing ? (
              "Dismissing…"
            ) : (
              <>
                <X className="h-4 w-4" />
                Got it
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
