import { describe, expect, it } from "vitest";

import { parseApiV1ListItemsQuery } from "@/lib/validations/api-v1";

describe("api v1 list type resolution contract", () => {
  it("accepts custom-looking slugs at validation time", () => {
    const parsed = parseApiV1ListItemsQuery(
      new URLSearchParams({ type: "someone-elses-slug" }),
    );

    expect(parsed.success).toBe(true);
  });
});
