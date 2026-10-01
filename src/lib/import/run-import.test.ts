import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/collections", () => ({
  createCollection: vi.fn(),
}));

vi.mock("@/lib/db/items", () => ({
  createItem: vi.fn(),
  resolveTagNamesForUser: vi.fn(),
}));

vi.mock("@/lib/db/free-tier-limits", () => ({
  FreeTierLimitExceededError: class FreeTierLimitExceededError extends Error {
    readonly kind: "item" | "collection";
    constructor(kind: "item" | "collection") {
      super("limit");
      this.name = "FreeTierLimitExceededError";
      this.kind = kind;
    }
  },
  runWithFreeTierCollectionGuard: vi.fn(),
  runWithFreeTierItemGuard: vi.fn(),
}));

vi.mock("@/lib/db/advisory-lock", () => ({
  takeUserAdvisoryLock: vi.fn(),
}));

vi.mock("@/lib/import/duplicate-hash", () => ({
  buildImportDuplicateFingerprint: vi.fn(() => "fp"),
  fetchActiveItemDuplicateFingerprints: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    collection: { findMany: vi.fn() },
    item: { findMany: vi.fn() },
    itemType: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { runWithFreeTierCollectionGuard } from "@/lib/db/free-tier-limits";
import { createItem, resolveTagNamesForUser } from "@/lib/db/items";
import { fetchActiveItemDuplicateFingerprints } from "@/lib/import/duplicate-hash";
import { prisma } from "@/lib/prisma";

import { runMemexImport } from "./run-import";

const mockCollectionFindMany = vi.mocked(prisma.collection.findMany);
const mockRunCollectionGuard = vi.mocked(runWithFreeTierCollectionGuard);
const mockCreateItem = vi.mocked(createItem);
const mockResolveTags = vi.mocked(resolveTagNamesForUser);
const mockFetchFingerprints = vi.mocked(fetchActiveItemDuplicateFingerprints);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockItemTypeFindMany = vi.mocked(prisma.itemType.findMany);

const exportPayload = {
  version: 1 as const,
  exportedAt: "2026-01-01T00:00:00.000Z",
  collections: [],
  items: [
    {
      type: "snippet" as const,
      title: "New",
      description: null,
      content: "code",
      url: null,
      language: null,
      isFavorite: false,
      isPinned: false,
      tags: ["react"],
      collections: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      type: "image" as const,
      title: "Pic",
      description: null,
      content: null,
      url: null,
      language: null,
      isFavorite: false,
      isPinned: false,
      tags: [],
      collections: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      file: { fileName: "a.png", fileSize: 10 },
    },
  ],
};

describe("runMemexImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectionFindMany.mockResolvedValue([]);
    mockFetchFingerprints.mockResolvedValue(new Set());
    mockRunCollectionGuard.mockImplementation(async (_u, _p, fn) =>
      fn({} as never),
    );
    mockResolveTags.mockResolvedValue(["react"]);
    mockCreateItem.mockResolvedValue({} as never);
    mockItemTypeFindMany.mockResolvedValue([
      { id: "type-1", name: "snippet" },
    ] as never);
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        item: { count: vi.fn().mockResolvedValue(0) },
      } as never),
    );
    mockCreateItem.mockResolvedValue({} as never);
  });

  it("rejects invalid format", async () => {
    const result = await runMemexImport("user-1", false, { version: 9 });
    expect(result).toEqual({ error: "invalid_format" });
  });

  it("rejects array caps", async () => {
    const result = await runMemexImport("user-1", false, {
      version: 1,
      exportedAt: "x",
      items: Array.from({ length: 10_001 }, () => exportPayload.items[0]),
      collections: [],
    });

    expect(result).toEqual({ error: "array_caps_exceeded" });
  });

  it("skips unsupported types and imports text items", async () => {
    const result = await runMemexImport("user-1", false, exportPayload);

    expect(result).toMatchObject({
      created: 1,
      skippedUnsupported: 1,
      skippedDuplicates: 0,
      failed: 0,
    });
    expect(mockCreateItem).toHaveBeenCalledOnce();
  });

  it("counts failed inserts inside chunk transactions", async () => {
    mockCreateItem.mockRejectedValueOnce(new Error("db"));

    const result = await runMemexImport("user-1", false, exportPayload);

    expect(result).toMatchObject({
      created: 0,
      failed: 1,
    });
  });
});
