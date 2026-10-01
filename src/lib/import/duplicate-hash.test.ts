import { describe, expect, it } from "vitest";

import { buildImportDuplicateFingerprint } from "./duplicate-fingerprint";

describe("buildImportDuplicateFingerprint", () => {
  it("normalizes title case", () => {
    const a = buildImportDuplicateFingerprint(
      "snippet",
      " Hello ",
      "body",
      null,
    );
    const b = buildImportDuplicateFingerprint(
      "snippet",
      "hello",
      "body",
      null,
    );

    expect(a).toBe(b);
  });

  it("includes url for links", () => {
    const fingerprint = buildImportDuplicateFingerprint(
      "link",
      "Docs",
      null,
      "https://example.com",
    );

    expect(fingerprint).toContain("https://example.com");
  });
});
