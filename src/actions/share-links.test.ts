import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockAuth, mockUnauthenticated } from "./__tests__/mock-auth";

vi.mock("@/lib/db/items", () => ({
  getItemById: vi.fn(),
}));

vi.mock("@/lib/db/share-links", () => ({
  createShareLinkForItem: vi.fn(),
  getActiveShareLinkForItem: vi.fn(),
  revokeShareLinkForItem: vi.fn(),
  ShareLinkLimitExceededError: class ShareLinkLimitExceededError extends Error {
    constructor() {
      super("limit");
      this.name = "ShareLinkLimitExceededError";
    }
  },
  updateShareLinkExpiryForItem: vi.fn(),
}));

vi.mock("@/lib/db/user", () => ({
  getUserIsPro: vi.fn(),
}));

vi.mock("@/lib/rate-limit-user-action", () => ({
  checkShareLinkCreateRateLimit: vi.fn(),
}));

import { getItemById } from "@/lib/db/items";
import {
  createShareLinkForItem,
  getActiveShareLinkForItem,
  ShareLinkLimitExceededError,
} from "@/lib/db/share-links";
import { getUserIsPro } from "@/lib/db/user";
import { checkShareLinkCreateRateLimit } from "@/lib/rate-limit-user-action";

import { createShareLink, getShareLinkForItem } from "./share-links";

const mockGetItemById = vi.mocked(getItemById);
const mockCreateShareLink = vi.mocked(createShareLinkForItem);
const mockGetActive = vi.mocked(getActiveShareLinkForItem);
const mockGetUserIsPro = vi.mocked(getUserIsPro);
const mockRateLimit = vi.mocked(checkShareLinkCreateRateLimit);

const sampleItem = {
  id: "item-1",
  type: {
    name: "snippet",
    id: "t1",
    icon: null,
    color: null,
    isSystem: true,
    kind: "code",
  },
  title: "T",
  description: null,
  content: "x",
  url: null,
  language: null,
  fileUrl: null,
  fileName: null,
  fileSize: null,
  isFavorite: false,
  isPinned: false,
  contentType: "text",
  tags: [],
  collections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("createShareLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetUserIsPro.mockResolvedValue(false);
    mockRateLimit.mockResolvedValue({ success: true, remaining: 1, reset: 0 });
    mockGetItemById.mockResolvedValue(sampleItem);
  });

  it("requires authentication", async () => {
    mockUnauthenticated();
    const result = await createShareLink("item-1", { expiresInDays: 7 });
    expect(result.success).toBe(false);
  });

  it("rejects non-shareable types", async () => {
    mockGetItemById.mockResolvedValue({
      ...sampleItem,
      type: { ...sampleItem.type, name: "file" },
    });

    const result = await createShareLink("item-1", { expiresInDays: 7 });
    expect(result).toEqual({
      success: false,
      error: "This item type cannot be shared",
    });
  });

  it("returns active link without creating when not regenerating", async () => {
    mockCreateShareLink.mockResolvedValue({
      id: "link-1",
      token: "token",
      itemId: "item-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      revokedAt: null,
      viewCount: 2,
      lastViewedAt: null,
    });

    const result = await createShareLink("item-1", { expiresInDays: null });

    expect(result.success).toBe(true);
    expect(mockCreateShareLink).toHaveBeenCalledWith("user-1", "item-1", {
      expiresInDays: null,
      regenerate: false,
      isPro: false,
    });
  });

  it("maps share link limit errors", async () => {
    mockCreateShareLink.mockRejectedValue(new ShareLinkLimitExceededError());

    const result = await createShareLink("item-1", { expiresInDays: 7 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("10 active share links");
    }
  });
});

describe("getShareLinkForItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemById.mockResolvedValue(sampleItem);
    mockGetActive.mockResolvedValue(null);
  });

  it("returns null when no active link", async () => {
    const result = await getShareLinkForItem("item-1");
    expect(result).toEqual({ success: true, data: null });
  });
});
