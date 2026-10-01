import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import type { RateLimitResult } from "@/lib/rate-limit";

const FAIL_OPEN_RESULT: RateLimitResult = {
  success: true,
  remaining: -1,
  reset: 0,
};

function failClosedResult(): RateLimitResult {
  return {
    success: false,
    remaining: 0,
    reset: Date.now() + 60_000,
  };
}

function isRateLimitConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function shouldFailClosedOnMissingRedis(): boolean {
  return process.env.NODE_ENV === "production";
}

function createRedis(): Redis | null {
  if (!isRateLimitConfigured()) {
    return null;
  }

  return Redis.fromEnv();
}

function createLimiter(
  prefix: string,
  requests: number,
  window: Duration,
): Ratelimit | null {
  const redis = createRedis();

  if (!redis) {
    return null;
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `ratelimit:${prefix}`,
  });
}

async function checkUserLimiter(
  limiter: Ratelimit | null,
  userId: string,
): Promise<RateLimitResult> {
  if (!limiter) {
    if (shouldFailClosedOnMissingRedis()) {
      console.error("Rate limit unavailable in production; failing closed");
      return failClosedResult();
    }

    return FAIL_OPEN_RESULT;
  }

  try {
    const result = await limiter.limit(userId);

    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return FAIL_OPEN_RESULT;
  }
}

const shareLinkCreateLimiter = createLimiter("share-link-create", 30, "1 h");
const exportLimiter = createLimiter("data-export", 10, "1 h");
const importLimiter = createLimiter("data-import", 5, "1 h");

export async function checkShareLinkCreateRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkUserLimiter(shareLinkCreateLimiter, userId);
}

export async function checkDataExportRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkUserLimiter(exportLimiter, userId);
}

export async function checkDataImportRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkUserLimiter(importLimiter, userId);
}
