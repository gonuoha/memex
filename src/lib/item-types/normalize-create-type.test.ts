import { describe, expect, it } from "vitest";

import { getTypeSlug } from "@/lib/item-type-slugs";
import { getSystemKindForName } from "@/lib/item-types/kinds";
import type { ItemTypeLike } from "@/lib/item-types/types";
import {
  normalizeCreateTypeSlug,
  resolveDefaultCreateTypeSlug,
  toAiItemTypeName,
} from "./normalize-create-type";

const catalog: ItemTypeLike[] = [
  {
    slug: "snippets",
    name: "Snippet",
    isSystem: true,
    kind: getSystemKindForName("snippet"),
  },
  {
    slug: "notes",
    name: "Note",
    isSystem: true,
    kind: getSystemKindForName("note"),
  },
  {
    slug: "links",
    name: "Link",
    isSystem: true,
    kind: getSystemKindForName("link"),
  },
  {
    slug: "images",
    name: "Image",
    isSystem: true,
    kind: getSystemKindForName("image"),
  },
  {
    slug: "runbooks",
    name: "Runbooks",
    isSystem: false,
    kind: "markdown",
  },
];

describe("normalizeCreateTypeSlug", () => {
  it("maps singular system names to plural slugs", () => {
    expect(normalizeCreateTypeSlug("note", catalog)).toBe("notes");
    expect(normalizeCreateTypeSlug("link", catalog)).toBe("links");
    expect(normalizeCreateTypeSlug("image", catalog)).toBe("images");
  });

  it("accepts plural slugs", () => {
    expect(normalizeCreateTypeSlug("notes", catalog)).toBe("notes");
  });

  it("resolves custom slugs and names", () => {
    expect(normalizeCreateTypeSlug("runbooks", catalog)).toBe("runbooks");
    expect(normalizeCreateTypeSlug("Runbooks", catalog)).toBe("runbooks");
  });
});

describe("resolveDefaultCreateTypeSlug", () => {
  it("falls back to snippets for pro-gated image on free tier", () => {
    expect(resolveDefaultCreateTypeSlug("image", catalog, false)).toBe(
      "snippets",
    );
  });

  it("falls back when custom type on free tier", () => {
    expect(resolveDefaultCreateTypeSlug("runbooks", catalog, false)).toBe(
      "snippets",
    );
  });

  it("keeps custom slug for pro users", () => {
    expect(resolveDefaultCreateTypeSlug("runbooks", catalog, true)).toBe(
      "runbooks",
    );
  });
});

describe("toAiItemTypeName", () => {
  it("uses singular system names", () => {
    expect(
      toAiItemTypeName({
        slug: getTypeSlug("snippet"),
        name: "Snippet",
        isSystem: true,
        kind: "code",
      }),
    ).toBe("snippet");
  });

  it("maps custom kinds to AI representatives", () => {
    expect(
      toAiItemTypeName({
        slug: "runbooks",
        name: "Runbooks",
        isSystem: false,
        kind: "markdown",
      }),
    ).toBe("note");
  });
});
