"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MobileTabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface MobileTabsProps {
  tabs: MobileTabItem[];
  /** Initial active tab id. */
  defaultTabId?: string;
  /** Controlled active tab id. */
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  className?: string;
  /** Optional element rendered to the right of the tab strip (e.g. a copy-all button). */
  trailing?: ReactNode;
}

/**
 * Accessible tablist for phone-only use.
 * Implements the WAI-ARIA tabs pattern: roving tabindex, arrow-key nav,
 * role=tablist/tab/tabpanel, aria-selected, aria-controls.
 *
 * Phone-scoped: callers wrap usage in `sm:hidden`.
 */
export function MobileTabs({
  tabs,
  defaultTabId,
  activeTabId: controlledTabId,
  onTabChange,
  className,
  trailing,
}: MobileTabsProps) {
  const autoId = useId();
  const baseId = `mobile-tabs-${autoId}`;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [internalTabId, setInternalTabId] = useState(defaultTabId ?? tabs[0]?.id ?? "");
  const isControlled = controlledTabId !== undefined;
  const activeTabId = isControlled ? controlledTabId : internalTabId;

  const setActive = (id: string) => {
    if (!isControlled) setInternalTabId(id);
    onTabChange?.(id);
  };

  const focusTab = (index: number) => {
    const clamped = ((index % tabs.length) + tabs.length) % tabs.length;
    tabRefs.current[clamped]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusTab(0);
        break;
      case "End":
        e.preventDefault();
        focusTab(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  return (
    <div className={className}>
      <div className="flex items-stretch gap-1 border-b border-border-primary">
        <div
          role="tablist"
          aria-label="Section"
          className="flex flex-1 min-w-0 overflow-x-auto scrollbar-none"
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const panelId = `${baseId}-panel-${tab.id}`;
            const tabButtonId = `${baseId}-tab-${tab.id}`;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                role="tab"
                id={tabButtonId}
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className={cn(
                  "shrink-0 px-3 py-2.5 text-xs font-bold tracking-wide uppercase whitespace-nowrap border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 focus-visible:rounded",
                  isActive
                    ? "border-accent-primary text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-primary"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {trailing && <div className="shrink-0 self-center pl-1">{trailing}</div>}
      </div>
      {activeTab && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeTab.id}`}
          aria-labelledby={`${baseId}-tab-${activeTab.id}`}
          tabIndex={0}
          className="focus:outline-none"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}
