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
