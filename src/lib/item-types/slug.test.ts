import { describe, expect, it } from "vitest";

import {
  dedupeItemTypeSlug,
  getReservedTypeNames,
  isReservedItemTypeName,
  isReservedItemTypeSlug,
  slugifyItemTypeName,
} from "@/lib/item-types/slug";

describe("item type slug helpers", () => {
  it("slugifies names for URLs", () => {
    expect(slugifyItemTypeName("My API Notes")).toBe("my-api-notes");
  });

  it("dedupes when slug is taken", () => {
    const taken = new Set(["my-type"]);
    expect(dedupeItemTypeSlug("my-type", taken)).toBe("my-type-2");
  });

  it("blocks reserved system names", () => {
    expect(isReservedItemTypeName("Snippet")).toBe(true);
    expect(getReservedTypeNames().has("link")).toBe(true);
  });

  it("blocks reserved system slugs and aliases", () => {
    expect(isReservedItemTypeSlug("snippets")).toBe(true);
    expect(isReservedItemTypeSlug("my-widget")).toBe(false);
  });
});
