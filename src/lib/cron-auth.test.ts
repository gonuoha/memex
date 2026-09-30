import { describe, expect, it } from "vitest";

import { verifyCronBearer } from "./cron-auth";

describe("verifyCronBearer", () => {
  it("returns missing_secret when CRON_SECRET is unset", () => {
    expect(verifyCronBearer("Bearer secret", undefined)).toBe("missing_secret");
  });

  it("returns unauthorized for invalid bearer tokens", () => {
    expect(verifyCronBearer("Bearer wrong", "expected")).toBe("unauthorized");
    expect(verifyCronBearer(null, "expected")).toBe("unauthorized");
    expect(verifyCronBearer("expected", "expected")).toBe("unauthorized");
    expect(verifyCronBearer("Bearer expected-longer", "expected")).toBe(
      "unauthorized",
    );
  });

  it("returns missing_secret when CRON_SECRET is empty", () => {
    expect(verifyCronBearer("Bearer ", "")).toBe("missing_secret");
  });

  it("returns ok for a matching bearer token", () => {
    expect(verifyCronBearer("Bearer expected", "expected")).toBe("ok");
  });
});
