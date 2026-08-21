export type SoloBillingInterval = "monthly" | "annual";

export interface MigrationSubscriptionItem {
  id: string;
  price: { id: string };
  current_period_start: number;
  current_period_end: number;
}

export interface MigrationSubscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  canceled_at: number | null;
  trial_end: number | null;
  items: { data: MigrationSubscriptionItem[] };
}

export interface MigrationSubscriptionPage {
  data: MigrationSubscription[];
  has_more: boolean;
}

export interface SoloPriceMigrationStripe {
  subscriptions: {
    list(params: {
      status: "all";
      limit: number;
      starting_after?: string;
    }): Promise<MigrationSubscriptionPage>;
    update(
      id: string,
      params: {
        items: [{ id: string; price: string }];
        proration_behavior: "none";
      },
      options: { idempotencyKey: string }
    ): Promise<MigrationSubscription>;
    retrieve(id: string): Promise<MigrationSubscription>;
  };
}

export interface SoloPriceMigrationConfig {
  oldMonthlyPriceId: string;
  oldAnnualPriceId: string;
  newMonthlyPriceId: string;
  newAnnualPriceId: string;
  apply: boolean;
  onMessage?: (message: string) => void;
}

export interface SoloPriceMigrationFailure {
  subscriptionId: string;
  error: string;
}

export interface SoloPriceMigrationResult {
  inspected: number;
  matched: number;
  wouldUpdate: number;
  updated: number;
  skipped: number;
  failures: SoloPriceMigrationFailure[];
}

const MIGRATABLE_STATUSES = new Set(["active", "trialing", "past_due"]);

function getIntervalForPrice(
  priceId: string,
  config: SoloPriceMigrationConfig
): SoloBillingInterval | null {
  if (priceId === config.oldMonthlyPriceId) return "monthly";
  if (priceId === config.oldAnnualPriceId) return "annual";
  return null;
}

function getTargetPriceId(
  interval: SoloBillingInterval,
  config: SoloPriceMigrationConfig
): string {
  return interval === "monthly"
    ? config.newMonthlyPriceId
    : config.newAnnualPriceId;
}

function verifyPostcondition(
  subscription: MigrationSubscription,
  itemId: string,
  targetPriceId: string,
  original: MigrationSubscription
): string | null {
  const item = subscription.items.data.find((candidate) => candidate.id === itemId);
  if (!item || item.price.id !== targetPriceId) {
    return `subscription item ${itemId} does not have target price ${targetPriceId}`;
  }
  if (subscription.trial_end !== original.trial_end) {
    return "trial_end changed during price migration";
  }
  if (
    subscription.cancel_at_period_end !== original.cancel_at_period_end ||
    subscription.cancel_at !== original.cancel_at ||
    subscription.canceled_at !== original.canceled_at
  ) {
    return "cancellation state changed during price migration";
  }
  const originalItem = original.items.data.find((candidate) => candidate.id === itemId);
  if (
    !originalItem ||
    item.current_period_start !== originalItem.current_period_start ||
    item.current_period_end !== originalItem.current_period_end
  ) {
    return "billing period changed during price migration";
  }
  return null;
}

export async function migrateSoloSubscriptions(
  stripe: SoloPriceMigrationStripe,
  config: SoloPriceMigrationConfig
): Promise<SoloPriceMigrationResult> {
  const result: SoloPriceMigrationResult = {
    inspected: 0,
    matched: 0,
    wouldUpdate: 0,
    updated: 0,
    skipped: 0,
    failures: [],
  };
  const log = config.onMessage ?? (() => undefined);
  let startingAfter: string | undefined;

  do {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const subscription of page.data) {
      result.inspected++;

      if (!MIGRATABLE_STATUSES.has(subscription.status)) {
        result.skipped++;
        continue;
      }
      if (subscription.cancel_at_period_end || subscription.cancel_at !== null) {
        result.skipped++;
        log(`SKIP ${subscription.id}: cancellation already scheduled`);
        continue;
      }
      if (subscription.items.data.length !== 1) {
        result.skipped++;
        log(`SKIP ${subscription.id}: expected one Solo subscription item`);
        continue;
      }

      const item = subscription.items.data[0];
      const interval = getIntervalForPrice(item.price.id, config);
      if (!interval) {
        result.skipped++;
        continue;
      }

      result.matched++;
      const targetPriceId = getTargetPriceId(interval, config);
      const message = `${subscription.id}: ${interval} ${item.price.id} → ${targetPriceId}`;

      if (!config.apply) {
        result.wouldUpdate++;
        log(`WOULD UPDATE ${message}`);
        continue;
      }

      const idempotencyKey = `solo-price-migration:${subscription.id}:${targetPriceId}`;
      try {
        await stripe.subscriptions.update(
          subscription.id,
          {
            items: [{ id: item.id, price: targetPriceId }],
            proration_behavior: "none",
          },
          { idempotencyKey }
        );
      } catch (error) {
        try {
          const refreshed = await stripe.subscriptions.retrieve(subscription.id);
          const verificationError = verifyPostcondition(
            refreshed,
            item.id,
            targetPriceId,
            subscription
          );
          if (!verificationError) {
            result.updated++;
            log(`UPDATED ${message} (postcondition verified after request error)`);
            continue;
          }
        } catch {
          // Preserve the original error below; the subscription can be retried safely.
        }

        result.failures.push({
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : String(error),
        });
        log(`FAILED ${subscription.id}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      try {
        const refreshed = await stripe.subscriptions.retrieve(subscription.id);
        const verificationError = verifyPostcondition(
          refreshed,
          item.id,
          targetPriceId,
          subscription
        );
        if (verificationError) {
          result.failures.push({
            subscriptionId: subscription.id,
            error: verificationError,
          });
          log(`FAILED ${subscription.id}: ${verificationError}`);
          continue;
        }
        result.updated++;
        log(`UPDATED ${message}`);
      } catch (error) {
        result.failures.push({
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : String(error),
        });
        log(`FAILED ${subscription.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    startingAfter = page.has_more && page.data.length > 0
      ? page.data[page.data.length - 1].id
      : undefined;
  } while (startingAfter);

  return result;
}
