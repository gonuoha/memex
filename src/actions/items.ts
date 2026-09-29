"use server";

import { revalidatePath } from "next/cache";

import { parseActionInput } from "@/lib/actions/parse-action-input";
import { requireSession } from "@/lib/actions/require-session";
import {
  createItem as createItemInDb,
  deleteItem as deleteItemInDb,
  getItemTypeBySlug,
  toggleItemFavorite as toggleItemFavoriteInDb,
  toggleItemPin as toggleItemPinInDb,
  updateItem as updateItemInDb,
} from "@/lib/db/items";
import type {
  DeleteItemResult,
  ItemDetail,
  ToggleItemFavoriteResult,
  ToggleItemPinResult,
} from "@/lib/db/items";
import { validateUserCollectionIds } from "@/lib/db/collections";
import {
  FreeTierLimitExceededError,
  runWithFreeTierItemGuard,
} from "@/lib/db/free-tier-limits";
import { getUserIsPro } from "@/lib/db/user";
import { isOwnedFileUrl } from "@/lib/file-upload";
import { deleteObject, getObjectSize } from "@/lib/r2/storage";
import { isProOnlyItemType, itemLimitErrorMessage } from "@/lib/subscription-limits";
import type { ActionResult } from "@/types/actions";
import { createItemSchema, updateItemSchema } from "@/lib/validations/items";

export async function createItem(
  data: unknown,
): Promise<ActionResult<ItemDetail>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(createItemSchema, data);
  if (!parsed.success) {
    return parsed;
  }

  const itemType = await getItemTypeBySlug(userId, parsed.data.type);

  if (!itemType) {
    return { success: false, error: "Invalid item type" };
  }

  const isPro = await getUserIsPro(userId);

  if (isProOnlyItemType(parsed.data.type)) {
    if (!isPro) {
      return {
        success: false,
        error: "File and image uploads require a Pro subscription",
      };
    }
  }

  const usesFileContent = isProOnlyItemType(parsed.data.type);

  if (
    usesFileContent &&
    parsed.data.fileUrl &&
    !isOwnedFileUrl(parsed.data.fileUrl, userId)
  ) {
    return { success: false, error: "Invalid file reference" };
  }

  const storedFileSize =
    usesFileContent && parsed.data.fileUrl
      ? await getObjectSize(parsed.data.fileUrl)
      : null;

  if (usesFileContent && parsed.data.fileUrl && storedFileSize === null) {
    return { success: false, error: "Invalid file reference" };
  }

  const hasValidCollections = await validateUserCollectionIds(
    userId,
    parsed.data.collectionIds,
  );

  if (!hasValidCollections) {
    return { success: false, error: "Invalid collection selection" };
  }

  let created: ItemDetail;

  try {
    created = await runWithFreeTierItemGuard(userId, isPro, (db) =>
      createItemInDb(
        userId,
        {
          typeId: itemType.id,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          content: parsed.data.content ?? null,
          url: parsed.data.url ?? null,
          language: parsed.data.language ?? null,
          fileUrl: usesFileContent ? (parsed.data.fileUrl ?? null) : null,
          fileName: usesFileContent ? (parsed.data.fileName ?? null) : null,
          fileSize: storedFileSize,
          tags: parsed.data.tags,
          collectionIds: parsed.data.collectionIds,
          contentType: usesFileContent ? "file" : "text",
        },
        db,
      ),
    );
  } catch (error) {
    if (error instanceof FreeTierLimitExceededError) {
      return { success: false, error: itemLimitErrorMessage() };
    }

    throw error;
  }

  revalidatePath(`/items/${parsed.data.type}`);
  revalidatePath("/dashboard");

  return { success: true, data: created };
}

export async function updateItem(
  itemId: string,
  data: unknown,
): Promise<ActionResult<ItemDetail>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(updateItemSchema, data);
  if (!parsed.success) {
    return parsed;
  }

  const hasValidCollections = await validateUserCollectionIds(
    userId,
    parsed.data.collectionIds,
  );

  if (!hasValidCollections) {
    return { success: false, error: "Invalid collection selection" };
  }

  const updated = await updateItemInDb(userId, itemId, {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    content: parsed.data.content ?? null,
    url: parsed.data.url ?? null,
    language: parsed.data.language ?? null,
    tags: parsed.data.tags,
    collectionIds: parsed.data.collectionIds,
  });

  if (!updated) {
    return { success: false, error: "Item not found" };
  }

  revalidatePath(`/items/${updated.type.name.toLowerCase()}`);
  revalidatePath("/dashboard");

  return { success: true, data: updated };
}

export async function deleteItem(
  itemId: string,
): Promise<ActionResult<DeleteItemResult>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const deleted = await deleteItemInDb(userId, itemId);

  if (!deleted) {
    return { success: false, error: "Item not found" };
  }

  if (deleted.fileUrl) {
    try {
      await deleteObject(deleted.fileUrl);
    } catch {
      // Item is already removed from the database.
    }
  }

  revalidatePath(`/items/${deleted.typeName.toLowerCase()}`);
  revalidatePath("/dashboard");

  return { success: true, data: deleted };
}

function revalidateItemFavoritePaths(typeName: string) {
  revalidatePath(`/items/${typeName.toLowerCase()}`);
  revalidatePath("/dashboard");
  revalidatePath("/favorites");
  revalidatePath("/profile");
  revalidatePath("/collections", "layout");
}

export async function toggleItemFavorite(
  itemId: string,
): Promise<ActionResult<ToggleItemFavoriteResult>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const result = await toggleItemFavoriteInDb(userId, itemId);

  if (!result) {
    return { success: false, error: "Item not found" };
  }

  revalidateItemFavoritePaths(result.typeName);

  return { success: true, data: result };
}

function revalidateItemPinPaths(typeName: string) {
  revalidatePath(`/items/${typeName.toLowerCase()}`);
  revalidatePath("/dashboard");
  revalidatePath("/collections", "layout");
}

export async function toggleItemPin(
  itemId: string,
): Promise<ActionResult<ToggleItemPinResult>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const result = await toggleItemPinInDb(userId, itemId);

  if (!result) {
    return { success: false, error: "Item not found" };
  }

  revalidateItemPinPaths(result.typeName);

  return { success: true, data: result };
}
