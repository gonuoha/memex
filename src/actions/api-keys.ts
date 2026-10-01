"use server";

import { revalidatePath } from "next/cache";

import { parseActionInput } from "@/lib/actions/parse-action-input";
import { requireSession } from "@/lib/actions/require-session";
import { ApiKeyLimitError } from "@/lib/api-keys-errors";
import {
  computeApiKeyExpiresAt,
  generateApiKeyPlaintext,
  getApiKeyPrefix,
  hashApiKey,
  MAX_ACTIVE_API_KEYS,
} from "@/lib/api-keys";
import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import {
  countActiveApiKeysForUser,
  createApiKeyRecord,
  listApiKeysForUser,
  revokeApiKeyForUser,
  type ApiKeyListEntry,
} from "@/lib/db/api-keys";
import { prisma } from "@/lib/prisma";
import { getUserIsPro } from "@/lib/db/user";
import { checkApiKeyCreateRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";
import { createApiKeySchema } from "@/lib/validations/api-keys";

export type CreatedApiKey = {
  id: string;
  name: string;
  prefix: string;
  plaintextKey: string;
  expiresAt: Date | null;
  createdAt: Date;
};

export async function createApiKey(
  data: unknown,
): Promise<ActionResult<CreatedApiKey>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const isPro = await getUserIsPro(userId);

  if (!isPro) {
    return {
      success: false,
      error: "API keys require a Pro subscription",
    };
  }

  const rateLimit = await checkApiKeyCreateRateLimit(userId);

  if (!rateLimit.success) {
    return {
      success: false,
      error: "Too many API key creation attempts. Please try again later.",
    };
  }

  const parsed = parseActionInput(createApiKeySchema, data);
  if (!parsed.success) {
    return parsed;
  }

  const plaintextKey = generateApiKeyPlaintext();
  const prefix = getApiKeyPrefix(plaintextKey);
  const hashedKey = hashApiKey(plaintextKey);
  const expiresAt = computeApiKeyExpiresAt(parsed.data.expiresInDays);

  try {
    const created = await prisma.$transaction(async (tx) => {
      await takeUserAdvisoryLock(tx, userId);

      const activeCount = await countActiveApiKeysForUser(userId, tx);

      if (activeCount >= MAX_ACTIVE_API_KEYS) {
        throw new ApiKeyLimitError();
      }

      return createApiKeyRecord(
        userId,
        {
          name: parsed.data.name,
          prefix,
          hashedKey,
          expiresAt,
        },
        tx,
      );
    });

    revalidatePath("/settings");

    return {
      success: true,
      data: {
        ...created,
        plaintextKey,
      },
    };
  } catch (error) {
    if (error instanceof ApiKeyLimitError) {
      return {
        success: false,
        error: `You can have at most ${MAX_ACTIVE_API_KEYS} active API keys`,
      };
    }

    return { success: false, error: "Failed to create API key" };
  }
}

export async function revokeApiKey(
  keyId: string,
): Promise<ActionResult<{ id: string }>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const revoked = await revokeApiKeyForUser(userId, keyId);

  if (!revoked) {
    return { success: false, error: "API key not found" };
  }

  revalidatePath("/settings");

  return { success: true, data: { id: keyId } };
}

export async function listApiKeys(): Promise<ActionResult<ApiKeyListEntry[]>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const keys = await listApiKeysForUser(userId);

  return { success: true, data: keys };
}
