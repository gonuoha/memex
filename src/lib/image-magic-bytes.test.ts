import { describe, expect, it } from "vitest";

import {
  detectImageFormat,
  imageMimeMatchesMagicBytes,
} from "./image-magic-bytes";

describe("image-magic-bytes", () => {
  it("detects png signatures", () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);

    expect(detectImageFormat(buffer)).toBe("png");
    expect(imageMimeMatchesMagicBytes("image/png", buffer)).toBe(true);
  });

  it("detects jpeg signatures", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

    expect(detectImageFormat(buffer)).toBe("jpeg");
    expect(imageMimeMatchesMagicBytes("image/jpeg", buffer)).toBe(true);
  });

  it("rejects mismatched mime and bytes", () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);

    expect(imageMimeMatchesMagicBytes("image/jpeg", buffer)).toBe(false);
  });
});
