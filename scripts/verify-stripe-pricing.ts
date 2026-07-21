/**
 * Stripe Pricing Verification Script
 *
 * Retrieves the four The Local Post prices from Stripe and verifies
 * that the pricing matches the expected values.
 *
 * Usage:
 *   npm run stripe:verify-pricing
 *
 * Requires:
 *   STRIPE_SECRET_KEY in .env.local
 *   Price IDs in .env.local (or .env.stripe.generated):
 *     STRIPE_SOLO_MONTHLY_PRICE_ID
 *     STRIPE_SOLO_ANNUAL_PRICE_ID
 *     STRIPE_COMMUNITY_MONTHLY_PRICE_ID
 *     STRIPE_COMMUNITY_ANNUAL_PRICE_ID
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import Stripe from "stripe";

// ─── Env loading ───────────────────────────────────────────────────────────

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

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("❌ STRIPE_SECRET_KEY is not set. Add it to .env.local and try again.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
  typescript: true,
});

// ─── Expected values ───────────────────────────────────────────────────────

const EXPECTED = {
  solo_monthly: {
    unit_amount: 20000,
    interval: "month",
    billing_scheme: "per_unit",
    tiers_mode: null,
  },
  solo_annual: {
    unit_amount: 199900,
    interval: "year",
    billing_scheme: "per_unit",
    tiers_mode: null,
  },
  community_monthly: {
    interval: "month",
    billing_scheme: "tiered",
    tiers_mode: "graduated",
    tiers: [
      { up_to: 1, unit_amount: 20000 },
      { up_to: 4, unit_amount: 15000 },
      { up_to: 9, unit_amount: 13000 },
      { up_to: "inf", unit_amount: 11000 },
    ],
  },
  community_annual: {
    interval: "year",
    billing_scheme: "tiered",
    tiers_mode: "graduated",
    tiers: [
      { up_to: 1, unit_amount: 200000 },
      { up_to: 4, unit_amount: 150000 },
      { up_to: 9, unit_amount: 130000 },
      { up_to: "inf", unit_amount: 110000 },
    ],
  },
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────

let allPassed = true;

function check(label: string, actual: unknown, expected: unknown): boolean {
  const pass = actual === expected;
  const status = pass ? "✅" : "❌";
  console.log(`  ${status} ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  if (!pass) allPassed = false;
  return pass;
}

function checkTiers(
  label: string,
  actualTiers: Stripe.Price.Tier[],
  expectedTiers: readonly { up_to: number | "inf"; unit_amount: number }[]
): void {
  console.log(`  ${label}:`);
  if (actualTiers.length !== expectedTiers.length) {
    console.log(`    ❌ Tier count: expected ${expectedTiers.length}, got ${actualTiers.length}`);
    allPassed = false;
    return;
  }
  for (let i = 0; i < expectedTiers.length; i++) {
    const exp = expectedTiers[i];
    const act = actualTiers[i];
    const expUpTo = exp.up_to === "inf" ? null : exp.up_to;
    const actUpTo = act.up_to;
    const upToMatch = expUpTo === actUpTo;
    const amountMatch = act.unit_amount === exp.unit_amount;
    if (upToMatch && amountMatch) {
      console.log(`    ✅ Tier ${i + 1}: up_to=${exp.up_to}, ${exp.unit_amount / 100} cents → $${(exp.unit_amount / 100).toFixed(2)}`);
    } else {
      console.log(`    ❌ Tier ${i + 1}: expected up_to=${exp.up_to}, ${exp.unit_amount}; got up_to=${actUpTo}, ${act.unit_amount}`);
      allPassed = false;
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== The Local Post — Stripe Pricing Verification ===\n");

  const priceIds = {
    solo_monthly: process.env.STRIPE_SOLO_MONTHLY_PRICE_ID,
    solo_annual: process.env.STRIPE_SOLO_ANNUAL_PRICE_ID,
    community_monthly: process.env.STRIPE_COMMUNITY_MONTHLY_PRICE_ID,
    community_annual: process.env.STRIPE_COMMUNITY_ANNUAL_PRICE_ID,
  };

  // Check all price IDs are set
  let missingIds = false;
  for (const [key, id] of Object.entries(priceIds)) {
    if (!id) {
      console.error(`❌ ${key} is not set in env. Run npm run stripe:setup-catalog first.`);
      missingIds = true;
    }
  }
  if (missingIds) {
    process.exit(1);
  }

  // Retrieve all prices (expand tiers for graduated pricing)
  const prices: Record<string, Stripe.Price> = {};
  for (const [key, id] of Object.entries(priceIds)) {
    try {
      prices[key] = await stripe.prices.retrieve(id!, { expand: ["tiers"] } as Stripe.PriceRetrieveParams);
    } catch (err) {
      console.error(`❌ Failed to retrieve ${key} (${id}): ${err}`);
      process.exit(1);
    }
  }

  // ── Verify Solo Monthly ──────────────────────────────────────────────────
  console.log("\n📦 Solo Monthly:");
  check("unit_amount", prices.solo_monthly.unit_amount, EXPECTED.solo_monthly.unit_amount);
  check("interval", prices.solo_monthly.recurring?.interval, EXPECTED.solo_monthly.interval);
  check("billing_scheme", prices.solo_monthly.billing_scheme, EXPECTED.solo_monthly.billing_scheme);
  check("tiers_mode", prices.solo_monthly.tiers_mode, EXPECTED.solo_monthly.tiers_mode);

  // ── Verify Solo Annual ───────────────────────────────────────────────────
  console.log("\n📦 Solo Annual:");
  check("unit_amount", prices.solo_annual.unit_amount, EXPECTED.solo_annual.unit_amount);
  check("interval", prices.solo_annual.recurring?.interval, EXPECTED.solo_annual.interval);
  check("billing_scheme", prices.solo_annual.billing_scheme, EXPECTED.solo_annual.billing_scheme);
  check("tiers_mode", prices.solo_annual.tiers_mode, EXPECTED.solo_annual.tiers_mode);

  // ── Verify Community Monthly ─────────────────────────────────────────────
  console.log("\n📦 Community Monthly (graduated):");
  check("billing_scheme", prices.community_monthly.billing_scheme, EXPECTED.community_monthly.billing_scheme);
  check("tiers_mode", prices.community_monthly.tiers_mode, EXPECTED.community_monthly.tiers_mode);
  check("interval", prices.community_monthly.recurring?.interval, EXPECTED.community_monthly.interval);
  check("usage_type", prices.community_monthly.recurring?.usage_type, "licensed");
  if (prices.community_monthly.tiers) {
    checkTiers("Tiers", prices.community_monthly.tiers, EXPECTED.community_monthly.tiers);
  } else {
    console.log("    ❌ No tiers found on community_monthly price");
    allPassed = false;
  }

  // ── Verify Community Annual ──────────────────────────────────────────────
  console.log("\n📦 Community Annual (graduated):");
  check("billing_scheme", prices.community_annual.billing_scheme, EXPECTED.community_annual.billing_scheme);
  check("tiers_mode", prices.community_annual.tiers_mode, EXPECTED.community_annual.tiers_mode);
  check("interval", prices.community_annual.recurring?.interval, EXPECTED.community_annual.interval);
  check("usage_type", prices.community_annual.recurring?.usage_type, "licensed");
  if (prices.community_annual.tiers) {
    checkTiers("Tiers", prices.community_annual.tiers, EXPECTED.community_annual.tiers);
  } else {
    console.log("    ❌ No tiers found on community_annual price");
    allPassed = false;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (allPassed) {
    console.log("✅ ALL CHECKS PASSED — Pricing is correct!");
  } else {
    console.log("❌ SOME CHECKS FAILED — Review the output above.");
    process.exit(1);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});
