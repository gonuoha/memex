import { describe, expect, it } from "vitest";

import type { MemexExportItem } from "@/lib/validations/export-import";

import {
  buildItemMarkdownFile,
  buildUniqueMarkdownFilenames,
  slugifyExportFilename,
} from "./markdown";

function sampleItem(overrides: Partial<MemexExportItem> = {}): MemexExportItem {
  return {
    type: "note",
    title: "Sample",
    description: null,
    content: "body",
    url: null,
    language: null,
    isFavorite: false,
    isPinned: false,
    tags: [],
    collections: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("slugifyExportFilename", () => {
  it("slugifies and prefixes reserved Windows names", () => {
    expect(slugifyExportFilename("CON")).toBe("_con");
    expect(slugifyExportFilename("Hello, World!")).toBe("hello-world");
  });
});

describe("buildUniqueMarkdownFilenames", () => {
  it("dedupes colliding titles including A, A, A 2", () => {
    const items = [
      sampleItem({ title: "A" }),
      sampleItem({ title: "A" }),
      sampleItem({ title: "A 2" }),
    ];

    const names = buildUniqueMarkdownFilenames(items);

    expect(names.get(items[0])).toBe("a.md");
    expect(names.get(items[1])).toBe("a-2.md");
    expect(names.get(items[2])).toBe("a-2-2.md");
  });
});

describe("buildItemMarkdownFile", () => {
  it("JSON-stringifies YAML string values", () => {
    const file = buildItemMarkdownFile(
      sampleItem({
        title: "Quote: \"hi\"",
        tags: ["a:b"],
        type: "snippet",
        content: "console.log(1)",
        language: "typescript",
      }),
    );

    expect(file).toContain('title: "Quote: \\"hi\\""');
    expect(file).toContain('  - "a:b"');
    expect(file).toContain('created: "2026-01-01T00:00:00.000Z"');
  });

  it("uses longer fences when content contains backticks", () => {
    const file = buildItemMarkdownFile(
      sampleItem({
        type: "command",
        content: "````\ncode\n````",
        language: "bash",
      }),
    );

    expect(file).toContain("`````bash");
  });
});
