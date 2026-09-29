import { getAppUrl } from "@/lib/app-url";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { prisma } from "@/lib/prisma";

import { getStripe, getStripePriceId } from "./client";

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

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (existing?.stripeCustomerId) {
        return existing.stripeCustomerId;
      }
    }

    throw error;
  }

  return customer.id;
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
      stripeCustomerId: true,
      isPro: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
    },
  });

  const hasActiveSubscription =
    existingUser?.isPro &&
    existingUser.stripeSubscriptionId &&
    (existingUser.subscriptionStatus === "active" ||
      existingUser.subscriptionStatus === "trialing" ||
      existingUser.subscriptionStatus === "past_due");

  if (hasActiveSubscription) {
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
