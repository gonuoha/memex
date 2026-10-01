import { describe, expect, it } from "vitest";

import type { ItemDetail } from "@/lib/db/items";

import { mergeApiV1ItemUpdate } from "./patch-item";

const existing: ItemDetail = {
  id: "item-1",
  title: "Old title",
  description: "desc",
  contentType: "text",
  content: "body",
  url: "https://example.com",
  language: "ts",
  fileUrl: null,
  fileName: null,
  fileSize: null,
  isFavorite: false,
  isPinned: false,
  type: { id: "t1", name: "link", icon: null, color: null },
  tags: ["a"],
  collections: [{ id: "c1", name: "Work" }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("mergeApiV1ItemUpdate", () => {
  it("merges only provided fields and keeps collections when omitted", () => {
    const merged = mergeApiV1ItemUpdate(
      existing,
      { title: "New title" },
      { title: "New title" },
    );

    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.data.title).toBe("New title");
      expect(merged.data.tags).toEqual(["a"]);
      expect(merged.data.collectionIds).toEqual(["c1"]);
      expect(merged.data.url).toBe("https://example.com");
    }
  });

  it("requires url for link items when url is cleared", () => {
    const merged = mergeApiV1ItemUpdate(
      existing,
      { url: null },
      { url: null },
    );

    expect(merged.ok).toBe(false);
  });
});
