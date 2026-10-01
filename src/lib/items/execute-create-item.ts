import {
  createItem as createItemInDb,
  getItemTypeBySlug,
  type ItemDetail,
} from "@/lib/db/items";
import { validateUserCollectionIds } from "@/lib/db/collections";
import {
  FreeTierLimitExceededError,
  runWithFreeTierItemGuard,
} from "@/lib/db/free-tier-limits";
import { getUserIsPro } from "@/lib/db/user";
import { itemLimitErrorMessage } from "@/lib/subscription-limits";
import type { CreateItemInput } from "@/lib/validations/items";

export type CreateTextItemErrorKind =
  | "unsupported_type"
  | "invalid_type"
  | "invalid_collections"
  | "item_limit";

export type CreateTextItemResult =
  | { success: true; data: ItemDetail }
  | {
      success: false;
      kind: CreateTextItemErrorKind;
      message: string;
    };

export function createTextItemErrorMessage(
  kind: CreateTextItemErrorKind,
): string {
  switch (kind) {
    case "unsupported_type":
      return "File and image items cannot be created via this endpoint";
    case "invalid_type":
      return "Invalid item type";
    case "invalid_collections":
      return "Invalid collection selection";
    case "item_limit":
      return itemLimitErrorMessage();
  }
}

export async function executeCreateTextItem(
  userId: string,
  parsed: CreateItemInput,
): Promise<CreateTextItemResult> {
  if (parsed.type === "file" || parsed.type === "image") {
    return {
      success: false,
      kind: "unsupported_type",
      message: createTextItemErrorMessage("unsupported_type"),
    };
  }

  const itemType = await getItemTypeBySlug(userId, parsed.type);

  if (!itemType) {
    return {
      success: false,
      kind: "invalid_type",
      message: createTextItemErrorMessage("invalid_type"),
    };
  }

  const isPro = await getUserIsPro(userId);

  const hasValidCollections = await validateUserCollectionIds(
    userId,
    parsed.collectionIds,
  );

  if (!hasValidCollections) {
    return {
      success: false,
      kind: "invalid_collections",
      message: createTextItemErrorMessage("invalid_collections"),
    };
  }

  try {
    const created = await runWithFreeTierItemGuard(userId, isPro, (db) =>
      createItemInDb(
        userId,
        {
          typeId: itemType.id,
          title: parsed.title,
          description: parsed.description ?? null,
          content: parsed.content ?? null,
          url: parsed.url ?? null,
          language: parsed.language ?? null,
          fileUrl: null,
          fileName: null,
          fileSize: null,
          tags: parsed.tags,
          collectionIds: parsed.collectionIds,
          contentType: "text",
        },
        db,
      ),
    );

    return { success: true, data: created };
  } catch (error) {
    if (error instanceof FreeTierLimitExceededError) {
      return {
        success: false,
        kind: "item_limit",
        message: createTextItemErrorMessage("item_limit"),
      };
    }

    throw error;
  }
}
