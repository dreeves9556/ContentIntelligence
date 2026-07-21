/**
 * Stripe Catalog Setup Script
 *
 * Creates Products and Prices for The Local Post in Stripe.
 * Safe to run multiple times — skips existing products/prices by lookup key.
 *
 * Usage:
 *   npm run stripe:setup-catalog
 *
 * Requires:
 *   STRIPE_SECRET_KEY in .env.local (use sk_test_... for test mode)
 *
 * Creates:
 *   Product: "The Local Post — Solo"
 *     - Price tlp_solo_monthly  ($200/month, flat)
 *     - Price tlp_solo_annual   ($1,999/year, flat)
 *   Product: "The Local Post — Communities"
 *     - Price tlp_community_monthly (graduated seat pricing, monthly)
 *     - Price tlp_community_annual  (graduated seat pricing, yearly)
 *
 * Output:
 *   Prints price IDs to console and writes them to .env.stripe.generated
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import Stripe from "stripe";

// ─── Env loading ───────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
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
    // .env.local not found — rely on existing env
  }
}

loadEnv();

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("❌ STRIPE_SECRET_KEY is not set. Add it to .env.local and try again.");
  process.exit(1);
}

const isTestMode = secretKey.startsWith("sk_test_");
console.log(`\n🔑 Stripe mode: ${isTestMode ? "TEST" : "LIVE"}\n`);
if (!isTestMode) {
  console.warn("⚠️  WARNING: You are using LIVE keys. This will create real Stripe products.\n");
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
  typescript: true,
});

// ─── Pricing constants ─────────────────────────────────────────────────────

const SOLO_MONTHLY_CENTS = 20000; // $200.00
const SOLO_ANNUAL_CENTS = 199900; // $1,999.00

const COMMUNITY_TIERS_MONTHLY = [
  { up_to: 1, unit_amount: 20000 }, // Seat 1: $200
  { up_to: 4, unit_amount: 15000 }, // Seats 2–4: $150 each
  { up_to: 9, unit_amount: 13000 }, // Seats 5–9: $130 each
  { up_to: "inf" as const, unit_amount: 11000 }, // Seats 10+: $110 each
];

const COMMUNITY_TIERS_ANNUAL = [
  { up_to: 1, unit_amount: 200000 }, // Seat 1: $2,000
  { up_to: 4, unit_amount: 150000 }, // Seats 2–4: $1,500 each
  { up_to: 9, unit_amount: 130000 }, // Seats 5–9: $1,300 each
  { up_to: "inf" as const, unit_amount: 110000 }, // Seats 10+: $1,100 each
];

// ─── Helpers ───────────────────────────────────────────────────────────────

async function findProductByName(name: string): Promise<Stripe.Product | null> {
  const products = await stripe.products.list({ limit: 100, active: true });
  return products.data.find((p) => p.name === name) ?? null;
}

async function findPriceByLookupKey(lookupKey: string): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  return prices.data[0] ?? null;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== The Local Post — Stripe Catalog Setup ===\n");

  // ── Product 1: Solo ──────────────────────────────────────────────────────
  let soloProduct = await findProductByName("The Local Post — Solo");
  if (soloProduct) {
    console.log(`✅ Product "The Local Post — Solo" already exists: ${soloProduct.id}`);
  } else {
    soloProduct = await stripe.products.create({
      name: "The Local Post — Solo",
      description: "The Local Post Solo plan — single creator, monthly or annual billing.",
      metadata: { app: "the_local_post", plan: "solo" },
    });
    console.log(`🆕 Created product "The Local Post — Solo": ${soloProduct.id}`);
  }

  // ── Price: Solo Monthly ──────────────────────────────────────────────────
  let soloMonthly = await findPriceByLookupKey("tlp_solo_monthly");
  if (soloMonthly) {
    console.log(`✅ Price tlp_solo_monthly already exists: ${soloMonthly.id}`);
  } else {
    soloMonthly = await stripe.prices.create({
      product: soloProduct.id,
      currency: "usd",
      unit_amount: SOLO_MONTHLY_CENTS,
      recurring: { interval: "month", usage_type: "licensed" },
      lookup_key: "tlp_solo_monthly",
      metadata: { app: "the_local_post", plan: "solo", billing: "monthly" },
    });
    console.log(`🆕 Created price tlp_solo_monthly ($200/month): ${soloMonthly.id}`);
  }

  // ── Price: Solo Annual ───────────────────────────────────────────────────
  let soloAnnual = await findPriceByLookupKey("tlp_solo_annual");
  if (soloAnnual) {
    console.log(`✅ Price tlp_solo_annual already exists: ${soloAnnual.id}`);
  } else {
    soloAnnual = await stripe.prices.create({
      product: soloProduct.id,
      currency: "usd",
      unit_amount: SOLO_ANNUAL_CENTS,
      recurring: { interval: "year", usage_type: "licensed" },
      lookup_key: "tlp_solo_annual",
      metadata: { app: "the_local_post", plan: "solo", billing: "annual" },
    });
    console.log(`🆕 Created price tlp_solo_annual ($1,999/year): ${soloAnnual.id}`);
  }

  // ── Product 2: Communities ───────────────────────────────────────────────
  let communityProduct = await findProductByName("The Local Post — Communities");
  if (communityProduct) {
    console.log(`✅ Product "The Local Post — Communities" already exists: ${communityProduct.id}`);
  } else {
    communityProduct = await stripe.products.create({
      name: "The Local Post — Communities",
      description: "The Local Post Communities plan — seat-based graduated pricing for teams and organizations.",
      metadata: { app: "the_local_post", plan: "communities" },
    });
    console.log(`🆕 Created product "The Local Post — Communities": ${communityProduct.id}`);
  }

  // ── Price: Community Monthly (graduated) ─────────────────────────────────
  let communityMonthly = await findPriceByLookupKey("tlp_community_monthly");
  if (communityMonthly) {
    console.log(`✅ Price tlp_community_monthly already exists: ${communityMonthly.id}`);
  } else {
    communityMonthly = await stripe.prices.create({
      product: communityProduct.id,
      currency: "usd",
      billing_scheme: "tiered",
      tiers_mode: "graduated",
      recurring: { interval: "month", usage_type: "licensed" },
      tiers: COMMUNITY_TIERS_MONTHLY,
      lookup_key: "tlp_community_monthly",
      metadata: { app: "the_local_post", plan: "communities", billing: "monthly" },
    });
    console.log(`🆕 Created price tlp_community_monthly (graduated, monthly): ${communityMonthly.id}`);
  }

  // ── Price: Community Annual (graduated) ──────────────────────────────────
  let communityAnnual = await findPriceByLookupKey("tlp_community_annual");
  if (communityAnnual) {
    console.log(`✅ Price tlp_community_annual already exists: ${communityAnnual.id}`);
  } else {
    communityAnnual = await stripe.prices.create({
      product: communityProduct.id,
      currency: "usd",
      billing_scheme: "tiered",
      tiers_mode: "graduated",
      recurring: { interval: "year", usage_type: "licensed" },
      tiers: COMMUNITY_TIERS_ANNUAL,
      lookup_key: "tlp_community_annual",
      metadata: { app: "the_local_post", plan: "communities", billing: "annual" },
    });
    console.log(`🆕 Created price tlp_community_annual (graduated, yearly): ${communityAnnual.id}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const priceIds = {
    STRIPE_SOLO_MONTHLY_PRICE_ID: soloMonthly.id,
    STRIPE_SOLO_ANNUAL_PRICE_ID: soloAnnual.id,
    STRIPE_COMMUNITY_MONTHLY_PRICE_ID: communityMonthly.id,
    STRIPE_COMMUNITY_ANNUAL_PRICE_ID: communityAnnual.id,
  };

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 PRICE IDs — Copy these into .env.local:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  for (const [envVar, id] of Object.entries(priceIds)) {
    console.log(`  ${envVar}=${id}`);
  }

  // ── Write .env.stripe.generated ──────────────────────────────────────────
  const envContent = [
    "# Auto-generated by scripts/setup-stripe-catalog.ts",
    `# Generated: ${new Date().toISOString()}`,
    `# Mode: ${isTestMode ? "TEST" : "LIVE"}`,
    "",
    `STRIPE_SOLO_MONTHLY_PRICE_ID=${soloMonthly.id}`,
    `STRIPE_SOLO_ANNUAL_PRICE_ID=${soloAnnual.id}`,
    `STRIPE_COMMUNITY_MONTHLY_PRICE_ID=${communityMonthly.id}`,
    `STRIPE_COMMUNITY_ANNUAL_PRICE_ID=${communityAnnual.id}`,
    "",
  ].join("\n");

  writeFileSync(resolve(process.cwd(), ".env.stripe.generated"), envContent, "utf-8");
  console.log("\n📄 Written to .env.stripe.generated (gitignored — safe)");
  console.log("\n➡️  Paste the price IDs above into your .env.local file.");
  console.log("   Then run: npm run stripe:verify-pricing\n");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err);
  process.exit(1);
});
