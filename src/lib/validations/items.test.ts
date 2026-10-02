import { describe, expect, it } from "vitest";

import {
  createItemSchema,
  parseCreatableItemTypeFromPathname,
  resolveDefaultCreateType,
} from "./items";

describe("createItemSchema", () => {
  it("accepts a valid snippet payload", () => {
    const result = createItemSchema.safeParse({
      type: "snippet",
      title: "My snippet",
      content: "console.log('hi')",
      language: "javascript",
      tags: ["js"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = createItemSchema.safeParse({
      type: "snippet",
      title: "   ",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Title is required");
  });

  it("requires a file upload for image items", () => {
    const result = createItemSchema.safeParse({
      type: "image",
      title: "Screenshot",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("File upload is required");
  });

  it("accepts an image item with upload metadata", () => {
    const result = createItemSchema.safeParse({
      type: "image",
      title: "Screenshot",
      fileUrl: "users/user-1/key/photo.png",
      fileName: "photo.png",
      fileSize: 1024,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a file item with upload metadata", () => {
    const result = createItemSchema.safeParse({
      type: "file",
      title: "Notes",
      fileUrl: "users/user-1/key/notes.pdf",
      fileName: "notes.pdf",
      fileSize: 2048,
    });

    expect(result.success).toBe(true);
  });

  it("requires a URL for link items", () => {
    const result = createItemSchema.safeParse({
      type: "link",
      title: "My link",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("URL is required");
  });

  it("accepts a link item with a valid URL", () => {
    const result = createItemSchema.safeParse({
      type: "link",
      title: "My link",
      url: "https://example.com",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid URL", () => {
    const result = createItemSchema.safeParse({
      type: "link",
      title: "My link",
      url: "not-a-url",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a valid URL");
  });

  it("converts blank optional strings to null", () => {
    const result = createItemSchema.safeParse({
      type: "note",
      title: "Note",
      description: "  ",
      content: "",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.description).toBeNull();
      expect(result.data.content).toBeNull();
    }
  });

  it("defaults tags to an empty array", () => {
    const result = createItemSchema.safeParse({
      type: "prompt",
      title: "Prompt",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("defaults collectionIds to an empty array", () => {
    const result = createItemSchema.safeParse({
      type: "prompt",
      title: "Prompt",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.collectionIds).toEqual([]);
    }
  });

  it("rejects non-http(s) URLs", () => {
    const result = createItemSchema.safeParse({
      type: "link",
      title: "My link",
      url: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
  });

  it("deduplicates tags case-insensitively", () => {
    const result = createItemSchema.safeParse({
      type: "snippet",
      title: "Snippet",
      tags: ["API", "api", "Docs"],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.tags).toEqual(["API", "Docs"]);
    }
  });

  it("accepts collectionIds in create payloads", () => {
    const result = createItemSchema.safeParse({
      type: "snippet",
      title: "Snippet",
      collectionIds: ["collection-1", "collection-2"],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.collectionIds).toEqual([
        "collection-1",
        "collection-2",
      ]);
    }
  });
});

describe("parseCreatableItemTypeFromPathname", () => {
  it("returns the item type slug from an items page path", () => {
    expect(parseCreatableItemTypeFromPathname("/items/prompt")).toBe("prompt");
    expect(parseCreatableItemTypeFromPathname("/items/prompts")).toBe("prompts");
    expect(parseCreatableItemTypeFromPathname("/items/links")).toBe("links");
  });

  it("returns undefined for non-item paths", () => {
    expect(parseCreatableItemTypeFromPathname("/dashboard")).toBeUndefined();
    expect(parseCreatableItemTypeFromPathname("/items")).toBeUndefined();
    expect(parseCreatableItemTypeFromPathname("/items/prompt/extra")).toBeUndefined();
  });
});

describe("resolveDefaultCreateType", () => {
  it("falls back to snippet when no default is provided", () => {
    expect(resolveDefaultCreateType(undefined, false)).toBe("snippet");
  });

  it("uses the page type when provided", () => {
    expect(resolveDefaultCreateType("note", false)).toBe("note");
  });

  it("falls back to snippet for file and image types on free plans", () => {
    expect(resolveDefaultCreateType("file", false)).toBe("snippet");
    expect(resolveDefaultCreateType("image", false)).toBe("snippet");
    expect(resolveDefaultCreateType("file", true)).toBe("file");
    expect(resolveDefaultCreateType("image", true)).toBe("image");
  });
});
