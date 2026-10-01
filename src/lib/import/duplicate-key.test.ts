import { describe, expect, it } from "vitest";

import {
  buildItemDuplicateKey,
  duplicateKeyFromExportItem,
} from "./duplicate-key";

describe("duplicate keys", () => {
  it("uses url for links", () => {
    expect(
      buildItemDuplicateKey("link", "Docs", null, "https://example.com"),
    ).toBe("link\0Docs\0https://example.com");
  });

  it("uses content for text types", () => {
    const item = {
      type: "snippet" as const,
      title: "T",
      description: null,
      content: "body",
      url: null,
      language: null,
      isFavorite: false,
      isPinned: false,
      tags: [],
      collections: [],
      createdAt: "",
      updatedAt: "",
    };

    expect(duplicateKeyFromExportItem(item)).toBe("snippet\0T\0body");
  });
});
