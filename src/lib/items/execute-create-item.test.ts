import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/items", () => ({
  createItem: vi.fn(),
  getItemTypeBySlug: vi.fn(),
}));

vi.mock("@/lib/db/collections", () => ({
  validateUserCollectionIds: vi.fn(),
}));

vi.mock("@/lib/db/user", () => ({
  getUserIsPro: vi.fn(),
}));

vi.mock("@/lib/db/free-tier-limits", () => ({
  FreeTierLimitExceededError: class FreeTierLimitExceededError extends Error {},
  runWithFreeTierItemGuard: vi.fn(),
}));

import { getItemTypeBySlug } from "@/lib/db/items";
import { validateUserCollectionIds } from "@/lib/db/collections";
import { getUserIsPro } from "@/lib/db/user";
import { runWithFreeTierItemGuard } from "@/lib/db/free-tier-limits";

import { executeCreateTextItem } from "./execute-create-item";

const mockGetItemTypeBySlug = vi.mocked(getItemTypeBySlug);
const mockValidateCollections = vi.mocked(validateUserCollectionIds);
const mockGetUserIsPro = vi.mocked(getUserIsPro);
const mockGuard = vi.mocked(runWithFreeTierItemGuard);

describe("executeCreateTextItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserIsPro.mockResolvedValue(true);
    mockValidateCollections.mockResolvedValue(true);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-1",
      name: "snippet",
      icon: null,
      color: null,
    });
    mockGuard.mockImplementation(async (_userId, _isPro, create) => create({} as never));
  });

  it("returns invalid_type when slug is unknown", async () => {
    mockGetItemTypeBySlug.mockResolvedValue(null);

    const result = await executeCreateTextItem("user-1", {
      type: "snippet",
      title: "x",
      tags: [],
      collectionIds: [],
    });

    expect(result).toEqual({
      success: false,
      kind: "invalid_type",
      message: "Invalid item type",
    });
  });

  it("returns invalid_collections when selection is invalid", async () => {
    mockValidateCollections.mockResolvedValue(false);

    const result = await executeCreateTextItem("user-1", {
      type: "snippet",
      title: "x",
      tags: [],
      collectionIds: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.kind).toBe("invalid_collections");
    }
  });
});
