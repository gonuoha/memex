import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockSubscriptionRetrieve = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({
  getStripe: () => ({
    subscriptions: { retrieve: mockSubscriptionRetrieve },
  }),
}));

import { prisma } from "@/lib/prisma";

import {
  handleCheckoutCompleted,
  handleInvoiceEvent,
  handleSubscriptionDeleted,
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

describe("stripe webhook handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ id: "user-1" } as never);
    mockUserFindFirst.mockResolvedValue(null);
    mockUserUpdate.mockResolvedValue({} as never);
  });

  describe("handleCheckoutCompleted", () => {
    it("stores Stripe IDs for the resolved user", async () => {
      await handleCheckoutCompleted({
        metadata: { userId: "user-1" },
        customer: "cus_123",
        subscription: "sub_123",
      } as unknown as Stripe.Checkout.Session);

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
        },
      });
    });
  });

  describe("handleSubscriptionEvent", () => {
    it.each(["active", "trialing", "past_due"] as const)(
      "sets isPro to true for %s status",
      async (status) => {
        await handleSubscriptionEvent(
          createSubscription({ status }),
        );

        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "user-1" },
          data: expect.objectContaining({
            isPro: true,
            subscriptionStatus: status,
            stripeSubscriptionId: "sub_123",
            stripePriceId: "price_monthly",
          }),
        });
      },
    );

    it.each(["canceled", "unpaid"] as const)(
      "sets isPro to false for %s status",
      async (status) => {
        await handleSubscriptionEvent(
          createSubscription({ status }),
        );

        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "user-1" },
          data: expect.objectContaining({
            isPro: false,
            subscriptionStatus: status,
          }),
        });
      },
    );

    it("resolves the user by stripe customer id when metadata is missing", async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue({ id: "user-2" } as never);

      await handleSubscriptionEvent(
        createSubscription({ metadata: {} }),
      );

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: expect.objectContaining({ isPro: true }),
      });
    });
  });

  describe("handleSubscriptionDeleted", () => {
    it("revokes pro access and clears subscription fields", async () => {
      await handleSubscriptionDeleted(createSubscription({ status: "canceled" }));

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          isPro: false,
          subscriptionStatus: "canceled",
          stripePriceId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: null,
        },
      });
    });

    it("ignores deletion of a subscription the user no longer tracks", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "user-1",
        stripeSubscriptionId: "sub_new",
      } as never);

      await handleSubscriptionDeleted(createSubscription({ status: "canceled" }));

      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe("handleInvoiceEvent", () => {
    function createInvoice(): Stripe.Invoice {
      return {
        customer: "cus_123",
        parent: {
          type: "subscription_details",
          subscription_details: { subscription: "sub_123" },
        },
      } as unknown as Stripe.Invoice;
    }

    it("syncs billing from the retrieved subscription", async () => {
      mockSubscriptionRetrieve.mockResolvedValue(
        createSubscription({ status: "past_due" }) as never,
      );

      await handleInvoiceEvent(createInvoice());

      expect(mockSubscriptionRetrieve).toHaveBeenCalledWith("sub_123");
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({
          isPro: true,
          subscriptionStatus: "past_due",
        }),
      });
    });

    it("does not grant pro when the first payment fails", async () => {
      mockSubscriptionRetrieve.mockResolvedValue(
        createSubscription({ status: "incomplete" }) as never,
      );

      await handleInvoiceEvent(createInvoice());

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({
          isPro: false,
          subscriptionStatus: "incomplete",
        }),
      });
    });

    it("ignores invoices without a subscription", async () => {
      await handleInvoiceEvent({ customer: "cus_123", parent: null } as unknown as Stripe.Invoice);

      expect(mockSubscriptionRetrieve).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });
});
