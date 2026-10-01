import { describe, expect, it } from "vitest";

import {
  MAX_IMPORT_BYTES,
  readRequestBodyWithLimit,
  validateImportSecFetchSite,
} from "./parse-import-request";

describe("validateImportSecFetchSite", () => {
  it("allows same-origin and none", () => {
    expect(validateImportSecFetchSite("same-origin")).toBeNull();
    expect(validateImportSecFetchSite("none")).toBeNull();
    expect(validateImportSecFetchSite(null)).toBeNull();
  });

  it("denies cross-site", () => {
    expect(validateImportSecFetchSite("cross-site")).toEqual({
      kind: "sec_fetch_denied",
    });
  });
});

describe("readRequestBodyWithLimit", () => {
  it("returns too_large when stream exceeds limit", async () => {
    const oversized = new Uint8Array(MAX_IMPORT_BYTES + 64 * 1024 + 1);

    const request = new Request("http://local/import", {
      method: "POST",
      body: oversized,
    });

    const result = await readRequestBodyWithLimit(
      request,
      MAX_IMPORT_BYTES + 64 * 1024,
    );

    expect(result).toEqual({ kind: "too_large" });
  });
});
