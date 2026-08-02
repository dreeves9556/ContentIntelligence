"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible bottom sheet for phone-only use.
 * - Focus trap while open, Escape to close, backdrop click to close.
 * - Returns focus to the trigger on close (caller passes the trigger button ref
 *   by focusing programmatically is not required; we restore to last focused
 *   element captured on open).
 * - Safe-area padding for iPhone home indicator.
 * - Body scroll locked while open.
 *
 * Phone-scoped: callers render the trigger separately (gated by `sm:hidden`)
 * and only mount this when open, so it never affects ≥sm.
 */
export function MobileBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: MobileBottomSheetProps) {
  const autoId = useId();
  const titleId = `sheet-title-${autoId}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Lock body scroll.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog.
    const t = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onOpenChange(false);
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey, true);
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const trapFocus = (e: React.FocusEvent) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.target === first && e.relatedTarget === last) {
      e.preventDefault();
      last.focus();
    } else if (e.target === last && e.relatedTarget === first) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close sheet"
        tabIndex={-1}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div
        ref={dialogRef}
        onFocus={trapFocus}
        className={cn(
          "relative w-full bg-background-card border-t border-border-primary rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border-primary bg-background-card">
          <h3 id={titleId} className="text-sm font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="p-2 -mr-2 rounded-md text-text-muted hover:text-text-primary hover:bg-background-secondary min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
