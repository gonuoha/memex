import { describe, expect, it } from "vitest";

import {
  getPasswordByteLength,
  getPasswordPolicyError,
  passwordSchema,
} from "./password";

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

  it("counts multi-byte characters toward the 72 byte limit", () => {
    expect(getPasswordPolicyError("é".repeat(37))).toBe(
      "Password must be at most 72 bytes",
    );
    expect(getPasswordPolicyError("é".repeat(36))).toBeNull();
  });
});
