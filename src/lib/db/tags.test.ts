import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    itemTag: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { prisma } from "@/lib/prisma";

import { deleteOrphanTags, deleteTag, renameTag } from "./tags";

const mockTagFindMany = vi.mocked(prisma.tag.findMany);
const mockTagFindFirst = vi.mocked(prisma.tag.findFirst);
const mockTagUpdate = vi.mocked(prisma.tag.update);
const mockTagDeleteMany = vi.mocked(prisma.tag.deleteMany);
const mockItemTagFindMany = vi.mocked(prisma.itemTag.findMany);
const mockItemTagCreateMany = vi.mocked(prisma.itemTag.createMany);
const mockItemTagDeleteMany = vi.mocked(prisma.itemTag.deleteMany);

describe("deleteOrphanTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTagDeleteMany.mockResolvedValue({ count: 2 });
  });

  it("returns early for an empty tag id list", async () => {
    await expect(deleteOrphanTags("user-1", [])).resolves.toBe(0);
    expect(mockTagDeleteMany).not.toHaveBeenCalled();
  });

  it("scopes cleanup to the provided tag ids", async () => {
    await expect(deleteOrphanTags("user-1", ["t-1", "t-2"])).resolves.toBe(2);
    expect(mockTagDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        id: { in: ["t-1", "t-2"] },
        items: { none: {} },
      },
    });
  });
});

describe("deleteTag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the tag does not exist", async () => {
    mockTagFindFirst.mockResolvedValue(null);

    await expect(deleteTag("user-1", "tag-1")).resolves.toBeNull();
  });

  it("returns null when deleteMany removes nothing", async () => {
    mockTagFindFirst.mockResolvedValue({ id: "tag-1", name: "api" } as never);
    mockTagDeleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteTag("user-1", "tag-1")).resolves.toBeNull();
  });

  it("deletes an owned tag", async () => {
    mockTagFindFirst.mockResolvedValue({ id: "tag-1", name: "api" } as never);
    mockTagDeleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteTag("user-1", "tag-1")).resolves.toEqual({ name: "api" });
    expect(mockTagDeleteMany).toHaveBeenCalledWith({
      where: { id: "tag-1", userId: "user-1" },
    });
  });
});

describe("renameTag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
  });

  it("returns null when the tag is missing", async () => {
    mockTagFindFirst.mockResolvedValue(null);

    await expect(renameTag("user-1", "tag-1", "next")).resolves.toBeNull();
  });

  it("merges case variants into the exact-casing keeper", async () => {
    mockTagFindFirst.mockResolvedValueOnce({
      id: "react-upper",
      name: "React",
    } as never);
    mockTagFindMany.mockResolvedValueOnce([
      { id: "react-lower", name: "react" },
      { id: "react-upper", name: "React" },
    ] as never);
    mockItemTagFindMany.mockResolvedValue([{ itemId: "item-1" }] as never);
    mockItemTagCreateMany.mockResolvedValue({ count: 1 });
    mockItemTagDeleteMany.mockResolvedValue({ count: 1 });
    mockTagDeleteMany.mockResolvedValue({ count: 1 });

    await expect(renameTag("user-1", "react-upper", "react")).resolves.toEqual({
      id: "react-lower",
      name: "react",
      merged: true,
    });

    expect(mockItemTagCreateMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", tagId: "react-lower" }],
      skipDuplicates: true,
    });
    expect(mockTagDeleteMany).toHaveBeenCalledWith({
      where: { id: "react-upper", userId: "user-1" },
    });
  });

  it("skips duplicate item links when merging source into target", async () => {
    mockTagFindFirst
      .mockResolvedValueOnce({ id: "source", name: "old" } as never)
      .mockResolvedValueOnce({ id: "target", name: "new" } as never);
    mockItemTagFindMany.mockResolvedValue([{ itemId: "shared" }] as never);
    mockItemTagCreateMany.mockResolvedValue({ count: 0 });
    mockItemTagDeleteMany.mockResolvedValue({ count: 1 });
    mockTagDeleteMany.mockResolvedValue({ count: 1 });

    await expect(renameTag("user-1", "source", "new")).resolves.toEqual({
      id: "target",
      name: "new",
      merged: true,
    });

    expect(mockItemTagCreateMany).toHaveBeenCalledWith({
      data: [{ itemId: "shared", tagId: "target" }],
      skipDuplicates: true,
    });
    expect(mockTagDeleteMany).toHaveBeenCalledWith({
      where: { id: "source", userId: "user-1" },
    });
  });

  it("renames in place when the name is available", async () => {
    mockTagFindFirst
      .mockResolvedValueOnce({ id: "tag-1", name: "old" } as never)
      .mockResolvedValueOnce(null);
    mockTagUpdate.mockResolvedValue({ id: "tag-1", name: "fresh" } as never);

    await expect(renameTag("user-1", "tag-1", "fresh")).resolves.toEqual({
      id: "tag-1",
      name: "fresh",
      merged: false,
    });
  });
});
