import { describe, expect, it } from "vitest";

import {
  decodeApiV1ListCursor,
  encodeApiV1ListCursor,
  hashApiV1ListFilters,
} from "./item-cursors";

describe("api v1 list cursors", () => {
  it("round-trips keyset cursors", () => {
    const hash = hashApiV1ListFilters({ limit: 25 });
    const cursor = encodeApiV1ListCursor({
      k: "ks",
      id: "item-1",
      u: "2026-01-01T00:00:00.000Z",
      h: hash,
    });

    expect(decodeApiV1ListCursor(cursor)).toEqual({
      k: "ks",
      id: "item-1",
      u: "2026-01-01T00:00:00.000Z",
      h: hash,
    });
  });

  it("detects filter hash mismatches for search cursors", () => {
    const hash = hashApiV1ListFilters({
      limit: 25,
      q: "hello",
    });

    const cursor = encodeApiV1ListCursor({ k: "q", o: 25, h: hash });

    const decoded = decodeApiV1ListCursor(cursor);
    expect(decoded?.k).toBe("q");
    if (decoded?.k === "q") {
      expect(decoded.h).toBe(hash);
    }
  });
});
