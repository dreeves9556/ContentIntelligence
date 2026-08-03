/**
 * Typed errors for the Post Refinement engine.
 *
 * These live in a separate non-"use server" module because a "use server" file
 * may only export async functions — exporting classes from actions.ts would
 * break the Next.js Server Actions compiler.
 */

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends Error {
  readonly code = "VALIDATION";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class StaleSessionError extends Error {
  readonly code = "STALE_SESSION";
  constructor(message: string) {
    super(message);
    this.name = "StaleSessionError";
  }
}

export class BlockedStatusError extends Error {
  readonly code = "BLOCKED_STATUS";
  constructor(message: string) {
    super(message);
    this.name = "BlockedStatusError";
  }
}
