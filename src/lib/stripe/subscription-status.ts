import type Stripe from "stripe";

const PRO_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

export function subscriptionStatusGrantsPro(
  status: Stripe.Subscription.Status,
): boolean {
  return PRO_STATUSES.has(status);
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
