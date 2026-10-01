import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

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

function createLimiter(prefix: string, requests: number, window: Duration): Ratelimit | null {
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

const loginLimiter = createLimiter("login", 5, "15 m");
const registerLimiter = createLimiter("register", 3, "1 h");
const forgotPasswordLimiter = createLimiter("forgot-password", 3, "1 h");
const resetPasswordLimiter = createLimiter("reset-password", 5, "15 m");
const resendVerificationLimiter = createLimiter("resend-verification", 3, "15 m");
const changePasswordLimiter = createLimiter("change-password", 5, "15 m");
const accountDeletionLimiter = createLimiter("account-deletion", 3, "1 h");
const aiLimiter = createLimiter("ai", 20, "1 h");
const searchLimiter = createLimiter("search", 120, "1 m");
const uploadUrlLimiter = createLimiter("upload-url", 60, "1 m");
const apiKeyCreateLimiter = createLimiter("api-key-create", 10, "1 h");
export const API_V1_RATE_LIMIT = 120;
const apiV1Limiter = createLimiter("api-v1", API_V1_RATE_LIMIT, "1 m");

const AUTH_FAIL_KEY_PREFIX = "api-v1-auth-fail-count:";
const AUTH_FAIL_MAX_ATTEMPTS = 30;
const AUTH_FAIL_WINDOW_SECONDS = 60;

function parseHops(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
}

/**
 * Forwarding headers are client-controlled unless a proxy we trust overwrites
 * them: Vercel sets `x-vercel-forwarded-for`/`x-real-ip` to the client IP, and
 * a trusted reverse proxy (TRUST_PROXY) appends the client as the last XFF hop.
 */
export function getClientIp(request: Request): string {
  const { headers } = request;

  if (process.env.VERCEL === "1") {
    return (
      parseHops(headers.get("x-vercel-forwarded-for"))[0] ??
      parseHops(headers.get("x-real-ip"))[0] ??
      "unknown"
    );
  }

  if (process.env.TRUST_PROXY === "true") {
    return (
      parseHops(headers.get("x-real-ip"))[0] ??
      parseHops(headers.get("x-forwarded-for")).at(-1) ??
      "unknown"
    );
  }

  return "unknown";
}

function buildIdentifier(ip: string, email?: string): string {
  if (email) {
    return `${ip}:${email.toLowerCase()}`;
  }

  return ip;
}

async function checkLimiter(
  limiter: Ratelimit | null,
  identifier: string,
  options?: { failClosed?: boolean },
): Promise<RateLimitResult> {
  const failClosed = options?.failClosed ?? false;

  if (!limiter) {
    if (failClosed && shouldFailClosedOnMissingRedis()) {
      console.error("Rate limit unavailable in production; failing closed");
      return failClosedResult();
    }

    return FAIL_OPEN_RESULT;
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);

    if (failClosed) {
      return failClosedResult();
    }

    return FAIL_OPEN_RESULT;
  }
}

export async function checkLoginRateLimit(
  request: Request,
  email?: string,
): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  return checkLimiter(loginLimiter, buildIdentifier(ip, email));
}

export async function checkRegisterRateLimit(request: Request): Promise<RateLimitResult> {
  return checkLimiter(registerLimiter, getClientIp(request));
}

export async function checkForgotPasswordRateLimit(
  request: Request,
): Promise<RateLimitResult> {
  return checkLimiter(forgotPasswordLimiter, getClientIp(request));
}

export async function checkResetPasswordRateLimit(
  request: Request,
): Promise<RateLimitResult> {
  return checkLimiter(resetPasswordLimiter, getClientIp(request));
}

export async function checkResendVerificationRateLimit(
  request: Request,
  email: string,
): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  return checkLimiter(resendVerificationLimiter, buildIdentifier(ip, email));
}

export async function checkChangePasswordRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimiter(changePasswordLimiter, userId);
}

export async function checkAccountDeletionRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimiter(accountDeletionLimiter, userId);
}

export async function checkAiRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimiter(aiLimiter, userId, { failClosed: true });
}

export async function checkSearchRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimiter(searchLimiter, userId);
}

export async function checkUploadUrlRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimiter(uploadUrlLimiter, userId);
}

export async function checkApiKeyCreateRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimiter(apiKeyCreateLimiter, userId);
}

export async function checkApiV1RateLimit(
  keyId: string,
): Promise<RateLimitResult> {
  return checkLimiter(apiV1Limiter, keyId);
}

function authFailureLimiterFailOpen(reason: string, error?: unknown): RateLimitResult {
  console.warn(reason, error ?? "");
  return FAIL_OPEN_RESULT;
}

export async function recordApiV1AuthFailure(
  request: Request,
): Promise<RateLimitResult> {
  const ip = getClientIp(request);

  if (ip === "unknown") {
    return FAIL_OPEN_RESULT;
  }

  const redis = createRedis();

  if (!redis) {
    return authFailureLimiterFailOpen(
      "API v1 auth failure limiter unavailable; failing open",
    );
  }

  const key = `${AUTH_FAIL_KEY_PREFIX}${ip}`;

  try {
    const pipeline = redis.multi();
    pipeline.incr(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();

    const count = Number(results[0]);
    const ttlSeconds = Number(results[1]);

    if (ttlSeconds < 0) {
      await redis.expire(key, AUTH_FAIL_WINDOW_SECONDS);
    }

    const windowSeconds =
      ttlSeconds > 0 ? ttlSeconds : AUTH_FAIL_WINDOW_SECONDS;
    const overBudget = count > AUTH_FAIL_MAX_ATTEMPTS;

    return {
      success: !overBudget,
      remaining: Math.max(0, AUTH_FAIL_MAX_ATTEMPTS - count),
      reset: Date.now() + windowSeconds * 1000,
    };
  } catch (error) {
    return authFailureLimiterFailOpen(
      "API v1 auth failure limiter error; failing open",
      error,
    );
  }
}

function getRetryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

function formatRetryMessage(retryAfterSeconds: number): string {
  const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const unit = retryMinutes === 1 ? "minute" : "minutes";

  return `Too many attempts. Please try again in ${retryMinutes} ${unit}.`;
}

export function rateLimitedResponse(result: RateLimitResult): NextResponse {
  const retryAfterSeconds = getRetryAfterSeconds(result.reset);

  return NextResponse.json(
    { error: formatRetryMessage(retryAfterSeconds) },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export function buildRateLimitHeaders(
  result: RateLimitResult,
  options?: { limit?: number },
): HeadersInit {
  if (result.remaining < 0) {
    return result.success
      ? {}
      : { "Retry-After": String(getRetryAfterSeconds(result.reset)) };
  }

  const retryAfterSeconds = getRetryAfterSeconds(result.reset);

  return {
    ...(options?.limit !== undefined
      ? { "X-RateLimit-Limit": String(options.limit) }
      : {}),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
    ...(result.success ? {} : { "Retry-After": String(retryAfterSeconds) }),
  };
}
