import { describe, expect, it } from "vitest";

import { isSafeHttpUrl } from "./safe-url";

describe("isSafeHttpUrl", () => {
  it("allows http and https", () => {
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("http://example.com/path")).toBe(true);
  });

  it("rejects javascript and other schemes", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("not-a-url")).toBe(false);
  });
});
