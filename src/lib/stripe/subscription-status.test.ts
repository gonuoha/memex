import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import {
  getSubscriptionCurrentPeriodEnd,
  getSubscriptionPriceId,
  subscriptionStatusGrantsPro,
} from "./subscription-status";

function createSubscription(
  overrides: Partial<Stripe.Subscription>,
): Stripe.Subscription {
  return {
    items: {
      data: [
        {
          current_period_end: 1_700_000_000,
          price: { id: "price_monthly" },
        } as Stripe.SubscriptionItem,
      ],
    },
    cancel_at_period_end: false,
    status: "active",
    ...overrides,
  } as Stripe.Subscription;
}

describe("subscription-status", () => {
  it("grants pro for active, trialing, and past_due", () => {
    expect(subscriptionStatusGrantsPro("active")).toBe(true);
    expect(subscriptionStatusGrantsPro("trialing")).toBe(true);
    expect(subscriptionStatusGrantsPro("past_due")).toBe(true);
  });

  it("does not grant pro for canceled or unpaid statuses", () => {
    expect(subscriptionStatusGrantsPro("canceled")).toBe(false);
    expect(subscriptionStatusGrantsPro("unpaid")).toBe(false);
    expect(subscriptionStatusGrantsPro("incomplete")).toBe(false);
  });

  it("reads price id and period end from subscription items", () => {
    const subscription = createSubscription({});

    expect(getSubscriptionPriceId(subscription)).toBe("price_monthly");
    expect(getSubscriptionCurrentPeriodEnd(subscription)?.toISOString()).toBe(
      new Date(1_700_000_000 * 1000).toISOString(),
    );
  });
});
