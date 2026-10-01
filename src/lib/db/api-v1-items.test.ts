import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/search", () => ({
  searchApiV1ItemIds: vi.fn(),
}));

vi.mock("@/lib/db/api-v1-tag-filter", () => ({
  resolveTagIdForApiFilter: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "@/lib/prisma";
import { searchApiV1ItemIds } from "@/lib/db/search";
import {
  API_V1_MAX_SEARCH_OFFSET,
  encodeApiV1ListCursor,
  hashApiV1ListFilters,
} from "@/lib/api/v1/item-cursors";

import { listApiV1Items } from "./api-v1-items";

const mockFindMany = vi.mocked(prisma.item.findMany);
const mockSearchIds = vi.mocked(searchApiV1ItemIds);

describe("listApiV1Items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invalid_cursor for malformed cursors", async () => {
    const result = await listApiV1Items("user-1", {
      limit: 25,
      cursor: "not-valid",
    });

    expect(result).toEqual({ ok: false, code: "invalid_cursor" });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns invalid_cursor when keyset filter hash mismatches", async () => {
    const cursor = encodeApiV1ListCursor({
      k: "ks",
      id: "item-1",
      u: "2026-01-01T00:00:00.000Z",
      h: "deadbeef",
    });

    const result = await listApiV1Items("user-1", {
      limit: 25,
      cursor,
      tag: "work",
    });

    expect(result).toEqual({ ok: false, code: "invalid_cursor" });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("uses search when q is provided", async () => {
    mockSearchIds.mockResolvedValue(["item-1"]);
    mockFindMany.mockResolvedValue([
      {
        id: "item-1",
        title: "A",
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
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        type: { id: "t1", name: "snippet", icon: null, color: null },
        tags: [],
        collections: [],
      },
    ] as never);

    const result = await listApiV1Items("user-1", {
      limit: 25,
      q: "hello",
    });

    expect(result.ok).toBe(true);
    expect(mockSearchIds).toHaveBeenCalled();
  });

  it("returns null nextCursor when search offset reaches the cap", async () => {
    const filterHash = hashApiV1ListFilters({ limit: 25, q: "hello" });
    const offset = API_V1_MAX_SEARCH_OFFSET - 10;
    const cursor = encodeApiV1ListCursor({ k: "q", o: offset, h: filterHash });

    mockSearchIds.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => `item-${index}`),
    );
    mockFindMany.mockResolvedValue([] as never);

    const result = await listApiV1Items("user-1", {
      limit: 25,
      q: "hello",
      cursor,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page.nextCursor).toBeNull();
    }

    expect(mockSearchIds).toHaveBeenCalledWith(
      "user-1",
      "hello",
      expect.any(Object),
      11,
      offset,
    );
  });
});
