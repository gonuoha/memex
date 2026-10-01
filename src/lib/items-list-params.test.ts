import { describe, expect, it } from "vitest";

import {
  buildItemsListQueryString,
  hasExplicitItemsListView,
  ITEMS_LIST_TAG_MAX_LENGTH,
  parseFavoritesOnly,
  parseItemsListSearchParams,
  parseItemsListSort,
  parseItemsListTag,
} from "./items-list-params";

describe("items-list-params", () => {
  it("defaults sort to updated", () => {
    expect(parseItemsListSort()).toBe("updated");
    expect(parseItemsListSort("title_asc")).toBe("title_asc");
    expect(parseItemsListSort("invalid")).toBe("updated");
  });

  it("parses favorites flag", () => {
    expect(parseFavoritesOnly("1")).toBe(true);
    expect(parseFavoritesOnly(undefined)).toBe(false);
  });

  it("builds query strings", () => {
    expect(
      buildItemsListQueryString({
        sort: "title_asc",
        tag: "react",
        favoritesOnly: true,
        view: "list",
        page: 2,
      }),
    ).toBe("?sort=title_asc&tag=react&fav=1&view=list&page=2");
  });

  it("parses raw search params safely, including repeated keys", () => {
    expect(
      parseItemsListSearchParams(
        {
          sort: ["title_desc", "created"],
          tag: ["  react  ", "next"],
          fav: "1",
          view: "bogus",
          page: "-3",
        },
        "list",
      ),
    ).toEqual({
      sort: "title_desc",
      tag: "react",
      favoritesOnly: true,
      view: "list",
      page: 1,
    });
  });

  it("drops empty or oversized tags", () => {
    expect(parseItemsListTag("   ")).toBeNull();
    expect(parseItemsListTag("x".repeat(ITEMS_LIST_TAG_MAX_LENGTH + 1))).toBeNull();
  });

  it("detects an explicit view param", () => {
    expect(hasExplicitItemsListView({ view: "grid" })).toBe(true);
    expect(hasExplicitItemsListView({ view: "tiles" })).toBe(false);
    expect(hasExplicitItemsListView({})).toBe(false);
  });
});
