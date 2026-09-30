import { describe, expect, it } from "vitest";

import {
  daysUntilPermanentDeletion,
  getTrashPurgeDeadline,
} from "./trash-retention";

describe("trash helpers", () => {
  it("computes purge deadline 30 days in the past", () => {
    const deadline = getTrashPurgeDeadline();
    const expected = new Date();
    expected.setUTCDate(expected.getUTCDate() - 30);

    expect(Math.abs(deadline.getTime() - expected.getTime())).toBeLessThan(
      1000,
    );
  });

  it("returns remaining days until permanent deletion", () => {
    const deletedAt = new Date();
    deletedAt.setUTCDate(deletedAt.getUTCDate() - 10);

    expect(daysUntilPermanentDeletion(deletedAt)).toBe(20);
  });
});
