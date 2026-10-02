import { describe, expect, it } from "vitest";

import { isShareableItemTypeKind } from "./constants";

describe("share link type kinds", () => {
  it("allows code, markdown, and link kinds", () => {
    expect(isShareableItemTypeKind("code")).toBe(true);
    expect(isShareableItemTypeKind("markdown")).toBe(true);
    expect(isShareableItemTypeKind("link")).toBe(true);
  });

  it("disallows file and image kinds", () => {
    expect(isShareableItemTypeKind("file")).toBe(false);
    expect(isShareableItemTypeKind("image")).toBe(false);
  });
});
