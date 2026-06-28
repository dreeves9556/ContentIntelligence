"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
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

  if (isSelf) {
    return (
      <button
        disabled
        title="You cannot delete your own account"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[#2a2a2a] bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
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
  const [isSliding, setIsSliding] = useState(false);
  const [completed, setCompleted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const startedAtXRef = useRef<number>(0);

  const SLIDE_THRESHOLD = 0.92;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isPending || completed) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsSliding(true);
      startedAtXRef.current = e.clientX;
    },
    [isPending, completed]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isSliding || !trackRef.current) return;
      const trackWidth = trackRef.current.offsetWidth;
      const knobWidth = 48;
      const maxDistance = trackWidth - knobWidth;
      const delta = e.clientX - startedAtXRef.current;
      const progress = Math.min(1, Math.max(0, delta / maxDistance));
      setSliderProgress(progress);
    },
    [isSliding]
  );

  const handlePointerUp = useCallback(() => {
    if (!isSliding) return;
    setIsSliding(false);
    if (sliderProgress >= SLIDE_THRESHOLD) {
      setCompleted(true);
      onDelete();
    } else {
      setSliderProgress(0);
    }
  }, [isSliding, sliderProgress, onDelete]);

  useEffect(() => {
    if (completed) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [completed, isPending, onClose]);

  const knobTranslate = `translateX(${sliderProgress * 100}%)`;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-[#e8e8e8]">
              Delete User Account
            </h2>
          </div>
          {!isPending && (
            <button
              onClick={onClose}
              className="text-[#787878] hover:text-[#e8e8e8] transition-colors"
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

          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 space-y-1.5">
            <p className="text-sm font-medium text-[#e8e8e8]">
              {userName || "Unnamed User"}
            </p>
            <p className="text-xs text-[#787878]">{userEmail ?? "—"}</p>
          </div>

          <ul className="text-xs text-[#787878] space-y-1 ml-4 list-disc">
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
            <p className="text-xs text-[#787878] mb-2.5 text-center">
              {completed
                ? "Deleting…"
                : "Slide to confirm deletion →"}
            </p>
            <div
              ref={trackRef}
              className="relative h-12 bg-[#0a0a0a] border border-[#2a2a2a] rounded-full overflow-hidden select-none"
              style={{ touchAction: "none" }}
            >
              {/* Track label */}
              {!isSliding && sliderProgress === 0 && !completed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-medium text-[#3a3a3a] tracking-wide">
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
