import { readFileSync } from "fs";
import { resolve } from "path";
import Stripe from "stripe";
import { prisma } from "../src/lib/prisma";

function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Rely on process environment when .env.local is unavailable.
  }
}

function usage(): string {
  return `Usage:
  npx tsx scripts/backfill-roster-billing.ts --mode test|live [--apply] [--confirm-live]

Dry-run is the default. --apply is required to write billing dates to Prisma.
Live apply also requires --confirm-live.`;
}

function parseArgs(argv: string[]): { mode: "test" | "live"; apply: boolean; confirmLive: boolean } | null {
  if (argv.includes("--help")) {
    console.log(usage());
    return null;
  }
  const modeIndex = argv.indexOf("--mode");
  const mode = modeIndex >= 0 ? argv[modeIndex + 1] : undefined;
  if (mode !== "test" && mode !== "live") throw new Error("--mode must be test or live");
  const apply = argv.includes("--apply");
  const confirmLive = argv.includes("--confirm-live");
  if (mode === "live" && apply && !confirmLive) {
    throw new Error("Live apply requires --confirm-live");
  }
  return { mode, apply, confirmLive };
}

function getBillingDates(subscription: Stripe.Subscription): {
  stripeStatus: string;
  stripeCancelAt: Date | null;
  stripeCurrentPeriodEnd: Date | null;
} {
  const periodEndValue = subscription.items.data[0]?.current_period_end;
  const stripeCurrentPeriodEnd = periodEndValue ? new Date(periodEndValue * 1000) : null;
  const stripeCancelAt = subscription.cancel_at
    ? new Date(subscription.cancel_at * 1000)
    : subscription.cancel_at_period_end
      ? stripeCurrentPeriodEnd
      : null;
  return {
    stripeStatus: subscription.cancel_at_period_end || subscription.cancel_at
      ? "cancel_at_period_end"
      : subscription.status,
    stripeCancelAt,
    stripeCurrentPeriodEnd,
  };
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

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
    typescript: true,
  });

  const [users, organizations] = await Promise.all([
    prisma.user.findMany({
      where: { stripeSubscriptionId: { not: null }, organizationId: null, isComped: false },
      select: { id: true, stripeSubscriptionId: true },
    }),
    prisma.organization.findMany({
      where: { stripeSubscriptionId: { not: null } },
      select: { id: true, stripeSubscriptionId: true },
    }),
  ]);

  const rows = [
    ...users.map((user) => ({ kind: "user" as const, id: user.id, subscriptionId: user.stripeSubscriptionId! })),
    ...organizations.map((organization) => ({ kind: "organization" as const, id: organization.id, subscriptionId: organization.stripeSubscriptionId! })),
  ];
  const prepared: { row: (typeof rows)[number]; dates: ReturnType<typeof getBillingDates>; status: string }[] = [];
  const failures: string[] = [];

  // Preflight every Stripe subscription before any database write. This keeps
  // an invalid production record from causing a partial backfill.
  for (const row of rows) {
    try {
      const subscription = await stripe.subscriptions.retrieve(row.subscriptionId);
      prepared.push({ row, dates: getBillingDates(subscription), status: subscription.status });
    } catch (error) {
      failures.push(`${row.kind} ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`Mode: ${options.mode}`);
  console.log(`Action: ${options.apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Subscriptions inspected: ${rows.length}`);
  console.log(`Rows ready: ${prepared.length}`);
  console.log(`Rows skipped/failed: ${failures.length}`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    console.error("No database rows were written because preflight failed.");
    throw new Error("Roster billing backfill had failures");
  }

  if (!options.apply) {
    for (const { row, status } of prepared) {
      console.log(`WOULD UPDATE ${row.kind} ${row.id} from ${status}`);
    }
    return;
  }

  await prisma.$transaction(
    prepared.map(({ row, dates }) =>
      row.kind === "user"
        ? prisma.user.update({ where: { id: row.id }, data: dates })
        : prisma.organization.update({ where: { id: row.id }, data: dates })
    )
  );
  console.log(`Rows updated: ${prepared.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`\n${usage()}`);
  process.exitCode = 1;
});
