import { describe, expect, it } from "vitest";

import {
  buildContentDispositionHeader,
  isInlineSafeContentType,
  resolveContentDisposition,
  resolveDownloadContentType,
} from "./file-download";

describe("file-download", () => {
  describe("isInlineSafeContentType", () => {
    it("allows safe image and document types", () => {
      expect(isInlineSafeContentType("image/png")).toBe(true);
      expect(isInlineSafeContentType("image/jpeg")).toBe(true);
      expect(isInlineSafeContentType("application/pdf")).toBe(true);
      expect(isInlineSafeContentType("text/plain")).toBe(true);
    });

    it("rejects svg and unknown types", () => {
      expect(isInlineSafeContentType("image/svg+xml")).toBe(false);
      expect(isInlineSafeContentType("application/octet-stream")).toBe(false);
    });

    it("rejects xml and text markup types for inline serving", () => {
      expect(isInlineSafeContentType("application/xml")).toBe(false);
      expect(isInlineSafeContentType("text/xml")).toBe(false);
      expect(resolveContentDisposition("application/xml", false)).toBe(
        "attachment",
      );
    });
  });

  describe("resolveContentDisposition", () => {
    it("uses inline for safe types when not forced", () => {
      expect(resolveContentDisposition("image/png", false)).toBe("inline");
    });

    it("forces attachment for unsafe types", () => {
      expect(resolveContentDisposition("image/svg+xml", false)).toBe(
        "attachment",
      );
    });

    it("forces attachment when download is requested", () => {
      expect(resolveContentDisposition("image/png", true)).toBe("attachment");
    });
  });

  describe("resolveDownloadContentType", () => {
    it("forces utf-8 for inline plain text", () => {
      expect(resolveDownloadContentType("text/plain", "inline")).toBe(
        "text/plain; charset=utf-8",
      );
    });

    it("keeps attachment content types unchanged", () => {
      expect(resolveDownloadContentType("text/markdown", "attachment")).toBe(
        "text/markdown",
      );
    });

    it("keeps binary content types unchanged", () => {
      expect(resolveDownloadContentType("image/png", "inline")).toBe("image/png");
    });
  });

  describe("buildContentDispositionHeader", () => {
    it("builds RFC 5987 disposition with ascii fallback", () => {
      expect(
        buildContentDispositionHeader("attachment", "résumé.pdf"),
      ).toBe(
        'attachment; filename="r_sum_.pdf"; filename*=UTF-8\'\'r%C3%A9sum%C3%A9.pdf',
      );
    });

    it("percent-encodes characters outside the RFC 5987 attr-char set", () => {
      expect(
        buildContentDispositionHeader("inline", "it's (final)*.txt"),
      ).toBe(
        'inline; filename="it\'s (final)*.txt"; filename*=UTF-8\'\'it%27s%20%28final%29%2A.txt',
      );
    });
  });
});
