import { describe, expect, it } from "vitest";

import { createApiKeySchema } from "./api-keys";

describe("createApiKeySchema", () => {
  it("accepts a name and optional expiry", () => {
    expect(createApiKeySchema.safeParse({ name: "CI" }).success).toBe(true);
    expect(
      createApiKeySchema.safeParse({ name: "CI", expiresInDays: 30 }).success,
    ).toBe(true);
  });

  it("rejects empty names", () => {
    expect(createApiKeySchema.safeParse({ name: "" }).success).toBe(false);
  });
});
