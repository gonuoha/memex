import { describe, expect, it } from "vitest";

import { isValidEmail, normalizeEmail } from "./validate-email";

describe("validate-email", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("validates normalized emails", () => {
    expect(isValidEmail("  user@example.com ")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});
