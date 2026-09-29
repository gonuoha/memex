import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";

import { getStripe } from "./client";
import {
  getSubscriptionCurrentPeriodEnd,
  getSubscriptionPriceId,
  subscriptionStatusGrantsPro,
} from "./subscription-status";

type UserBillingUpdate = {
  isPro: boolean;
  subscriptionStatus: string;
  stripePriceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
};

type BillingUser = {
  id: string;
  stripeSubscriptionId: string | null;
};

const billingUserSelect = { id: true, stripeSubscriptionId: true } as const;

function getStripeId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function getSubscriptionId(
  value: string | Stripe.Subscription | null | undefined,
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

/** A user's tracked subscription must not be overwritten by events for an older one. */
function isOtherSubscription(user: BillingUser, subscriptionId: string): boolean {
  return Boolean(
    user.stripeSubscriptionId && user.stripeSubscriptionId !== subscriptionId,
  );
}

function buildSubscriptionUpdate(
  subscription: Stripe.Subscription,
  customerId: string | null,
): UserBillingUpdate {
  return {
    isPro: subscriptionStatusGrantsPro(subscription.status),
    subscriptionStatus: subscription.status,
    stripePriceId: getSubscriptionPriceId(subscription),
    currentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: subscription.id,
  };
}

async function updateUserBilling(
  userId: string,
  data: UserBillingUpdate,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data,
  });
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const customerId = getStripeId(session.customer);
  const subscriptionId = getSubscriptionId(session.subscription);
  const user = await resolveUser(session.metadata?.userId, customerId);

  if (!user || !customerId || !subscriptionId) {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
  });
}

export async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = getStripeId(subscription.customer);
  const user = await resolveUser(subscription.metadata?.userId, customerId);

  if (!user) {
    return;
  }

  if (
    isOtherSubscription(user, subscription.id) &&
    !subscriptionStatusGrantsPro(subscription.status)
  ) {
    return;
  }

  await updateUserBilling(user.id, buildSubscriptionUpdate(subscription, customerId));
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = getStripeId(subscription.customer);
  const user = await resolveUser(subscription.metadata?.userId, customerId);

  if (!user || isOtherSubscription(user, subscription.id)) {
    return;
  }

  await updateUserBilling(user.id, {
    isPro: false,
    subscriptionStatus: subscription.status,
    stripePriceId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: null,
  });
}

/**
 * Invoice events carry no reliable subscription state (e.g. a failed first
 * payment leaves the subscription `incomplete`), so re-sync from Stripe.
 */
export async function handleInvoiceEvent(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = getSubscriptionId(
    invoice.parent?.subscription_details?.subscription,
  );

  if (!subscriptionId) {
    return;
  }

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);

  await handleSubscriptionEvent(subscription);
}
