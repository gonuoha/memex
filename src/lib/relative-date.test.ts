import { describe, expect, it } from "vitest";

import { formatRelativeDate } from "./relative-date";

describe("formatRelativeDate", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  it("formats sub-day deltas", () => {
    expect(
      formatRelativeDate(new Date("2026-10-01T11:30:00.000Z"), now),
    ).toBe("30m ago");
    expect(
      formatRelativeDate(new Date("2026-09-28T12:00:00.000Z"), now),
    ).toBe("3d ago");
  });

  it("handles just now", () => {
    expect(formatRelativeDate(now, now)).toBe("just now");
  });
});
