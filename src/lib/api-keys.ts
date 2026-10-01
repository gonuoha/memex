import { createHash, randomBytes } from "node:crypto";

import { findApiKeyByHash } from "@/lib/db/api-keys";
import { recordApiV1AuthFailure } from "@/lib/rate-limit";
import type { RateLimitResult } from "@/lib/rate-limit";

export const API_KEY_PREFIX = "mx_";
export const API_KEY_PREFIX_DISPLAY_LENGTH = 12;
export const MAX_ACTIVE_API_KEYS = 10;
export const API_KEY_FORMAT = /^mx_[A-Za-z0-9_-]{43}$/;

export type ApiKeyAuthSuccess = {
  success: true;
  userId: string;
  keyId: string;
};

export type ApiKeyAuthFailure = {
  success: false;
  code:
    | "missing"
    | "malformed"
    | "invalid"
    | "revoked"
    | "expired"
    | "not_pro"
    | "auth_rate_limited";
  rateLimit?: RateLimitResult;
};

export function generateApiKeyPlaintext(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function getApiKeyPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX_DISPLAY_LENGTH);
}

export function isApiKeyFormatValid(token: string): boolean {
  return API_KEY_FORMAT.test(token);
}

export function parseBearerApiKey(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);

  if (!match) {
    return null;
  }

  const token = match[1].trim();

  if (!isApiKeyFormatValid(token)) {
    return null;
  }

  return token;
}

function isKeyExpired(expiresAt: Date | null): boolean {
  return expiresAt !== null && expiresAt.getTime() <= Date.now();
}

async function rejectAfterAuthFailure(
  request: Request,
  code: Exclude<ApiKeyAuthFailure["code"], "missing" | "malformed" | "not_pro" | "auth_rate_limited">,
): Promise<ApiKeyAuthFailure> {
  const rateLimit = await recordApiV1AuthFailure(request);

  if (!rateLimit.success) {
    return { success: false, code: "auth_rate_limited", rateLimit };
  }

  return { success: false, code };
}

export async function authenticateApiKey(
  request: Request,
): Promise<ApiKeyAuthSuccess | ApiKeyAuthFailure> {
  const header = request.headers.get("authorization");

  if (!header) {
    return { success: false, code: "missing" };
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);

  if (!match) {
    const rateLimit = await recordApiV1AuthFailure(request);

    if (!rateLimit.success) {
      return { success: false, code: "auth_rate_limited", rateLimit };
    }

    return { success: false, code: "malformed" };
  }

  const token = match[1].trim();

  if (!isApiKeyFormatValid(token)) {
    return { success: false, code: "malformed" };
  }

  const hashedKey = hashApiKey(token);
  const record = await findApiKeyByHash(hashedKey);

  if (!record) {
    return rejectAfterAuthFailure(request, "invalid");
  }

  if (record.revokedAt) {
    return rejectAfterAuthFailure(request, "revoked");
  }

  if (isKeyExpired(record.expiresAt)) {
    return rejectAfterAuthFailure(request, "expired");
  }

  if (!record.user.isPro) {
    return { success: false, code: "not_pro" };
  }

  return {
    success: true,
    userId: record.userId,
    keyId: record.id,
  };
}

export function computeApiKeyExpiresAt(
  expiresInDays: number | null,
): Date | null {
  if (expiresInDays === null) {
    return null;
  }

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);
  return expiresAt;
}
