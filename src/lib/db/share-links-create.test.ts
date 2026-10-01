import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findFirst: vi.fn() },
    shareLink: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/lib/db/advisory-lock", () => ({
  takeUserAdvisoryLock: vi.fn(),
}));

import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { prisma } from "@/lib/prisma";

import {
  createShareLinkForItem,
  revokeShareLinkForItem,
  ShareLinkLimitExceededError,
} from "./share-links";

const mockFindFirst = vi.mocked(prisma.item.findFirst);
const mockTakeLock = vi.mocked(takeUserAdvisoryLock);

describe("createShareLinkForItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ id: "item-1" } as never);
    mockUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("returns existing active link without regenerating", async () => {
    const existing = {
      id: "link-1",
      token: "token",
      itemId: "item-1",
      createdAt: new Date(),
      expiresAt: null,
      revokedAt: null,
      viewCount: 0,
      lastViewedAt: null,
    };

    mockTransaction.mockImplementation(async (callback) =>
      callback({
        shareLink: {
          findFirst: vi.fn().mockResolvedValue(existing),
          updateMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
        },
      }),
    );

    const result = await createShareLinkForItem("user-1", "item-1", {
      expiresInDays: 7,
      regenerate: false,
      isPro: true,
    });

    expect(result.token).toBe("token");
    expect(mockTakeLock).toHaveBeenCalled();
  });

  it("throws when free tier cap is reached", async () => {
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        shareLink: {
          findFirst: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          count: vi.fn().mockResolvedValue(10),
          create: vi.fn(),
        },
      }),
    );

    await expect(
      createShareLinkForItem("user-1", "item-1", {
        expiresInDays: null,
        regenerate: false,
        isPro: false,
      }),
    ).rejects.toBeInstanceOf(ShareLinkLimitExceededError);
  });
});

describe("revokeShareLinkForItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses updateMany", async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });

    const revoked = await revokeShareLinkForItem("user-1", "item-1");

    expect(revoked).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalled();
  });
});
