import { describe, expect, it } from "vitest";

import type { FavoriteCollection } from "@/lib/db/collections";
import type { DashboardItem } from "@/lib/db/items";

import {
  parseFavoriteCollectionSortParam,
  parseFavoriteItemSortParam,
  sortFavoriteCollections,
  sortFavoriteItems,
} from "./favorites-sort";

function createItem(
  overrides: Partial<DashboardItem> & Pick<DashboardItem, "id" | "title" | "type">,
): DashboardItem {
  return {
    description: null,
    preview: null,
    url: null,
    fileName: null,
    fileSize: null,
    language: null,
    fileUrl: null,
    isPinned: false,
    isFavorite: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    tags: [],
    ...overrides,
  } as DashboardItem;
}

function createCollection(
  overrides: Partial<FavoriteCollection> & Pick<FavoriteCollection, "id" | "name">,
): FavoriteCollection {
  return {
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("parseFavoriteItemSortParam", () => {
  it("defaults invalid values to newest", () => {
    expect(parseFavoriteItemSortParam(undefined)).toBe("newest");
    expect(parseFavoriteItemSortParam(null)).toBe("newest");
    expect(parseFavoriteItemSortParam("invalid")).toBe("newest");
  });

  it("parses valid sort fields", () => {
    expect(parseFavoriteItemSortParam("newest")).toBe("newest");
    expect(parseFavoriteItemSortParam("oldest")).toBe("oldest");
    expect(parseFavoriteItemSortParam("name-asc")).toBe("name-asc");
    expect(parseFavoriteItemSortParam("name-desc")).toBe("name-desc");
    expect(parseFavoriteItemSortParam("type")).toBe("type");
  });

  it("maps legacy sort values", () => {
    expect(parseFavoriteItemSortParam("date")).toBe("newest");
    expect(parseFavoriteItemSortParam("name")).toBe("name-asc");
  });
});

describe("parseFavoriteCollectionSortParam", () => {
  it("defaults invalid values to newest", () => {
    expect(parseFavoriteCollectionSortParam(undefined)).toBe("newest");
    expect(parseFavoriteCollectionSortParam(null)).toBe("newest");
    expect(parseFavoriteCollectionSortParam("type")).toBe("newest");
  });

  it("parses valid sort fields", () => {
    expect(parseFavoriteCollectionSortParam("newest")).toBe("newest");
    expect(parseFavoriteCollectionSortParam("oldest")).toBe("oldest");
    expect(parseFavoriteCollectionSortParam("name-asc")).toBe("name-asc");
    expect(parseFavoriteCollectionSortParam("name-desc")).toBe("name-desc");
  });

  it("maps legacy sort values", () => {
    expect(parseFavoriteCollectionSortParam("date")).toBe("newest");
    expect(parseFavoriteCollectionSortParam("name")).toBe("name-asc");
  });
});

describe("sortFavoriteItems", () => {
  const items = [
    createItem({
      id: "1",
      title: "Beta",
      type: { id: "type-note", name: "note", icon: "StickyNote", color: null },
      updatedAt: new Date("2026-01-03"),
    }),
    createItem({
      id: "2",
      title: "Alpha",
      type: { id: "type-snippet", name: "snippet", icon: "Code", color: null },
      updatedAt: new Date("2026-01-01"),
    }),
    createItem({
      id: "3",
      title: "Gamma",
      type: { id: "type-snippet-2", name: "snippet", icon: "Code", color: null },
      updatedAt: new Date("2026-01-02"),
    }),
  ];

  it("sorts by newest first", () => {
    expect(sortFavoriteItems(items, "newest").map((item) => item.id)).toEqual([
      "1",
      "3",
      "2",
    ]);
  });

  it("sorts by oldest first", () => {
    expect(sortFavoriteItems(items, "oldest").map((item) => item.id)).toEqual([
      "2",
      "3",
      "1",
    ]);
  });

  it("sorts by name A-Z", () => {
    expect(sortFavoriteItems(items, "name-asc").map((item) => item.id)).toEqual([
      "2",
      "1",
      "3",
    ]);
  });

  it("sorts by name Z-A", () => {
    expect(sortFavoriteItems(items, "name-desc").map((item) => item.id)).toEqual([
      "3",
      "1",
      "2",
    ]);
  });

  it("sorts by item type using system order then name", () => {
    expect(sortFavoriteItems(items, "type").map((item) => item.id)).toEqual([
      "2",
      "3",
      "1",
    ]);
  });
});

describe("sortFavoriteCollections", () => {
  const collections = [
    createCollection({
      id: "1",
      name: "Beta",
      updatedAt: new Date("2026-01-03"),
    }),
    createCollection({
      id: "2",
      name: "Alpha",
      updatedAt: new Date("2026-01-01"),
    }),
  ];

  it("sorts by newest first", () => {
    expect(
      sortFavoriteCollections(collections, "newest").map(
        (collection) => collection.id,
      ),
    ).toEqual(["1", "2"]);
  });

  it("sorts by oldest first", () => {
    expect(
      sortFavoriteCollections(collections, "oldest").map(
        (collection) => collection.id,
      ),
    ).toEqual(["2", "1"]);
  });

  it("sorts by name A-Z", () => {
    expect(
      sortFavoriteCollections(collections, "name-asc").map(
        (collection) => collection.id,
      ),
    ).toEqual(["2", "1"]);
  });

  it("sorts by name Z-A", () => {
    expect(
      sortFavoriteCollections(collections, "name-desc").map(
        (collection) => collection.id,
      ),
    ).toEqual(["1", "2"]);
  });
});
