import { NextResponse } from "next/server";

import {
  API_V1_RATE_LIMIT,
  buildRateLimitHeaders,
  type RateLimitResult,
} from "@/lib/rate-limit";

import type { ApiV1ValidationDetail } from "@/lib/validations/api-v1";

export const API_V1_CACHE_CONTROL = "no-store";

export type ApiV1ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "invalid_cursor"
  | "conflict"
  | "rate_limited"
  | "internal_error";

function buildErrorHeaders(
  status: number,
  rateLimit?: RateLimitResult,
): HeadersInit {
  const headers: Record<string, string> = {
    "Cache-Control": API_V1_CACHE_CONTROL,
  };

  if (status === 401) {
    headers["WWW-Authenticate"] = 'Bearer realm="Memex API"';
  }

  if (rateLimit) {
    Object.assign(
      headers,
      buildRateLimitHeaders(rateLimit, { limit: API_V1_RATE_LIMIT }),
    );
  }

  return headers;
}

export function apiV1Error(
  code: ApiV1ErrorCode,
  message: string,
  status: number,
  options?: {
    rateLimit?: RateLimitResult;
    details?: ApiV1ValidationDetail[];
  },
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options?.details ? { details: options.details } : {}),
      },
    },
    {
      status,
      headers: buildErrorHeaders(status, options?.rateLimit),
    },
  );
}

export function applyApiV1RateLimitHeaders(
  response: Response,
  rateLimit: RateLimitResult,
): void {
  for (const [key, value] of Object.entries(
    buildRateLimitHeaders(rateLimit, { limit: API_V1_RATE_LIMIT }),
  )) {
    response.headers.set(key, value);
  }
}

export function apiV1Json<T>(
  data: T,
  options?: {
    status?: number;
    rateLimit?: RateLimitResult;
  },
): NextResponse {
  const headers: HeadersInit = {
    "Cache-Control": API_V1_CACHE_CONTROL,
    ...(options?.rateLimit
      ? buildRateLimitHeaders(options.rateLimit, { limit: API_V1_RATE_LIMIT })
      : {}),
  };

  return NextResponse.json(data, {
    status: options?.status ?? 200,
    headers,
  });
}
