import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: unknown) => Promise<unknown>) =>
      mockTransaction(callback),
  },
}));

vi.mock("@/lib/db/items", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/items")>();
  return {
    ...actual,
    resolveTagNamesForUser: vi.fn().mockResolvedValue([]),
  };
});

import { patchApiV1Item } from "./api-v1-patch";

describe("patchApiV1Item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads, merges, and updates inside one transaction", async () => {
    const tx = {
      item: {
        findFirst: vi.fn().mockResolvedValue({
          id: "item-1",
          title: "Old",
          description: null,
          contentType: "text",
          content: "body",
          url: null,
          language: null,
          fileUrl: null,
          fileName: null,
          fileSize: null,
          isFavorite: false,
          isPinned: false,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-02"),
          type: { id: "t1", name: "snippet", icon: null, color: null },
          tags: [],
          collections: [],
        }),
        update: vi.fn().mockResolvedValue({
          id: "item-1",
          title: "New",
          description: null,
          contentType: "text",
          content: "body",
          url: null,
          language: null,
          fileUrl: null,
          fileName: null,
          fileSize: null,
          isFavorite: false,
          isPinned: false,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-03"),
          type: { id: "t1", name: "snippet", icon: null, color: null },
          tags: [],
          collections: [],
        }),
      },
    };

    mockTransaction.mockImplementation(async (callback) => callback(tx));

    const result = await patchApiV1Item(
      "user-1",
      "item-1",
      { title: "New" },
      { title: "New" },
    );

    expect(result.ok).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(tx.item.findFirst).toHaveBeenCalled();
    expect(tx.item.update).toHaveBeenCalled();
  });
});
