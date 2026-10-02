import { describe, expect, it } from "vitest";

import type { ItemDetail } from "@/lib/db/items";

import { serializeApiV1Item } from "./serialize";

const item: ItemDetail = {
  id: "item-1",
  title: "Title",
  description: null,
  contentType: "text",
  content: "body",
  url: null,
  language: "ts",
  fileUrl: null,
  fileName: null,
  fileSize: null,
  isFavorite: true,
  isPinned: false,
  type: { id: "t1", name: "Snippet", kind: "code", slug: null, isSystem: true, icon: null, color: null },
  tags: ["api"],
  collections: [{ id: "c1", name: "Work" }],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("serializeApiV1Item", () => {
  it("returns a public DTO without internal fields", () => {
    const serialized = serializeApiV1Item(item);

    expect(serialized).toEqual({
      id: "item-1",
      type: "snippet",
      title: "Title",
      description: null,
      content: "body",
      url: null,
      language: "ts",
      tags: ["api"],
      collections: [{ id: "c1", name: "Work" }],
      isFavorite: true,
      isPinned: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(serialized).not.toHaveProperty("fileUrl");
    expect(serialized).not.toHaveProperty("userId");
  });
});
