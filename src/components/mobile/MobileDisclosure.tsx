"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileDisclosureProps {
  label: string;
  /** One-line summary shown when collapsed (phone only). */
  summary?: ReactNode;
  /** Full content revealed on expand. */
  children: ReactNode;
  /** Optional className for the outer container. */
  className?: string;
  /** Optional className for the summary line. */
  summaryClassName?: string;
  /** Controlled open state. If omitted, component manages its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Accessible name for the expand control when collapsed / expanded. */
  expandLabel?: string;
  collapseLabel?: string;
}

/**
 * Accessible accordion-style disclosure section.
 * Phone-scoped: callers wrap usage in `sm:hidden` so this never affects ≥sm.
 *
 * Keyboard: button is a native <button>, toggles aria-expanded.
 * Focus: visible ring via Tailwind defaults.
 * Reduced motion: height transition is short (150ms) and disabled by
 *   prefers-reduced-motion via the global rule in globals.css.
 */
export function MobileDisclosure({
  label,
  summary,
  children,
  className,
  summaryClassName,
  open: controlledOpen,
  onOpenChange,
  expandLabel = "More",
  collapseLabel = "Less",
}: MobileDisclosureProps) {
  const autoId = useId();
  const regionId = `disclosure-region-${autoId}`;
  const buttonId = `disclosure-button-${autoId}`;

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const toggle = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn("rounded-xl border border-border-primary bg-background-card overflow-hidden", className)}>
      <button
        id={buttonId}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={regionId}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background-secondary/50 transition-colors"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            {label}
          </span>
          {summary && !open && (
            <span className={cn("block text-xs text-text-muted mt-0.5 line-clamp-2", summaryClassName)}>
              {summary}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs font-medium text-accent-primary/80 inline-flex items-center gap-1">
          {open ? collapseLabel : expandLabel}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-150", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <div
          id={regionId}
          role="region"
          aria-labelledby={buttonId}
          className="border-t border-border-primary px-4 py-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
