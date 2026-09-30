import { describe, expect, it } from "vitest";

import { parseSearchQueryParams } from "./search";

describe("parseSearchQueryParams", () => {
  it("applies defaults", () => {
    const result = parseSearchQueryParams(new URLSearchParams());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({ q: "", limit: 20 });
    }
  });

  it("rejects queries over 200 characters", () => {
    const result = parseSearchQueryParams(
      new URLSearchParams({ q: "a".repeat(201) }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects limits above 20", () => {
    const result = parseSearchQueryParams(
      new URLSearchParams({ limit: "25" }),
    );

    expect(result.success).toBe(false);
  });
});
