import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/tags", () => ({
  deleteOrphanTags: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
    },
    item: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

import { deleteOrphanTags } from "./tags";

import { createItem, resolveTagNamesForUser } from "./items";

const mockTagFindMany = vi.mocked(prisma.tag.findMany);
const mockItemCreate = vi.mocked(prisma.item.create);
const mockDeleteOrphanTags = vi.mocked(deleteOrphanTags);

describe("resolveTagNamesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses the stored casing for case-insensitive matches", async () => {
    mockTagFindMany.mockResolvedValue([{ name: "React" }] as never);

    await expect(
      resolveTagNamesForUser("user-1", ["react", "fresh"]),
    ).resolves.toEqual(["React", "fresh"]);
  });
});

describe("createItem tag casing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTagFindMany.mockResolvedValue([{ name: "API" }] as never);
    mockItemCreate.mockResolvedValue({
      id: "item-1",
      title: "t",
      description: null,
      contentType: "text",
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
      tags: [{ tag: { name: "API" } }],
      collections: [],
    } as never);
  });

  it("connects tags using the canonical stored name", async () => {
    await createItem(
      "user-1",
      {
        typeId: "type-1",
        title: "t",
        description: null,
        content: null,
        url: null,
        language: null,
        fileUrl: null,
        fileName: null,
        fileSize: null,
        tags: ["api"],
        collectionIds: [],
        contentType: "text",
      },
      prisma,
    );

    expect(mockItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: {
            create: [
              {
                tag: {
                  connectOrCreate: {
                    where: { userId_name: { userId: "user-1", name: "API" } },
                    create: { userId: "user-1", name: "API" },
                  },
                },
              },
            ],
          },
        }),
      }),
    );
    expect(mockDeleteOrphanTags).not.toHaveBeenCalled();
  });
});
