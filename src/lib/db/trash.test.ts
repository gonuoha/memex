import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/tags", () => ({
  deleteOrphanTags: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    itemTag: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/r2/storage", () => ({
  deleteObjects: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/r2/storage";

import { deleteOrphanTags } from "./tags";

import { emptyTrash, purgeExpiredTrash } from "./trash";

const mockFindMany = vi.mocked(prisma.item.findMany);
const mockDeleteMany = vi.mocked(prisma.item.deleteMany);
const mockItemTagFindMany = vi.mocked(prisma.itemTag.findMany);
const mockDeleteObjects = vi.mocked(deleteObjects);
const mockDeleteOrphanTags = vi.mocked(deleteOrphanTags);

function trashedRows(count: number, withFiles = false, userId = "user-1") {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    userId,
    fileUrl: withFiles ? `users/user-1/file-${index}.txt` : null,
  }));
}

describe("emptyTrash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockItemTagFindMany.mockResolvedValue([]);
  });

  it("only deletes the user's trashed items", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);

    const result = await emptyTrash("user-1");

    expect(result).toEqual({ deletedCount: 0 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", deletedAt: { not: null } },
      }),
    );
    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(mockDeleteObjects).not.toHaveBeenCalled();
  });

  it("re-applies the trash filter on delete and removes files for deleted rows", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "a", userId: "user-1", fileUrl: "users/user-1/a.txt" },
      { id: "b", userId: "user-1", fileUrl: null },
    ] as never);
    mockItemTagFindMany.mockResolvedValueOnce([
      { tagId: "tag-1", itemId: "a", item: { userId: "user-1" } },
    ] as never);
    mockDeleteMany.mockResolvedValueOnce({ count: 2 });

    const result = await emptyTrash("user-1");

    expect(result).toEqual({ deletedCount: 2 });
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        deletedAt: { not: null },
        id: { in: ["a", "b"] },
      },
    });
    expect(mockDeleteObjects).toHaveBeenCalledWith(["users/user-1/a.txt"]);
    expect(mockDeleteOrphanTags).toHaveBeenCalledWith("user-1", ["tag-1"]);
  });

  it("keeps files of items restored between selection and deletion", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { id: "a", userId: "user-1", fileUrl: "users/user-1/a.txt" },
        { id: "b", userId: "user-1", fileUrl: "users/user-1/b.txt" },
      ] as never)
      .mockResolvedValueOnce([{ id: "b" }] as never);
    mockDeleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await emptyTrash("user-1");

    expect(result).toEqual({ deletedCount: 1 });
    expect(mockDeleteObjects).toHaveBeenCalledWith(["users/user-1/a.txt"]);
  });

  it("still reports deleted rows when R2 deletion fails", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "a", userId: "user-1", fileUrl: "users/user-1/a.txt" },
    ] as never);
    mockDeleteMany.mockResolvedValueOnce({ count: 1 });
    mockDeleteObjects.mockRejectedValueOnce(new Error("R2 unavailable"));

    await expect(emptyTrash("user-1")).resolves.toEqual({ deletedCount: 1 });
  });

  it("processes trash in batches", async () => {
    mockFindMany
      .mockResolvedValueOnce(trashedRows(100) as never)
      .mockResolvedValueOnce(trashedRows(3) as never);
    mockDeleteMany
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 3 });

    const result = await emptyTrash("user-1");

    expect(result).toEqual({ deletedCount: 103 });
    expect(mockDeleteMany).toHaveBeenCalledTimes(2);
  });
});

describe("purgeExpiredTrash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItemTagFindMany.mockResolvedValue([]);
  });

  it("only selects items trashed before the retention deadline", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);

    await expect(purgeExpiredTrash()).resolves.toBe(0);

    const [args] = mockFindMany.mock.calls[0] ?? [];
    expect(args?.where).toEqual({ deletedAt: { lt: expect.any(Date) } });
  });

  it("caps the number of batches per run", async () => {
    mockFindMany.mockResolvedValue(trashedRows(100) as never);
    mockDeleteMany.mockResolvedValue({ count: 100 });

    await expect(purgeExpiredTrash()).resolves.toBe(5000);
    expect(mockDeleteMany).toHaveBeenCalledTimes(50);
  });
});
