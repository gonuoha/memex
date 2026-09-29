import { describe, expect, it } from "vitest";

import { registerRequestSchema } from "./register";

describe("registerRequestSchema", () => {
  it("accepts valid registration input", () => {
    const result = registerRequestSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password1",
      confirmPassword: "password1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects overly long names", () => {
    const result = registerRequestSchema.safeParse({
      name: "a".repeat(101),
      email: "jane@example.com",
      password: "password1",
      confirmPassword: "password1",
    });

    expect(result.success).toBe(false);
  });
});
