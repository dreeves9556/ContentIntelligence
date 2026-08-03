"use client";

import { createContext, useContext } from "react";

export type GenerationPhase =
  | "idle"
  | "generating"
  | "checking"
  | "refreshing"
  | "ready"
  | "exiting"
  | "generation_error"
  | "refresh_error"
  | "unknown_outcome";

export interface CalendarGenerationContextValue {
  /** Start a brand-new generation. Mints a fresh requestId. */
  startNewGeneration: (daysToPost?: number) => void;
  /** Retry the current attempt. Reuses the same requestId + lastDaysToPost. */
  retryGeneration: () => void;
  /** Current phase of the generation state machine. */
  phase: GenerationPhase;
  /** Error message for the current error phase, if any. */
  error: string | null;
  /** The day count used for the current/last generation attempt. */
  lastDaysToPost: number;
  /** True when any generation-related phase is active. */
  isBusy: boolean;
}

export const CalendarGenerationContext = createContext<CalendarGenerationContextValue | null>(null);

export function useCalendarGeneration(): CalendarGenerationContextValue {
  const ctx = useContext(CalendarGenerationContext);
  if (!ctx) {
    throw new Error("useCalendarGeneration must be used within a CalendarGenerationShell");
  }
  return ctx;
}
