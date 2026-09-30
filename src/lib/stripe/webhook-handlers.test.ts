import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mockRetrieveSubscription = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("./client", () => ({
  getStripe: () => ({
    subscriptions: { retrieve: mockRetrieveSubscription },
  }),
}));

import { prisma } from "@/lib/prisma";

import {
  handleCheckoutCompleted,
  handleInvoiceEvent,
  handleSubscriptionEvent,
} from "./webhook-handlers";

const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockUserFindFirst = vi.mocked(prisma.user.findFirst);
const mockUserUpdate = vi.mocked(prisma.user.update);

function createSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: "sub_123",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    customer: "cus_123",
    metadata: { userId: "user-1" },
    items: {
      data: [
        {
          current_period_end: 1_700_000_000,
          price: { id: "price_monthly" },
        } as Stripe.SubscriptionItem,
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function createInvoice(subscriptionId: string | null): Stripe.Invoice {
  return {
    customer: "cus_123",
    parent: subscriptionId
      ? {
          type: "subscription_details",
          subscription_details: { subscription: subscriptionId },
        }
      : null,
  } as unknown as Stripe.Invoice;
}

describe("stripe webhook handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      stripeSubscriptionId: null,
    } as never);
    mockUserFindFirst.mockResolvedValue(null);
    mockUserUpdate.mockResolvedValue({} as never);
    mockRetrieveSubscription.mockResolvedValue(createSubscription());
  });

  describe("handleCheckoutCompleted", () => {
    it("syncs the subscription retrieved from Stripe", async () => {
      await handleCheckoutCompleted({
        mode: "subscription",
        metadata: { userId: "user-1" },
        customer: "cus_123",
        subscription: "sub_123",
      } as unknown as Stripe.Checkout.Session);

      expect(mockRetrieveSubscription).toHaveBeenCalledWith("sub_123");
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({
          isPro: true,
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
        }),
      });
    });

    it("ignores non-subscription checkout sessions", async () => {
      await handleCheckoutCompleted({
        mode: "payment",
        subscription: null,
      } as unknown as Stripe.Checkout.Session);

      expect(mockRetrieveSubscription).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionEvent", () => {
    it.each(["active", "trialing", "past_due"] as const)(
      "sets isPro to true for %s status",
      async (status) => {
        mockRetrieveSubscription.mockResolvedValue(createSubscription({ status }));

        await handleSubscriptionEvent(createSubscription());

        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "user-1" },
          data: expect.objectContaining({
            isPro: true,
            subscriptionStatus: status,
            stripeSubscriptionId: "sub_123",
            stripePriceId: "price_monthly",
            currentPeriodEnd: new Date(1_700_000_000 * 1000),
          }),
        });
      },
    );

    it.each(["unpaid", "incomplete", "paused"] as const)(
      "keeps the subscription but revokes pro for %s status",
      async (status) => {
        mockRetrieveSubscription.mockResolvedValue(createSubscription({ status }));

        await handleSubscriptionEvent(createSubscription());

        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "user-1" },
          data: expect.objectContaining({
            isPro: false,
            subscriptionStatus: status,
            stripeSubscriptionId: "sub_123",
          }),
        });
      },
    );

    it("uses the latest Stripe state rather than the event payload", async () => {
      mockRetrieveSubscription.mockResolvedValue(
        createSubscription({ status: "canceled" }),
      );

      await handleSubscriptionEvent(createSubscription({ status: "active" }));

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({ isPro: false }),
      });
    });

    it("clears subscription fields when the subscription is canceled", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "user-1",
        stripeSubscriptionId: "sub_123",
      } as never);
      mockRetrieveSubscription.mockResolvedValue(
        createSubscription({ status: "canceled" }),
      );

      await handleSubscriptionEvent(createSubscription());

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          isPro: false,
          subscriptionStatus: "canceled",
          stripePriceId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: null,
          stripeCustomerId: "cus_123",
        },
      });
    });

    it("ignores stale events for a subscription the user has replaced", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "user-1",
        stripeSubscriptionId: "sub_new",
      } as never);
      mockRetrieveSubscription.mockResolvedValue(
        createSubscription({ id: "sub_old", status: "canceled" }),
      );

      await handleSubscriptionEvent(createSubscription({ id: "sub_old" }));

      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("flags scheduled cancellation set via cancel_at", async () => {
      mockRetrieveSubscription.mockResolvedValue(
        createSubscription({ cancel_at: 1_700_000_000 }),
      );

      await handleSubscriptionEvent(createSubscription());

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({ cancelAtPeriodEnd: true }),
      });
    });

    it("resolves the user by stripe customer id when metadata is missing", async () => {
      mockRetrieveSubscription.mockResolvedValue(
        createSubscription({ metadata: {} }),
      );
      mockUserFindFirst.mockResolvedValue({
        id: "user-2",
        stripeSubscriptionId: null,
      } as never);

      await handleSubscriptionEvent(createSubscription());

      expect(mockUserFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stripeCustomerId: "cus_123" } }),
      );
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: expect.objectContaining({ isPro: true }),
      });
    });
  });

  describe("handleInvoiceEvent", () => {
    it("does not grant pro when the first payment of an incomplete subscription fails", async () => {
      mockRetrieveSubscription.mockResolvedValue(
        createSubscription({ status: "incomplete" }),
      );

      await handleInvoiceEvent(createInvoice("sub_123"));

      expect(mockRetrieveSubscription).toHaveBeenCalledWith("sub_123");
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({
          isPro: false,
          subscriptionStatus: "incomplete",
        }),
      });
    });

    it("keeps pro access while a renewal is past_due", async () => {
      mockRetrieveSubscription.mockResolvedValue(
        createSubscription({ status: "past_due" }),
      );

      await handleInvoiceEvent(createInvoice("sub_123"));

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({
          isPro: true,
          subscriptionStatus: "past_due",
        }),
      });
    });

    it("ignores invoices that are not tied to a subscription", async () => {
      await handleInvoiceEvent(createInvoice(null));

      expect(mockRetrieveSubscription).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });
});
