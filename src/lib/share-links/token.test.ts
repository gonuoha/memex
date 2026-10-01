import { describe, expect, it } from "vitest";

import {
  generateShareLinkToken,
  isValidShareLinkTokenFormat,
} from "./token";

describe("share link token", () => {
  it("generates base64url tokens of expected length", () => {
    const token = generateShareLinkToken();

    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(isValidShareLinkTokenFormat(token)).toBe(true);
  });

  it("rejects malformed tokens", () => {
    expect(isValidShareLinkTokenFormat("short")).toBe(false);
    expect(isValidShareLinkTokenFormat("has+invalid/chars!!!!")).toBe(false);
  });
});
