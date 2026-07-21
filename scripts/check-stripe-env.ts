/**
 * Stripe Environment Variable Diagnostic Script
 *
 * Safely checks that all required Stripe env vars are present and have
 * the expected prefixes. NEVER prints full secret values.
 *
 * Usage:
 *   npm run stripe:check-env
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Env loading (same pattern as other scripts) ───────────────────────────

function loadEnv() {
  for (const filename of [".env.local", ".env.stripe.generated"]) {
    const envPath = resolve(process.cwd(), filename);
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // file not found — skip
    }
  }
}

loadEnv();

// ─── Helpers ───────────────────────────────────────────────────────────────

function getPrefix(val: string | undefined, len: number = 8): string {
  if (!val) return "N/A";
  return val.slice(0, len);
}

function checkVar(
  name: string,
  expectedPrefix?: string
): { present: boolean; prefix: string; matchesPrefix: boolean } {
  const val = process.env[name];
  const present = typeof val === "string" && val.trim().length > 0;
  const prefix = present ? getPrefix(val) : "N/A";
  const matchesPrefix = present
    ? expectedPrefix
      ? val.startsWith(expectedPrefix)
      : true
    : false;
  return { present, prefix, matchesPrefix };
}

// ─── Main ──────────────────────────────────────────────────────────────────

const cwd = process.cwd();
const envLocalPath = resolve(cwd, ".env.local");
let envLocalExists = false;
try {
  readFileSync(envLocalPath, "utf-8");
  envLocalExists = true;
} catch {
  envLocalExists = false;
}

console.log("=== The Local Post — Stripe Environment Diagnostic ===\n");
console.log(`CWD: ${cwd}`);
console.log(`.env.local exists: ${envLocalExists ? "yes" : "no"}`);

if (!envLocalExists) {
  console.log("\n❌ .env.local not found in CWD. Create it with your Stripe keys.");
  console.log("   Expected location: " + envLocalPath);
  process.exit(1);
}

console.log();

const CHECKOUT_VARS: Array<{ name: string; prefix?: string }> = [
  { name: "STRIPE_SECRET_KEY", prefix: "sk_test_" },
  { name: "STRIPE_SOLO_MONTHLY_PRICE_ID", prefix: "price_" },
  { name: "STRIPE_SOLO_ANNUAL_PRICE_ID", prefix: "price_" },
  { name: "STRIPE_COMMUNITY_MONTHLY_PRICE_ID", prefix: "price_" },
  { name: "STRIPE_COMMUNITY_ANNUAL_PRICE_ID", prefix: "price_" },
  { name: "NEXT_PUBLIC_APP_URL" },
];

const WEBHOOK_VARS: Array<{ name: string; prefix?: string }> = [
  { name: "STRIPE_WEBHOOK_SECRET", prefix: "whsec_" },
];

let allCheckoutOk = true;
let allWebhookOk = true;

console.log("── Checkout-required vars ──");
for (const { name, prefix } of CHECKOUT_VARS) {
  const result = checkVar(name, prefix);
  if (name === "NEXT_PUBLIC_APP_URL") {
    const val = process.env[name];
    console.log(`  ${name}: ${result.present ? "present" : "MISSING"}, value ${val || "N/A"}`);
    if (!result.present) allCheckoutOk = false;
  } else {
    const status = result.present
      ? result.matchesPrefix
        ? `present, prefix ${result.prefix}…`
        : `present, UNEXPECTED prefix ${result.prefix}… (expected ${prefix})`
      : "MISSING";
    console.log(`  ${name}: ${status}`);
    if (!result.present || !result.matchesPrefix) allCheckoutOk = false;
  }
}

console.log("\n── Webhook-required vars (not needed for checkout UI) ──");
for (const { name, prefix } of WEBHOOK_VARS) {
  const result = checkVar(name, prefix);
  const status = result.present
    ? result.matchesPrefix
      ? `present, prefix ${result.prefix}…`
      : `present, UNEXPECTED prefix ${result.prefix}… (expected ${prefix})`
    : "missing (OK if not testing webhooks locally yet)";
  console.log(`  ${name}: ${status}`);
  if (!result.present) allWebhookOk = false;
}

// Also check for old/legacy vars that should NOT be present
console.log("\n── Legacy vars (should NOT be present) ──");
const LEGACY_VARS = [
  "STRIPE_CREATOR_PRICE_ID",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PRICE_ID_CREATOR",
  "STRIPE_PRICE_ID_PRO",
];
for (const name of LEGACY_VARS) {
  const val = process.env[name];
  if (val) {
    console.log(`  ⚠️  ${name}: present (should be removed — using old naming)`);
  } else {
    console.log(`  ✅ ${name}: not present (correct)`);
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (allCheckoutOk) {
  console.log("✅ Checkout configuration: READY");
} else {
  console.log("❌ Checkout configuration: INCOMPLETE — see missing vars above");
}

if (allWebhookOk) {
  console.log("✅ Webhook configuration: READY");
} else {
  console.log("⚠️  Webhook configuration: NOT SET (checkout will work, webhooks won't)");
}

if (allCheckoutOk) {
  console.log("\n✅ The billing page should NOT show the 'not configured' warning.");
  console.log("   If it still does, restart your dev server:");
  console.log("     Ctrl+C, then: npm run dev");
  console.log("   If still stuck, try clearing the Next.js cache:");
  console.log("     rm -rf .next && npm run dev");
} else {
  console.log("\n❌ Fix the missing/incorrect vars above in .env.local, then restart:");
  console.log("     Ctrl+C, then: npm run dev");
}
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
