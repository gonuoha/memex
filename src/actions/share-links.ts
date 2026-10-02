"use server";

import { parseActionInput } from "@/lib/actions/parse-action-input";
import { requireSession } from "@/lib/actions/require-session";
import { getItemById } from "@/lib/db/items";
import {
  createShareLinkForItem,
  getActiveShareLinkForItem,
  revokeShareLinkForItem,
  ShareLinkLimitExceededError,
  updateShareLinkExpiryForItem,
} from "@/lib/db/share-links";
import { getUserIsPro } from "@/lib/db/user";
import { checkShareLinkCreateRateLimit } from "@/lib/rate-limit-user-action";
import { isShareableItemTypeKind } from "@/lib/share-links/constants";
import {
  getSystemKindForName,
  normalizeItemTypeKind,
} from "@/lib/item-types/kinds";
import {
  createShareLinkSchema,
  getShareLinkForItemSchema,
  revokeShareLinkSchema,
  shareLinkExpirySchema,
} from "@/lib/validations/share-links";
import type { ActionResult } from "@/types/actions";

export type ShareLinkActionData = {
  token: string;
  itemId: string;
  createdAt: string;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
};

function serializeShareLink(link: {
  token: string;
  itemId: string;
  createdAt: Date;
  expiresAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
}): ShareLinkActionData {
  return {
    token: link.token,
    itemId: link.itemId,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt?.toISOString() ?? null,
  };
}

async function assertShareableItem(
  userId: string,
  itemId: string,
): Promise<ActionResult<{ typeName: string }>> {
  const item = await getItemById(userId, itemId);

  if (!item) {
    return { success: false, error: "Item not found" };
  }

  const shareKind = item.type.isSystem === false
    ? normalizeItemTypeKind(item.type.kind ?? "markdown")
    : getSystemKindForName(item.type.name);

  if (!isShareableItemTypeKind(shareKind)) {
    return { success: false, error: "This item type cannot be shared" };
  }

  return { success: true, data: { typeName: item.type.name } };
}

export async function createShareLink(
  itemId: string,
  data: unknown,
): Promise<ActionResult<ShareLinkActionData>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(createShareLinkSchema, {
    itemId,
    ...(typeof data === "object" && data !== null ? data : {}),
  });
  if (!parsed.success) {
    return parsed;
  }

  const shareable = await assertShareableItem(userId, itemId);
  if (!shareable.success) {
    return shareable;
  }

  const rateLimit = await checkShareLinkCreateRateLimit(userId);
  if (!rateLimit.success) {
    return {
      success: false,
      error: "Too many share link requests. Please try again later.",
    };
  }

  const isPro = await getUserIsPro(userId);

  try {
    const link = await createShareLinkForItem(userId, itemId, {
      expiresInDays: parsed.data.expiresInDays,
      regenerate: parsed.data.regenerate,
      isPro,
    });

    return { success: true, data: serializeShareLink(link) };
  } catch (error) {
    if (error instanceof ShareLinkLimitExceededError) {
      return {
        success: false,
        error:
          "Free plan is limited to 10 active share links. Revoke an existing link or upgrade to Pro.",
      };
    }

    if (error instanceof Error && error.message === "ITEM_NOT_FOUND") {
      return { success: false, error: "Item not found" };
    }

    throw error;
  }
}

export async function revokeShareLink(
  itemId: string,
): Promise<ActionResult<{ revoked: boolean }>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(revokeShareLinkSchema, { itemId });
  if (!parsed.success) {
    return parsed;
  }

  const revoked = await revokeShareLinkForItem(userId, itemId);

  return { success: true, data: { revoked } };
}

export async function getShareLinkForItem(
  itemId: string,
): Promise<ActionResult<ShareLinkActionData | null>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(getShareLinkForItemSchema, { itemId });
  if (!parsed.success) {
    return parsed;
  }

  const shareable = await assertShareableItem(userId, itemId);
  if (!shareable.success) {
    return shareable;
  }

  const link = await getActiveShareLinkForItem(userId, itemId);

  return {
    success: true,
    data: link ? serializeShareLink(link) : null,
  };
}

export async function updateShareLinkExpiry(
  itemId: string,
  expiresInDays: unknown,
): Promise<ActionResult<ShareLinkActionData | null>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const expiryParsed = parseActionInput(shareLinkExpirySchema, expiresInDays);
  if (!expiryParsed.success) {
    return expiryParsed;
  }

  const shareable = await assertShareableItem(userId, itemId);
  if (!shareable.success) {
    return shareable;
  }

  const updated = await updateShareLinkExpiryForItem(
    userId,
    itemId,
    expiryParsed.data,
  );

  if (!updated) {
    return { success: false, error: "No active share link for this item" };
  }

  return { success: true, data: serializeShareLink(updated) };
}
