"use server";

import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";

export interface StripeBillingDetails {
  subscriptionId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  priceId: string | null;
  interval: string | null;
  amount: number | null;
  currency: string | null;
  quantity: number | null;
  customerEmail: string | null;
  customerName: string | null;
  latestInvoiceId: string | null;
  latestInvoiceStatus: string | null;
  latestInvoiceAmount: number | null;
  latestInvoicePaidAt: string | null;
  nextInvoiceAttempt: string | null;
}

export async function getStripeBillingDetails(
  subscriptionId: string
): Promise<{ data?: StripeBillingDetails; error?: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice", "customer"],
    });

    const item = subscription.items.data[0];
    const price = item?.price;
    const latestInvoice = subscription.latest_invoice as unknown as {
      id: string;
      status: string;
      amount_paid: number;
      currency: string;
      paid_at: number | null;
      next_payment_attempt: number | null;
    } | null;

    const customer = subscription.customer as unknown as {
      email: string | null;
      name: string | null;
    } | null;

    return {
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: item?.current_period_start
          ? new Date(item.current_period_start * 1000).toISOString()
          : null,
        currentPeriodEnd: item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null,
        trialStart: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
        priceId: price?.id ?? null,
        interval: price?.recurring?.interval ?? null,
        amount: price?.unit_amount ?? null,
        currency: price?.currency ?? null,
        quantity: item?.quantity ?? null,
        customerEmail: customer?.email ?? null,
        customerName: customer?.name ?? null,
        latestInvoiceId: latestInvoice?.id ?? null,
        latestInvoiceStatus: latestInvoice?.status ?? null,
        latestInvoiceAmount: latestInvoice?.amount_paid ?? null,
        latestInvoicePaidAt: latestInvoice?.paid_at
          ? new Date(latestInvoice.paid_at * 1000).toISOString()
          : null,
        nextInvoiceAttempt: latestInvoice?.next_payment_attempt
          ? new Date(latestInvoice.next_payment_attempt * 1000).toISOString()
          : null,
      },
    };
  } catch (error) {
    console.error("[BILLING] Failed to fetch subscription:", error);
    return { error: "Failed to load billing details from Stripe" };
  }
}
