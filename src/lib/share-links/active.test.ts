import { describe, expect, it } from "vitest";

import {
  expiresAtFromDays,
  isShareLinkActive,
} from "./active";

describe("isShareLinkActive", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  it("returns false when revoked", () => {
    expect(
      isShareLinkActive(
        { revokedAt: now, expiresAt: null },
        now,
      ),
    ).toBe(false);
  });

  it("returns false when expired", () => {
    expect(
      isShareLinkActive(
        {
          revokedAt: null,
          expiresAt: new Date("2026-01-14T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("returns true when active without expiry", () => {
    expect(
      isShareLinkActive({ revokedAt: null, expiresAt: null }, now),
    ).toBe(true);
  });
});

describe("expiresAtFromDays", () => {
  it("returns null for never expires", () => {
    expect(expiresAtFromDays(null)).toBeNull();
  });

  it("adds days in UTC", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const expires = expiresAtFromDays(7, from);

    expect(expires?.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
});
