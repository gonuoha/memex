import type Stripe from "stripe";

const PRO_STATUSES = new Set<string>(["active", "trialing", "past_due"]);
const TERMINAL_STATUSES = new Set<string>(["canceled", "incomplete_expired"]);

export function subscriptionStatusGrantsPro(status: string | null): boolean {
  return status !== null && PRO_STATUSES.has(status);
}

export function isTerminalSubscriptionStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function getSubscriptionPriceId(
  subscription: Stripe.Subscription,
): string | null {
  const firstItem = subscription.items.data[0];

  if (!firstItem?.price?.id) {
    return null;
  }

  return firstItem.price.id;
}

export function getSubscriptionCurrentPeriodEnd(
  subscription: Stripe.Subscription,
): Date | null {
  const timestamps = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  if (timestamps.length === 0) {
    return null;
  }

  const maxTimestamp = Math.max(...timestamps);

  return new Date(maxTimestamp * 1000);
}

/** The Billing Portal may schedule cancellation via `cancel_at` instead of `cancel_at_period_end`. */
export function isSubscriptionCancelScheduled(
  subscription: Stripe.Subscription,
): boolean {
  return subscription.cancel_at_period_end || subscription.cancel_at !== null;
}
