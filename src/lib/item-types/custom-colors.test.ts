import { describe, expect, it } from "vitest";

import { getCustomTypeColorLabel } from "./custom-colors";

describe("custom type colors", () => {
  it("provides human-readable color names for aria labels", () => {
    expect(getCustomTypeColorLabel("#6366F1")).toBe("Indigo");
    expect(getCustomTypeColorLabel("#64748B")).toBe("Slate");
  });
});
