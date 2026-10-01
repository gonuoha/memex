import { describe, expect, it } from "vitest";

import {
  encodeTagNameForPath,
  renameTagSchema,
  tagNameSchema,
} from "@/lib/validations/tags";

describe("tagNameSchema", () => {
  it("trims and validates length", () => {
    expect(tagNameSchema.parse("  react  ")).toBe("react");
    expect(tagNameSchema.safeParse("").success).toBe(false);
    expect(tagNameSchema.safeParse("x".repeat(41)).success).toBe(false);
  });

  it("rejects commas", () => {
    expect(tagNameSchema.safeParse("a,b").success).toBe(false);
  });
});

describe("renameTagSchema", () => {
  it("requires tag id and name", () => {
    expect(
      renameTagSchema.safeParse({ tagId: "tag-1", name: "api" }).success,
    ).toBe(true);
  });
});

describe("encodeTagNameForPath", () => {
  it("encodes spaces for URLs", () => {
    const name = "c++ tips";
    expect(encodeTagNameForPath(name)).toBe(encodeURIComponent(name));
  });
});
