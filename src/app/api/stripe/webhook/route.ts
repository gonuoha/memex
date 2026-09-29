import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import {
  handleCheckoutCompleted,
  handleInvoiceEvent,
  handleSubscriptionDeleted,
  handleSubscriptionEvent,
} from "@/lib/stripe/webhook-handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const existingEvent = await prisma.stripeEvent.findUnique({
    where: { id: event.id },
    select: { id: true },
  });

  if (existingEvent) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
      case "invoice.paid":
        await handleInvoiceEvent(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handler failed:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  try {
    await prisma.stripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

  return NextResponse.json({ received: true });
}
