import { describe, expect, it } from "vitest";

import { getPasswordByteLength, passwordSchema } from "./password";

describe("passwordSchema", () => {
  it("accepts a valid password", () => {
    expect(passwordSchema.safeParse("password1").success).toBe(true);
  });

  it("rejects short passwords", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });

  it("rejects passwords longer than 72 bytes", () => {
    const password = "a".repeat(73);

    expect(getPasswordByteLength(password)).toBe(73);
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });
});
