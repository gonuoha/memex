import { describe, expect, it } from "vitest";

import {
  apiV1CreateItemSchema,
  apiV1UpdateItemSchema,
  parseApiV1ListItemsQuery,
} from "./api-v1";

describe("api v1 validations", () => {
  it("parses list query defaults", () => {
    const parsed = parseApiV1ListItemsQuery(new URLSearchParams());

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
    }
  });

  it("rejects unknown list type slugs", () => {
    const result = parseApiV1ListItemsQuery(
      new URLSearchParams({ type: "not-a-real-type!" }),
    );

    expect(result.success).toBe(false);
  });

  it("accepts system aliases in list type filter", () => {
    const result = parseApiV1ListItemsQuery(
      new URLSearchParams({ type: "notes" }),
    );

    expect(result.success).toBe(true);
  });

  it("allows file type in schema for server-side rejection", () => {
    const result = apiV1CreateItemSchema.safeParse({
      type: "file",
      title: "x",
      fileUrl: "k",
      fileName: "a",
      fileSize: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown fields on patch", () => {
    const result = apiV1UpdateItemSchema.safeParse({
      title: "x",
      extra: true,
    });

    expect(result.success).toBe(false);
  });
});
