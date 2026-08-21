import { readFileSync } from "fs";
import { resolve } from "path";
import Stripe from "stripe";
import {
  migrateSoloSubscriptions,
  type SoloPriceMigrationConfig,
} from "../src/lib/solo-price-migration";

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
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Rely on the process environment when .env.local is unavailable.
  }
}

interface Options {
  mode: "test" | "live";
  oldMonthlyPriceId: string;
  oldAnnualPriceId: string;
  newMonthlyPriceId: string;
  newAnnualPriceId: string;
  apply: boolean;
  confirmLive: boolean;
}

function usage(): string {
  return `Usage:
  npx tsx scripts/migrate-solo-pricing.ts \\
    --mode test|live \\
    --old-monthly price_... \\
    --old-annual price_... \\
    --new-monthly price_... \\
    --new-annual price_... \\
    [--apply] [--confirm-live]

Dry-run is the default. --apply is required to change subscriptions.
Live apply also requires --confirm-live.`;
}

function parseArgs(argv: string[]): Options | null {
  if (argv.includes("--help")) {
    console.log(usage());
    return null;
  }

  const values = new Map<string, string>();
  let apply = false;
  let confirmLive = false;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--confirm-live") {
      confirmLive = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const name = arg.slice(2);
    if (!["mode", "old-monthly", "old-annual", "new-monthly", "new-annual"].includes(name)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    values.set(arg.slice(2), value);
    index++;
  }

  const mode = values.get("mode");
  if (mode !== "test" && mode !== "live") {
    throw new Error("--mode must be test or live");
  }

  const required = ["old-monthly", "old-annual", "new-monthly", "new-annual"] as const;
  for (const name of required) {
    if (!values.get(name)) throw new Error(`Missing --${name}`);
  }

  if (mode === "live" && apply && !confirmLive) {
    throw new Error("Live apply requires --confirm-live");
  }

  return {
    mode,
    oldMonthlyPriceId: values.get("old-monthly")!,
    oldAnnualPriceId: values.get("old-annual")!,
    newMonthlyPriceId: values.get("new-monthly")!,
    newAnnualPriceId: values.get("new-annual")!,
    apply,
    confirmLive,
  };
}

function assertPriceId(name: string, value: string) {
  if (!value.startsWith("price_")) {
    throw new Error(`${name} must start with price_`);
  }
}

function getProductId(price: Stripe.Price): string | null {
  if (typeof price.product === "string") return price.product;
  return price.product?.id ?? null;
}

async function validatePrice(
  stripe: Stripe,
  id: string,
  expectedInterval: "month" | "year",
  expectedAmount: number,
  label: string,
  requireActive: boolean
): Promise<Stripe.Price> {
  const price = await stripe.prices.retrieve(id, { expand: ["product"] });
  if (price.currency !== "usd") {
    throw new Error(`${label} must use USD`);
  }
  if (price.unit_amount !== expectedAmount) {
    throw new Error(`${label} must be ${expectedAmount} cents`);
  }
  if (price.recurring?.interval !== expectedInterval) {
    throw new Error(`${label} must recur ${expectedInterval}`);
  }
  if (requireActive && !price.active) {
    throw new Error(`${label} must be active`);
  }
  return price;
}

async function main() {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");

  const actualMode = secretKey.startsWith("sk_test_")
    ? "test"
    : secretKey.startsWith("sk_live_")
      ? "live"
      : "unknown";
  if (actualMode !== options.mode) {
    throw new Error(`Stripe key mode is ${actualMode}; expected ${options.mode}`);
  }

  for (const [name, value] of Object.entries({
    oldMonthlyPriceId: options.oldMonthlyPriceId,
    oldAnnualPriceId: options.oldAnnualPriceId,
    newMonthlyPriceId: options.newMonthlyPriceId,
    newAnnualPriceId: options.newAnnualPriceId,
  })) {
    assertPriceId(name, value);
  }
  if (
    options.oldMonthlyPriceId === options.newMonthlyPriceId ||
    options.oldAnnualPriceId === options.newAnnualPriceId
  ) {
    throw new Error("Old and new price IDs must differ");
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
    typescript: true,
  });

  const oldMonthly = await validatePrice(
    stripe,
    options.oldMonthlyPriceId,
    "month",
    20000,
    "old monthly price",
    false
  );
  const oldAnnual = await validatePrice(
    stripe,
    options.oldAnnualPriceId,
    "year",
    199900,
    "old annual price",
    false
  );
  const newMonthly = await validatePrice(
    stripe,
    options.newMonthlyPriceId,
    "month",
    10000,
    "new monthly price",
    true
  );
  const newAnnual = await validatePrice(
    stripe,
    options.newAnnualPriceId,
    "year",
    100000,
    "new annual price",
    true
  );

  const oldProductId = getProductId(oldMonthly);
  const oldAnnualProductId = getProductId(oldAnnual);
  const newProductId = getProductId(newMonthly);
  const newAnnualProductId = getProductId(newAnnual);
  if (
    !oldProductId ||
    oldProductId !== oldAnnualProductId ||
    oldProductId !== newProductId ||
    oldProductId !== newAnnualProductId
  ) {
    throw new Error("All Solo migration prices must belong to the same Stripe product");
  }

  const config: SoloPriceMigrationConfig = {
    oldMonthlyPriceId: options.oldMonthlyPriceId,
    oldAnnualPriceId: options.oldAnnualPriceId,
    newMonthlyPriceId: options.newMonthlyPriceId,
    newAnnualPriceId: options.newAnnualPriceId,
    apply: options.apply,
    onMessage: (message) => console.log(message),
  };

  console.log(`Stripe mode: ${options.mode.toUpperCase()}`);
  console.log(`Action: ${options.apply ? "APPLY" : "DRY RUN"}`);
  console.log("Communities prices are not selected by this migration.");

  const result = await migrateSoloSubscriptions(stripe, config);
  console.log("\nSummary:");
  console.log(`  Inspected: ${result.inspected}`);
  console.log(`  Matched old Solo prices: ${result.matched}`);
  console.log(`  Would update: ${result.wouldUpdate}`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Failures: ${result.failures.length}`);

  if (result.failures.length > 0) {
    throw new Error("One or more Solo subscriptions failed verification");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`\n${usage()}`);
  process.exitCode = 1;
});
