"use server";

import { revalidatePath } from "next/cache";

import { parseActionInput } from "@/lib/actions/parse-action-input";
import { requireSession } from "@/lib/actions/require-session";
import {
  createItem as createItemInDb,
  deleteItem as deleteItemInDb,
  getItemTypeBySlug,
  permanentlyDeleteItem as permanentlyDeleteItemInDb,
  restoreItem as restoreItemInDb,
  toggleItemFavorite as toggleItemFavoriteInDb,
  toggleItemPin as toggleItemPinInDb,
  updateItem as updateItemInDb,
} from "@/lib/db/items";
import type {
  DeleteItemResult,
  ItemDetail,
  PermanentDeleteItemResult,
  RestoreItemResult,
  ToggleItemFavoriteResult,
  ToggleItemPinResult,
} from "@/lib/db/items";
import {
  emptyTrash as emptyTrashInDb,
  type DeletedTrashResult,
} from "@/lib/db/trash";
import { validateUserCollectionIds } from "@/lib/db/collections";
import {
  FreeTierLimitExceededError,
  runWithFreeTierItemGuard,
  runWithFreeTierItemRestoreGuard,
} from "@/lib/db/free-tier-limits";
import { getUserIsPro, getUserStorageUsageBytes } from "@/lib/db/user";
import { isOwnedFileUrl, sanitizeFileName } from "@/lib/file-upload";
import { deleteObject, getObjectMetadata } from "@/lib/r2/storage";
import {
  isAtStorageLimit,
  isProOnlyItemType,
  itemLimitErrorMessage,
  storageQuotaErrorMessage,
} from "@/lib/subscription-limits";
import type { ActionResult } from "@/types/actions";
import {
  createItemSchema,
  updateItemSchema,
  type CreatableItemType,
} from "@/lib/validations/items";

type UploadedFile = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
};

/** File size is read from R2 because client-reported sizes would let users bypass the storage quota. */
async function resolveUploadedFile(
  userId: string,
  data: { type: CreatableItemType; fileUrl?: string; fileName?: string },
  isPro: boolean,
): Promise<ActionResult<UploadedFile>> {
  const invalidReference = { success: false, error: "Invalid file reference" } as const;

  if (!data.fileUrl || !data.fileName || !isOwnedFileUrl(data.fileUrl, userId)) {
    return invalidReference;
  }

  const object = await getObjectMetadata(data.fileUrl);

  if (
    !object ||
    object.size <= 0 ||
    (data.type === "image" && !object.contentType?.startsWith("image/"))
  ) {
    return invalidReference;
  }

  const usedBytes = await getUserStorageUsageBytes(userId);

  if (isAtStorageLimit(usedBytes, object.size, isPro)) {
    return { success: false, error: storageQuotaErrorMessage() };
  }

  return {
    success: true,
    data: {
      fileUrl: data.fileUrl,
      fileName: sanitizeFileName(data.fileName),
      fileSize: object.size,
    },
  };
}

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
  let uploadedFile: UploadedFile | null = null;

  if (usesFileContent) {
    const fileResult = await resolveUploadedFile(userId, parsed.data, isPro);

    if (!fileResult.success) {
      return fileResult;
    }

    uploadedFile = fileResult.data;
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
          fileUrl: uploadedFile?.fileUrl ?? null,
          fileName: uploadedFile?.fileName ?? null,
          fileSize: uploadedFile?.fileSize ?? null,
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

function revalidateItemViews() {
  revalidatePath("/", "layout");
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

  revalidateItemViews();

  return { success: true, data: deleted };
}

export async function restoreItem(
  itemId: string,
): Promise<ActionResult<RestoreItemResult>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const isPro = await getUserIsPro(userId);

  try {
    const restored = await runWithFreeTierItemRestoreGuard(
      userId,
      isPro,
      (db) => restoreItemInDb(userId, itemId, db),
    );

    if (!restored) {
      return { success: false, error: "Item not found" };
    }

    revalidateItemViews();

    return { success: true, data: restored };
  } catch (error) {
    if (error instanceof FreeTierLimitExceededError) {
      return { success: false, error: itemLimitErrorMessage() };
    }

    throw error;
  }
}

export async function permanentlyDeleteItem(
  itemId: string,
): Promise<ActionResult<PermanentDeleteItemResult>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const deleted = await permanentlyDeleteItemInDb(userId, itemId);

  if (!deleted) {
    return { success: false, error: "Item not found" };
  }

  if (deleted.fileUrl) {
    try {
      await deleteObject(deleted.fileUrl);
    } catch (error) {
      console.error("Failed to delete item file from R2:", error);
    }
  }

  revalidateItemViews();

  return { success: true, data: deleted };
}

export async function emptyTrash(): Promise<ActionResult<DeletedTrashResult>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const result = await emptyTrashInDb(userId);

  revalidateItemViews();

  return { success: true, data: result };
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
