import { describe, expect, it } from "vitest";

import { buildItemListPreview, stripSimpleMarkdown } from "./item-preview";

describe("item-preview", () => {
  it("strips simple markdown", () => {
    expect(stripSimpleMarkdown("## Hello **world**")).toBe("Hello world");
  });

  it("builds command preview with dollar prefix", () => {
    expect(
      buildItemListPreview({
        typeName: "command",
        description: null,
        contentExcerpt: "npm test",
        url: null,
        fileName: null,
      }),
    ).toBe("$ npm test");
  });

  it("builds link preview from hostname and path", () => {
    expect(
      buildItemListPreview({
        typeName: "link",
        description: null,
        contentExcerpt: null,
        url: "https://example.com/docs/guide",
        fileName: null,
      }),
    ).toBe("example.com/docs/guide");
  });

  it("keeps the first lines of a snippet with indentation", () => {
    expect(
      buildItemListPreview({
        typeName: "snippet",
        description: null,
        contentExcerpt: "\nservices:\n  db:\n    image: postgres\n    ports:\n      - 5432",
        url: null,
        fileName: null,
      }),
    ).toBe("services:\n  db:\n    image: postgres\n    ports:");
  });
});
