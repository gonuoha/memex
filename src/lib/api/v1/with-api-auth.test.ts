import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-keys", () => ({
  authenticateApiKey: vi.fn(),
}));

vi.mock("@/lib/db/api-keys", () => ({
  touchApiKeyLastUsedAtConditional: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  API_V1_RATE_LIMIT: 120,
  checkApiV1RateLimit: vi.fn(),
  buildRateLimitHeaders: vi.fn((result: { success: boolean }) => ({
    "X-RateLimit-Limit": "120",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": "1",
    ...(result.success ? {} : { "Retry-After": "30" }),
  })),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (callback: () => void) => callback(),
  };
});

import { authenticateApiKey } from "@/lib/api-keys";
import { checkApiV1RateLimit } from "@/lib/rate-limit";

import { withApiAuth } from "./with-api-auth";

const mockAuthenticate = vi.mocked(authenticateApiKey);
const mockRateLimit = vi.mocked(checkApiV1RateLimit);

describe("withApiAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true, remaining: 119, reset: 1 });
  });

  it("returns 401 without bearer auth", async () => {
    mockAuthenticate.mockResolvedValue({ success: false, code: "missing" });

    const handler = withApiAuth(async () => new Response(JSON.stringify({ ok: true })));
    const response = await handler(new Request("https://memex.test/api/v1/items"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 429 when rate limited", async () => {
    mockAuthenticate.mockResolvedValue({
      success: true,
      userId: "user-1",
      keyId: "key-1",
    });
    mockRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const handler = withApiAuth(async () => new Response("{}"));
    const response = await handler(new Request("https://memex.test"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns JSON 500 when authentication throws", async () => {
    mockAuthenticate.mockRejectedValue(new Error("auth boom"));

    const handler = withApiAuth(async () => new Response("{}"));
    const response = await handler(new Request("https://memex.test"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns JSON 500 when handler throws", async () => {
    mockAuthenticate.mockResolvedValue({
      success: true,
      userId: "user-1",
      keyId: "key-1",
    });

    const handler = withApiAuth(async () => {
      throw new Error("boom");
    });

    const response = await handler(new Request("https://memex.test"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("internal_error");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
