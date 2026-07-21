"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2, X } from "lucide-react";
import { deleteUser } from "../actions";

interface DeleteUserButtonProps {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  isSelf: boolean;
}

export default function DeleteUserButton({
  userId,
  userName,
  userEmail,
  isSelf,
}: DeleteUserButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (isSelf) {
    return (
      <button
        disabled
        title="You cannot delete your own account"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border-primary bg-background-secondary text-text-muted/60 cursor-not-allowed"
      >
        <Trash2 className="w-3 h-3" />
        Delete
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setShowConfirm(true);
          setError(null);
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Delete
      </button>

      {showConfirm && (
        <DeleteConfirmModal
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          isPending={isPending}
          error={error}
          onClose={() => {
            if (!isPending) setShowConfirm(false);
          }}
          onDelete={() => {
            setError(null);
            startTransition(async () => {
              const result = await deleteUser(userId);
              if (result.success) {
                setShowConfirm(false);
                router.refresh();
              } else {
                setError(result.error ?? "Failed to delete user.");
              }
            });
          }}
        />
      )}
    </>
  );
}

interface DeleteConfirmModalProps {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onDelete: () => void;
}

function DeleteConfirmModal({
  userName,
  userEmail,
  isPending,
  error,
  onClose,
  onDelete,
}: DeleteConfirmModalProps) {
  const [sliderProgress, setSliderProgress] = useState(0);
  const [maxDistance, setMaxDistance] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [completed, setCompleted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const startedAtXRef = useRef<number>(0);
  const progressRef = useRef(0);
  const maxDistanceRef = useRef(0);

  const SLIDE_THRESHOLD = 0.92;
  const KNOB_WIDTH = 48;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isPending || completed) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      if (trackRef.current) {
        const nextMaxDistance = trackRef.current.offsetWidth - KNOB_WIDTH;
        maxDistanceRef.current = nextMaxDistance;
        setMaxDistance(nextMaxDistance);
      }
      setIsSliding(true);
      startedAtXRef.current = e.clientX;
    },
    [isPending, completed]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isSliding) return;
      const delta = e.clientX - startedAtXRef.current;
      const maxDistance = maxDistanceRef.current || 1;
      const progress = Math.min(1, Math.max(0, delta / maxDistance));
      progressRef.current = progress;
      setSliderProgress(progress);
    },
    [isSliding]
  );

  const handlePointerUp = useCallback(() => {
    if (!isSliding) return;
    setIsSliding(false);
    if (progressRef.current >= SLIDE_THRESHOLD) {
      setCompleted(true);
      onDelete();
    } else {
      progressRef.current = 0;
      setSliderProgress(0);
    }
  }, [isSliding, onDelete]);

  useEffect(() => {
    if (completed) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [completed, isPending, onClose]);

  const knobTranslate = `translateX(${sliderProgress * maxDistance}px)`;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-md bg-background-card border border-border-primary rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-primary">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              Delete User Account
            </h2>
          </div>
          {!isPending && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-[#a0a0a0] leading-relaxed">
            You are about to permanently delete this user account. This action
            cannot be undone. All associated data will be removed, including:
          </p>

          <div className="bg-background-secondary border border-border-primary rounded-lg p-4 space-y-1.5">
            <p className="text-sm font-medium text-text-primary">
              {userName || "Unnamed User"}
            </p>
            <p className="text-xs text-text-muted">{userEmail ?? "—"}</p>
          </div>

          <ul className="text-xs text-text-muted space-y-1 ml-4 list-disc">
            <li>Questionnaires &amp; onboarding data</li>
            <li>Content calendars &amp; archives</li>
            <li>Social media connections &amp; analytics</li>
            <li>Profile surveys &amp; push subscriptions</li>
          </ul>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Slide to confirm */}
          <div className="pt-2">
            <p className="text-xs text-text-muted mb-2.5 text-center">
              {completed
                ? "Deleting…"
                : "Slide to confirm deletion →"}
            </p>
            <div
              ref={trackRef}
              className="relative h-12 bg-background-secondary border border-border-primary rounded-full overflow-hidden select-none"
              style={{ touchAction: "none" }}
            >
              {/* Track label */}
              {!isSliding && sliderProgress === 0 && !completed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-medium text-text-muted/60 tracking-wide">
                    Slide to delete
                  </span>
                </div>
              )}

              {/* Danger fill */}
              <div
                className="absolute inset-y-0 left-0 bg-red-500/15 transition-opacity"
                style={{
                  width: `calc(${sliderProgress * 100}% + 48px)`,
                  opacity: sliderProgress > 0 ? 1 : 0,
                }}
              />

              {/* Knob */}
              <div
                ref={knobRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`absolute top-0 left-0 h-12 w-12 flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing touch-none ${
                  completed
                    ? "bg-red-500"
                    : sliderProgress >= SLIDE_THRESHOLD
                    ? "bg-red-500"
                    : "bg-red-500/80"
                }`}
                style={{
                  transform: knobTranslate,
                  transition: isSliding ? "none" : "transform 0.3s ease",
                }}
              >
                {isPending ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5 text-white" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
