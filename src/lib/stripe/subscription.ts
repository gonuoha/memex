import Stripe from "stripe";

import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";

import { getStripe, getStripePriceId } from "./client";
import {
  isTerminalSubscriptionStatus,
  subscriptionStatusGrantsPro,
} from "./subscription-status";

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await getStripe().customers.create(
    {
      email,
      metadata: { userId },
    },
    {
      idempotencyKey: `customer-create-${userId}`,
    },
  );

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

function isStripeResourceMissing(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "resource_missing"
  );
}

export async function cancelSubscriptionIfActive(
  subscriptionId: string,
): Promise<void> {
  const stripe = getStripe();
  let subscription: Stripe.Subscription;

  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if (isStripeResourceMissing(error)) {
      return;
    }

    throw error;
  }

  if (isTerminalSubscriptionStatus(subscription.status)) {
    return;
  }

  await stripe.subscriptions.cancel(subscriptionId);
}

export class ActiveSubscriptionError extends Error {
  constructor() {
    super("Active subscription already exists");
    this.name = "ActiveSubscriptionError";
  }
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  period: "monthly" | "yearly",
): Promise<string> {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      stripeSubscriptionId: true,
    },
  });

  if (
    existingUser?.stripeSubscriptionId &&
    subscriptionStatusGrantsPro(existingUser.subscriptionStatus)
  ) {
    throw new ActiveSubscriptionError();
  }

  const customerId = await getOrCreateStripeCustomer(userId, email);
  const appUrl = getAppUrl();

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: getStripePriceId(period), quantity: 1 }],
    success_url: `${appUrl}/settings?checkout=success`,
    cancel_url: `${appUrl}/upgrade?checkout=cancelled`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  return session.url;
}

export async function createPortalSession(
  stripeCustomerId: string,
): Promise<string> {
  const appUrl = getAppUrl();
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/settings`,
  });

  return session.url;
}
