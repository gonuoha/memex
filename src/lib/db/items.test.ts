import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/tags", () => ({
  deleteOrphanTags: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    itemTag: {
      findMany: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
    },
    shareLink: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    ),
  },
}));

import { prisma } from "@/lib/prisma";

import { deleteOrphanTags } from "./tags";

import {
  deleteItem,
  getItemById,
  permanentlyDeleteItem,
  restoreItem,
  toggleItemFavorite,
  toggleItemPin,
  updateItem,
} from "./items";

const mockFindFirst = vi.mocked(prisma.item.findFirst);
const mockUpdate = vi.mocked(prisma.item.update);
const mockDeleteMany = vi.mocked(prisma.item.deleteMany);
const mockItemTagFindMany = vi.mocked(prisma.itemTag.findMany);
const mockTagFindMany = vi.mocked(prisma.tag.findMany);
const mockDeleteOrphanTags = vi.mocked(deleteOrphanTags);
const mockShareLinkUpdateMany = vi.mocked(prisma.shareLink.updateMany);

const itemDetailFixture = {
  id: "item-1",
  title: "t",
  description: null,
  contentType: "text" as const,
  content: null,
  url: null,
  language: null,
  fileUrl: null,
  fileName: null,
  fileSize: null,
  isFavorite: false,
  isPinned: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  type: { id: "type-1", name: "snippet", icon: "code", color: null },
  tags: [],
  collections: [],
};

const activeWhere = { id: "item-1", userId: "user-1", deletedAt: null };
const trashedWhere = { id: "item-1", userId: "user-1", deletedAt: { not: null } };

describe("item queries exclude trashed items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
  });

  it("getItemById only returns non-trashed items", async () => {
    await expect(getItemById("user-1", "item-1")).resolves.toBeNull();
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: activeWhere }),
    );
  });

  it.each([
    ["updateItem", () =>
      updateItem("user-1", "item-1", {
        title: "t",
        description: null,
        content: null,
        url: null,
        language: null,
        tags: [],
        collectionIds: [],
      })],
    ["toggleItemFavorite", () => toggleItemFavorite("user-1", "item-1")],
    ["toggleItemPin", () => toggleItemPin("user-1", "item-1")],
    ["deleteItem", () => deleteItem("user-1", "item-1")],
  ])("%s rejects trashed items", async (_, run) => {
    await expect(run()).resolves.toBeNull();
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: activeWhere }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("trash mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItemTagFindMany.mockResolvedValue([]);
  });

  it("deleteItem soft-deletes and unpins the item", async () => {
    mockFindFirst.mockResolvedValue({
      id: "item-1",
      type: { name: "snippet" },
    } as never);
    mockShareLinkUpdateMany.mockResolvedValue({ count: 1 });

    const result = await deleteItem("user-1", "item-1");

    expect(result).toEqual({ typeName: "snippet" });
    expect(mockShareLinkUpdateMany).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { deletedAt: expect.any(Date), isPinned: false },
    });
  });

  it("restoreItem only restores items that are in trash", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(restoreItem("user-1", "item-1")).resolves.toBeNull();
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: trashedWhere }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("permanentlyDeleteItem re-applies the trash filter when deleting", async () => {
    mockFindFirst.mockResolvedValue({
      id: "item-1",
      fileUrl: "users/user-1/a.txt",
      type: { name: "file" },
    } as never);
    mockDeleteMany.mockResolvedValue({ count: 0 });

    await expect(permanentlyDeleteItem("user-1", "item-1")).resolves.toBeNull();
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: trashedWhere });
  });

  it("permanentlyDeleteItem returns the file key for cleanup", async () => {
    mockFindFirst.mockResolvedValue({
      id: "item-1",
      fileUrl: "users/user-1/a.txt",
      type: { name: "file" },
    } as never);
    mockItemTagFindMany.mockResolvedValue([
      { tagId: "tag-1" },
      { tagId: "tag-2" },
    ] as never);
    mockDeleteMany.mockResolvedValue({ count: 1 });

    await expect(permanentlyDeleteItem("user-1", "item-1")).resolves.toEqual({
      typeName: "file",
      fileUrl: "users/user-1/a.txt",
    });
    expect(mockDeleteOrphanTags).toHaveBeenCalledWith("user-1", [
      "tag-1",
      "tag-2",
    ]);
  });

  it("updateItem cleans up previous tag ids inside the transaction", async () => {
    mockFindFirst.mockResolvedValue({ id: "item-1" } as never);
    mockItemTagFindMany.mockResolvedValue([{ tagId: "tag-old" }] as never);
    mockTagFindMany.mockResolvedValue([]);
    mockUpdate.mockResolvedValue(itemDetailFixture as never);

    await updateItem("user-1", "item-1", {
      title: "t",
      description: null,
      content: null,
      url: null,
      language: null,
      tags: ["fresh"],
      collectionIds: [],
    });

    expect(mockDeleteOrphanTags).toHaveBeenCalledWith(
      "user-1",
      ["tag-old"],
      prisma,
    );
  });
});
