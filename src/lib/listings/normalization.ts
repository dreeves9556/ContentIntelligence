/**
 * Address and URL normalization for duplicate detection and storage.
 *
 * Normalization is used for:
 * - `normalizedAddress` on the Listing model (duplicate detection).
 * - `normalizedSourceUrl` on the Listing model (duplicate detection, V1C import).
 *
 * Normalization is NOT a substitute for validation. Validate inputs with the
 * Zod schemas in `validation.ts` before normalizing.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Address normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize an address for duplicate detection.
 *
 * Combines address line 1, address line 2 (if present), city, state, and
 * postal code into a single lowercased, comma-separated string with collapsed
 * whitespace.
 */
export function normalizeAddress(input: {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
}): string {
  const parts = [
    input.addressLine1,
    input.addressLine2,
    input.city,
    input.state,
    input.postalCode,
  ]
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.trim().toLowerCase().replace(/\s+/g, " "));

  return parts.join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// URL normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracking parameters to strip during URL normalization.
 */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_eid",
  "mc_cid",
  "_ga",
  "igshid",
  "ref",
  "ref_src",
  "ref_url",
]);

/**
 * Normalize a URL for storage and duplicate detection.
 *
 * - Lowercase scheme and host.
 * - Remove fragments.
 * - Remove known tracking parameters.
 * - Normalize default port (omit :80 for http, :443 for https).
 * - Preserve only necessary query parameters.
 *
 * Returns null if the input is not a valid HTTP(S) URL.
 */
export function normalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  // Only HTTP(S) is supported.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  // Lowercase scheme and host.
  const protocol = url.protocol.toLowerCase();
  const host = url.hostname.toLowerCase();

  // Normalize default port.
  let port = url.port;
  if ((protocol === "http:" && port === "80") || (protocol === "https:" && port === "443")) {
    port = "";
  }

  // Filter tracking parameters from search params.
  const searchParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) {
      searchParams.append(key, value);
    }
  }

  // Build normalized URL string.
  const portPart = port ? `:${port}` : "";
  const searchPart = searchParams.toString() ? `?${searchParams.toString()}` : "";
  // Remove trailing slash from pathname unless it's just "/".
  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");

  return `${protocol}//${host}${portPart}${pathname}${searchPart}`;
}

/**
 * Canonicalize an object for stable hashing.
 *
 * Sorts object keys recursively so JSON.stringify produces a stable output
 * regardless of key insertion order. Used for requestParamsHash in generation
 * claims — ordinary JSON.stringify can produce unstable hashes if key order
 * differs across calls, breaking idempotency.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonStringify).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return `{${pairs.join(",")}}`;
}
