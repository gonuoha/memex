import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
    },
    itemTag: {
      findMany: vi.fn(),
    },
    collection: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

import { searchCollections, searchItems } from "./search";

const mockFindMany = vi.mocked(prisma.item.findMany);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockCollectionFindMany = vi.mocked(prisma.collection.findMany);
const mockItemTagFindMany = vi.mocked(prisma.itemTag.findMany);

describe("searchItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItemTagFindMany.mockResolvedValue([]);
  });

  it("loads recent items when the query is empty", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "item-1",
        title: "Recent",
        description: "Hello",
        content: null,
        type: {
          id: "type-1",
          name: "snippet",
          icon: "Code",
          color: "#000",
        },
        tags: [],
      },
    ] as never);

    const results = await searchItems("user-1", "", { limit: 8 });

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Recent");
    expect(mockFindMany).toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("uses full-text search for non-empty queries", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: "item-2",
        title: "React hook",
        snippet: "useState example",
        type_id: "type-1",
        type_name: "snippet",
        type_icon: "Code",
        type_color: "#000",
        rank: 1,
      },
    ]);

    const results = await searchItems("user-1", "react", { limit: 10 });

    expect(mockQueryRaw).toHaveBeenCalled();
    expect(results[0]?.title).toBe("React hook");
    expect(results[0]?.snippet).toBe("useState example");
  });
});

describe("searchCollections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recent collections for an empty query", async () => {
    mockCollectionFindMany.mockResolvedValue([
      {
        id: "col-1",
        name: "Work",
        _count: { items: 3 },
      },
    ] as never);

    const results = await searchCollections("user-1", "", 5);

    expect(results).toEqual([{ id: "col-1", name: "Work", itemCount: 3 }]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
