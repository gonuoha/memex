import { describe, expect, it } from "vitest";

import { sanitizeCallbackUrl } from "./sanitize-callback-url";

describe("sanitizeCallbackUrl", () => {
  it("defaults missing values to dashboard", () => {
    expect(sanitizeCallbackUrl(undefined)).toBe("/dashboard");
    expect(sanitizeCallbackUrl(null)).toBe("/dashboard");
  });

  it("allows same-origin relative paths", () => {
    expect(sanitizeCallbackUrl("/items/snippet")).toBe("/items/snippet");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(sanitizeCallbackUrl("//evil.example")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("https://evil.example")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("/\\evil")).toBe("/dashboard");
  });

  it("rejects control characters that browsers strip into protocol-relative URLs", () => {
    expect(sanitizeCallbackUrl("/\t/evil.example")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("/\n/evil.example")).toBe("/dashboard");
  });
});
