import { describe, expect, it } from "vitest";

import {
  importItemInputSchema,
  isExportArrayCapExceeded,
  memexExportSchema,
} from "./export-import";

describe("memexExportSchema", () => {
  it("accepts version 1 export shape", () => {
    const parsed = memexExportSchema.safeParse({
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      items: [
        {
          type: "snippet",
          title: "Hello",
          description: null,
          content: "code",
          url: null,
          language: "ts",
          isFavorite: false,
          isPinned: false,
          tags: ["a"],
          collections: ["Work"],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      collections: [
        {
          name: "Work",
          description: null,
          isFavorite: false,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unknown versions", () => {
    const parsed = memexExportSchema.safeParse({
      version: 2,
      exportedAt: "2026-01-01T00:00:00.000Z",
      items: [],
      collections: [],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("importItemInputSchema", () => {
  it("rejects javascript URLs", () => {
    const parsed = importItemInputSchema.safeParse({
      type: "link",
      title: "X",
      url: "javascript:alert(1)",
      tags: [],
      collections: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("requires url for link items", () => {
    const parsed = importItemInputSchema.safeParse({
      type: "link",
      title: "X",
      url: null,
      tags: [],
      collections: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("dedupes tags case-insensitively", () => {
    const parsed = importItemInputSchema.safeParse({
      type: "note",
      title: "X",
      tags: ["React", "react", "REACT"],
      collections: [],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tags).toEqual(["React"]);
    }
  });
});

describe("isExportArrayCapExceeded", () => {
  it("detects oversized arrays before schema parse", () => {
    expect(
      isExportArrayCapExceeded({
        version: 1,
        exportedAt: "x",
        items: Array.from({ length: 10_001 }, () => ({})),
        collections: [],
      }),
    ).toBe(true);
  });
});
