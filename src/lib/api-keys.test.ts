import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/api-keys", () => ({
  findApiKeyByHash: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  recordApiV1AuthFailure: vi.fn(),
}));

import { findApiKeyByHash } from "@/lib/db/api-keys";
import { recordApiV1AuthFailure } from "@/lib/rate-limit";

import {
  API_KEY_FORMAT,
  authenticateApiKey,
  generateApiKeyPlaintext,
  getApiKeyPrefix,
  hashApiKey,
  isApiKeyFormatValid,
  parseBearerApiKey,
} from "./api-keys";

const mockFindApiKeyByHash = vi.mocked(findApiKeyByHash);
const mockRecordFailure = vi.mocked(recordApiV1AuthFailure);

describe("api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordFailure.mockResolvedValue({
      success: true,
      remaining: 10,
      reset: Date.now() + 60_000,
    });
  });

  it("generates keys matching the strict format", () => {
    const key = generateApiKeyPlaintext();

    expect(API_KEY_FORMAT.test(key)).toBe(true);
    expect(getApiKeyPrefix(key)).toBe(key.slice(0, 12));
    expect(hashApiKey(key)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects malformed bearer tokens without recording failures", async () => {
    const request = new Request("https://memex.test", {
      headers: { Authorization: "Bearer mx_short" },
    });

    expect(isApiKeyFormatValid("mx_short")).toBe(false);
    expect(parseBearerApiKey(request)).toBeNull();

    const result = await authenticateApiKey(request);

    expect(result.success).toBe(false);
    expect(mockFindApiKeyByHash).not.toHaveBeenCalled();
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });

  it("authenticates valid pro keys even when the IP failure budget is exhausted", async () => {
    const key = generateApiKeyPlaintext();
    mockFindApiKeyByHash.mockResolvedValue({
      id: "key-1",
      userId: "user-1",
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      user: { isPro: true },
    });
    mockRecordFailure.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const request = new Request("https://memex.test", {
      headers: { Authorization: `Bearer ${key}` },
    });

    const result = await authenticateApiKey(request);

    expect(result).toEqual({
      success: true,
      userId: "user-1",
      keyId: "key-1",
    });
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });

  it("records failures only for unknown keys", async () => {
    const key = generateApiKeyPlaintext();
    mockFindApiKeyByHash.mockResolvedValue(null);

    const request = new Request("https://memex.test", {
      headers: { Authorization: `Bearer ${key}` },
    });

    const result = await authenticateApiKey(request);

    expect(result.success).toBe(false);
    expect(mockRecordFailure).toHaveBeenCalledWith(request);
  });

  it("returns auth_rate_limited when failure budget is exceeded", async () => {
    const key = generateApiKeyPlaintext();
    mockFindApiKeyByHash.mockResolvedValue(null);
    mockRecordFailure.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 45_000,
    });

    const request = new Request("https://memex.test", {
      headers: { Authorization: `Bearer ${key}` },
    });

    const result = await authenticateApiKey(request);

    expect(result).toEqual({
      success: false,
      code: "auth_rate_limited",
      rateLimit: {
        success: false,
        remaining: 0,
        reset: expect.any(Number),
      },
    });
  });
});
