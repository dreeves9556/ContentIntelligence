import {
  migrateSoloSubscriptions,
  type MigrationSubscription,
  type SoloPriceMigrationStripe,
} from "../solo-price-migration";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

function subscription(
  id: string,
  priceId: string,
  status: string,
  trialEnd: number | null = null,
  cancelAtPeriodEnd = false,
  cancelAt: number | null = null,
  canceledAt: number | null = null
): MigrationSubscription {
  return {
    id,
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    cancel_at: cancelAt,
    canceled_at: canceledAt,
    trial_end: trialEnd,
    items: {
      data: [{
        id: `${id}_item`,
        price: { id: priceId },
        current_period_start: 100,
        current_period_end: 200,
      }],
    },
  };
}

class FakeStripe implements SoloPriceMigrationStripe {
  private readonly rows: Map<string, MigrationSubscription>;
  readonly updateCalls: { id: string; price: string; proration: string; idempotencyKey: string }[] = [];

  constructor(rows: MigrationSubscription[]) {
    this.rows = new Map(rows.map((row) => [row.id, structuredClone(row)]));
  }

  subscriptions = {
    list: async (): Promise<{ data: MigrationSubscription[]; has_more: boolean }> => ({
      data: Array.from(this.rows.values()).map((row) => structuredClone(row)),
      has_more: false,
    }),
    update: async (
      id: string,
      params: { items: [{ id: string; price: string }]; proration_behavior: "none" },
      options: { idempotencyKey: string }
    ): Promise<MigrationSubscription> => {
      const row = this.rows.get(id);
      if (!row) throw new Error(`Missing subscription ${id}`);
      row.items.data[0].price.id = params.items[0].price;
      this.updateCalls.push({
        id,
        price: params.items[0].price,
        proration: params.proration_behavior,
        idempotencyKey: options.idempotencyKey,
      });
      return structuredClone(row);
    },
    retrieve: async (id: string): Promise<MigrationSubscription> => {
      const row = this.rows.get(id);
      if (!row) throw new Error(`Missing subscription ${id}`);
      return structuredClone(row);
    },
  };
}

const oldMonthly = "price_old_monthly";
const oldAnnual = "price_old_annual";
const newMonthly = "price_new_monthly";
const newAnnual = "price_new_annual";

async function run() {
  const dryRunStripe = new FakeStripe([
    subscription("sub_trial", oldMonthly, "trialing", 150),
    subscription("sub_annual", oldAnnual, "active"),
    subscription("sub_community", "price_community", "active"),
    subscription("sub_canceled", oldMonthly, "canceled"),
    subscription("sub_canceling", oldMonthly, "active", null, true),
    subscription("sub_explicit_cancel", oldMonthly, "active", null, false, 300),
  ]);
  const messages: string[] = [];
  const dryRun = await migrateSoloSubscriptions(dryRunStripe, {
    oldMonthlyPriceId: oldMonthly,
    oldAnnualPriceId: oldAnnual,
    newMonthlyPriceId: newMonthly,
    newAnnualPriceId: newAnnual,
    apply: false,
    onMessage: (message) => messages.push(message),
  });

  assert(dryRun.matched === 2, "dry run matches only old Solo prices");
  assert(dryRun.wouldUpdate === 2, "dry run reports both Solo updates");
  assert(dryRunStripe.updateCalls.length === 0, "dry run does not update Stripe");
  assert(messages.some((message) => message.startsWith("WOULD UPDATE sub_trial")), "dry run logs trial update");

  const applyStripe = new FakeStripe([
    subscription("sub_trial", oldMonthly, "trialing", 150),
    subscription("sub_annual", oldAnnual, "active"),
  ]);
  const applied = await migrateSoloSubscriptions(applyStripe, {
    oldMonthlyPriceId: oldMonthly,
    oldAnnualPriceId: oldAnnual,
    newMonthlyPriceId: newMonthly,
    newAnnualPriceId: newAnnual,
    apply: true,
  });

  assert(applied.updated === 2, "apply updates both Solo subscriptions");
  assert(applyStripe.updateCalls[0].proration === "none", "apply disables proration");
  assert(
    applyStripe.updateCalls[0].idempotencyKey === `solo-price-migration:sub_trial:${newMonthly}`,
    "apply uses a stable subscription idempotency key"
  );
  assert(
    (await applyStripe.subscriptions.retrieve("sub_trial")).trial_end === 150,
    "apply preserves the active trial end"
  );

  const rerun = await migrateSoloSubscriptions(applyStripe, {
    oldMonthlyPriceId: oldMonthly,
    oldAnnualPriceId: oldAnnual,
    newMonthlyPriceId: newMonthly,
    newAnnualPriceId: newAnnual,
    apply: true,
  });
  assert(rerun.matched === 0, "rerun skips already-migrated subscriptions");
}

run().then(() => {
  if (failures > 0) process.exitCode = 1;
});
