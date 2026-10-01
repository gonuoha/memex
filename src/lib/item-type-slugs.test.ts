import { describe, expect, it } from "vitest";

import {
  getCanonicalItemTypeSlug,
  getTypeSlug,
  parseItemTypeSlug,
} from "./item-type-slugs";

describe("item-type-slugs", () => {
  it("maps type names to plural slugs", () => {
    expect(getTypeSlug("snippet")).toBe("snippets");
    expect(getTypeSlug("link")).toBe("links");
  });

  it("parses plural and legacy slugs to type names", () => {
    expect(parseItemTypeSlug("snippets")).toBe("snippet");
    expect(parseItemTypeSlug("urls")).toBe("link");
    expect(parseItemTypeSlug("url")).toBe("link");
    expect(parseItemTypeSlug("snippet")).toBe("snippet");
  });

  it("returns null for unknown slugs", () => {
    expect(parseItemTypeSlug("unknown")).toBeNull();
  });

  it("canonicalizes slugs to plural form", () => {
    expect(getCanonicalItemTypeSlug("snippet")).toBe("snippets");
    expect(getCanonicalItemTypeSlug("snippets")).toBe("snippets");
    expect(getCanonicalItemTypeSlug("url")).toBe("links");
  });
});
