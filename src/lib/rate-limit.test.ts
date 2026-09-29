import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadRateLimit() {
  vi.resetModules();
  return import("./rate-limit");
}

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://memex.test/api/auth/login", { headers });
}

describe("rate-limit", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUST_PROXY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("getClientIp", () => {
    it("ignores forwarding headers when no trusted proxy is configured", async () => {
      const { getClientIp } = await loadRateLimit();

      const ip = getClientIp(
        requestWithHeaders({
          "x-vercel-forwarded-for": "1.1.1.1",
          "x-real-ip": "2.2.2.2",
          "x-forwarded-for": "3.3.3.3",
        }),
      );

      expect(ip).toBe("unknown");
    });

    it("uses the Vercel client IP header on Vercel", async () => {
      vi.stubEnv("VERCEL", "1");
      const { getClientIp } = await loadRateLimit();

      const ip = getClientIp(
        requestWithHeaders({
          "x-vercel-forwarded-for": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1",
        }),
      );

      expect(ip).toBe("203.0.113.7");
    });

    it("uses the last x-forwarded-for hop behind a trusted proxy", async () => {
      vi.stubEnv("TRUST_PROXY", "true");
      const { getClientIp } = await loadRateLimit();

      const ip = getClientIp(
        requestWithHeaders({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }),
      );

      expect(ip).toBe("203.0.113.9");
    });
  });

  describe("checkAiRateLimit without Redis", () => {
    it("fails closed in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { checkAiRateLimit } = await loadRateLimit();

      const result = await checkAiRateLimit("user-1");

      expect(result.success).toBe(false);
    });

    it("fails open outside production", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const { checkAiRateLimit } = await loadRateLimit();

      const result = await checkAiRateLimit("user-1");

      expect(result.success).toBe(true);
    });
  });
});
