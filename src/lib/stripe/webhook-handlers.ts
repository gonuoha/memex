import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";

import { getStripe } from "./client";
import {
  getSubscriptionCurrentPeriodEnd,
  getSubscriptionPriceId,
  isSubscriptionCancelScheduled,
  isTerminalSubscriptionStatus,
  subscriptionStatusGrantsPro,
} from "./subscription-status";

type BillingUser = {
  id: string;
  stripeSubscriptionId: string | null;
};

const billingUserSelect = { id: true, stripeSubscriptionId: true } as const;

function getStripeId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

async function resolveUser(
  metadataUserId: string | undefined,
  customerId: string | null,
): Promise<BillingUser | null> {
  if (metadataUserId) {
    const user = await prisma.user.findUnique({
      where: { id: metadataUserId },
      select: billingUserSelect,
    });

    if (user) {
      return user;
    }
  }

  if (!customerId) {
    return null;
  }

  return prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: billingUserSelect,
  });
}

function buildSubscriptionUpdate(subscription: Stripe.Subscription) {
  if (isTerminalSubscriptionStatus(subscription.status)) {
    return {
      isPro: false,
      subscriptionStatus: subscription.status,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
    };
  }

  return {
    isPro: subscriptionStatusGrantsPro(subscription.status),
    subscriptionStatus: subscription.status,
    stripePriceId: getSubscriptionPriceId(subscription),
    currentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
    cancelAtPeriodEnd: isSubscriptionCancelScheduled(subscription),
    stripeSubscriptionId: subscription.id,
  };
}

/**
 * Webhooks can arrive out of order or be retried, so billing state is always
 * re-read from Stripe instead of trusting the event payload. Events for a
 * subscription the user has since replaced are ignored unless it grants Pro.
 */
export async function syncSubscription(
  subscriptionId: string,
  fallbackUserId?: string,
): Promise<void> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const customerId = getStripeId(subscription.customer);
  const user = await resolveUser(
    subscription.metadata?.userId ?? fallbackUserId,
    customerId,
  );

  if (!user) {
    return;
  }

  const isCurrentSubscription =
    !user.stripeSubscriptionId || user.stripeSubscriptionId === subscription.id;

  if (!isCurrentSubscription && !subscriptionStatusGrantsPro(subscription.status)) {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...buildSubscriptionUpdate(subscription),
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  });
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const subscriptionId = getStripeId(session.subscription);

  if (session.mode !== "subscription" || !subscriptionId) {
    return;
  }

  await syncSubscription(subscriptionId, session.metadata?.userId);
}

export async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
): Promise<void> {
  await syncSubscription(subscription.id);
}

export async function handleInvoiceEvent(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = getStripeId(
    invoice.parent?.subscription_details?.subscription,
  );

  if (!subscriptionId) {
    return;
  }

  await syncSubscription(subscriptionId);
}
