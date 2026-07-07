interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.lockedUntil && entry.lockedUntil < now) {
      store.delete(key);
    } else if (!entry.lockedUntil && now - entry.firstAttempt > 60 * 60 * 1000) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  lockoutMs: number
): { allowed: boolean; retryAfterMs?: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  }

  if (entry?.lockedUntil && entry.lockedUntil <= now) {
    store.delete(key);
  }

  return { allowed: true };
}

export function recordFailedAttempt(
  key: string,
  maxAttempts: number,
  lockoutMs: number
): { lockedOut: boolean; retryAfterMs?: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, firstAttempt: now });
    return { lockedOut: false };
  }

  entry.count += 1;

  if (entry.count >= maxAttempts) {
    entry.lockedUntil = now + lockoutMs;
    return { lockedOut: true, retryAfterMs: lockoutMs };
  }

  return { lockedOut: false };
}

export function clearRateLimit(key: string) {
  store.delete(key);
}

interface ActionRateEntry {
  count: number;
  windowStart: number;
}

const actionStore = new Map<string, ActionRateEntry>();

export function checkActionRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number } {
  cleanup();
  const now = Date.now();
  const entry = actionStore.get(key);

  if (!entry) {
    actionStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
    return { allowed: true };
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return { allowed: false, retryAfterMs: windowMs - (now - entry.windowStart) };
  }

  return { allowed: true };
}

export function formatRetryTime(ms: number): string {
  const minutes = Math.ceil(ms / (60 * 1000));
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
