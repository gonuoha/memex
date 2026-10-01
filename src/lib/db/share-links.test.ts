import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shareLink: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

import { getPublicSharedItemByToken } from "./share-links";

const shareLinkFindUnique = vi.mocked(prisma.shareLink.findUnique);

describe("getPublicSharedItemByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for revoked links", async () => {
    shareLinkFindUnique.mockResolvedValue({
      id: "link-1",
      expiresAt: null,
      revokedAt: new Date(),
      item: {
        title: "T",
        description: null,
        content: "c",
        url: null,
        language: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: { name: "snippet" },
        tags: [],
      },
    } as never);

    expect(await getPublicSharedItemByToken("token")).toBeNull();
  });

  it("returns null for trashed items", async () => {
    shareLinkFindUnique.mockResolvedValue({
      id: "link-1",
      expiresAt: null,
      revokedAt: null,
      item: {
        title: "T",
        description: null,
        content: "c",
        url: null,
        language: null,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        type: { name: "snippet" },
        tags: [],
      },
    } as never);

    expect(await getPublicSharedItemByToken("token")).toBeNull();
  });

  it("returns null for non-shareable types", async () => {
    shareLinkFindUnique.mockResolvedValue({
      id: "link-1",
      expiresAt: null,
      revokedAt: null,
      item: {
        title: "Title",
        description: null,
        content: "body",
        url: null,
        language: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: { name: "file" },
        tags: [],
      },
    } as never);

    expect(await getPublicSharedItemByToken("token")).toBeNull();
  });

  it("returns public item payload when active", async () => {
    shareLinkFindUnique.mockResolvedValue({
      id: "link-1",
      expiresAt: null,
      revokedAt: null,
      item: {
        title: "Title",
        description: "Desc",
        content: "body",
        url: null,
        language: "ts",
        deletedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        type: { name: "snippet" },
        tags: [{ tag: { name: "tag1" } }],
      },
    } as never);

    const result = await getPublicSharedItemByToken("token");

    expect(result?.shareLinkId).toBe("link-1");
    expect(result?.item.title).toBe("Title");
    expect(result?.item.tags).toEqual(["tag1"]);
  });
});
