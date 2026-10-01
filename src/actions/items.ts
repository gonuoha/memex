"use server";

import { revalidatePath } from "next/cache";

import { parseActionInput } from "@/lib/actions/parse-action-input";
import { requireSession } from "@/lib/actions/require-session";
import { executeCreateTextItem } from "@/lib/items/execute-create-item";
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
import { getTypeSlug } from "@/lib/item-type-slugs";
import {
  FreeTierLimitExceededError,
  runWithFreeTierItemGuard,
  runWithFreeTierItemRestoreGuard,
} from "@/lib/db/free-tier-limits";
import {
  consumePendingUpload,
  findPendingUpload,
  PendingUploadNotFoundError,
  releasePendingUpload,
} from "@/lib/db/pending-uploads";
import { getUserIsPro, getUserStorageUsageBytes } from "@/lib/db/user";
import {
  getMaxUploadBytes,
  isOwnedFileUrl,
  sanitizeFileName,
  type UploadCategory,
} from "@/lib/file-upload";
import { imageMimeMatchesMagicBytes } from "@/lib/image-magic-bytes";
import {
  deleteObject,
  getObjectByteRange,
  getObjectMetadata,
} from "@/lib/r2/storage";
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

function getUploadCategory(type: CreatableItemType): UploadCategory {
  return type === "image" ? "image" : "file";
}

const INVALID_FILE_REFERENCE = "Invalid file reference";
const EXPIRED_UPLOAD_MESSAGE = "Upload expired. Please upload the file again.";

async function rejectInvalidUpload(
  userId: string,
  key: string,
  message = INVALID_FILE_REFERENCE,
): Promise<ActionResult<UploadedFile>> {
  try {
    if (await releasePendingUpload(userId, key)) {
      await deleteObject(key);
    }
  } catch (error) {
    console.error("Failed to discard rejected upload:", error);
  }

  return { success: false, error: message };
}

/**
 * Only keys with an unconsumed PendingUpload are accepted, so an item can never
 * adopt another item's object. Size is read from R2, not from the client.
 */
async function resolveUploadedFile(
  userId: string,
  data: { type: CreatableItemType; fileUrl?: string; fileName?: string },
  isPro: boolean,
): Promise<ActionResult<UploadedFile>> {
  if (!data.fileUrl || !data.fileName || !isOwnedFileUrl(data.fileUrl, userId)) {
    return { success: false, error: INVALID_FILE_REFERENCE };
  }

  const key = data.fileUrl;
  const category = getUploadCategory(data.type);
  const pending = await findPendingUpload(userId, key);

  if (!pending) {
    return { success: false, error: EXPIRED_UPLOAD_MESSAGE };
  }

  if (pending.category !== category) {
    return { success: false, error: INVALID_FILE_REFERENCE };
  }

  const object = await getObjectMetadata(key);

  if (!object || object.size <= 0 || object.size !== pending.size) {
    return rejectInvalidUpload(userId, key);
  }

  if (object.size > getMaxUploadBytes(category)) {
    return rejectInvalidUpload(userId, key, "Uploaded file exceeds the size limit");
  }

  if (data.type === "image") {
    if (!object.contentType?.startsWith("image/")) {
      return rejectInvalidUpload(userId, key);
    }

    const headerBytes = await getObjectByteRange(key, 0, 15);

    if (!imageMimeMatchesMagicBytes(object.contentType, headerBytes)) {
      return rejectInvalidUpload(
        userId,
        key,
        "File contents do not match the declared image type",
      );
    }
  }

  const usedBytes = await getUserStorageUsageBytes(userId);

  if (isAtStorageLimit(usedBytes - pending.size, object.size, isPro)) {
    return rejectInvalidUpload(userId, key, storageQuotaErrorMessage());
  }

  return {
    success: true,
    data: {
      fileUrl: key,
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

  const isPro = await getUserIsPro(userId);
  const usesFileContent = isProOnlyItemType(parsed.data.type);

  if (!usesFileContent) {
    const created = await executeCreateTextItem(userId, parsed.data);

    if (!created.success) {
      return { success: false, error: created.message };
    }

    revalidatePath(`/items/${getTypeSlug(parsed.data.type)}`);
    revalidatePath("/dashboard");

    return { success: true, data: created.data };
  }

  if (!isPro) {
    return {
      success: false,
      error: "File and image uploads require a Pro subscription",
    };
  }

  const itemType = await getItemTypeBySlug(userId, parsed.data.type);

  if (!itemType) {
    return { success: false, error: "Invalid item type" };
  }
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
    created = await runWithFreeTierItemGuard(userId, isPro, async (db) => {
      if (uploadedFile) {
        await consumePendingUpload(db, userId, uploadedFile.fileUrl);
      }

      return createItemInDb(
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
      );
    });
  } catch (error) {
    if (error instanceof FreeTierLimitExceededError) {
      return { success: false, error: itemLimitErrorMessage() };
    }

    if (error instanceof PendingUploadNotFoundError) {
      return { success: false, error: EXPIRED_UPLOAD_MESSAGE };
    }

    throw error;
  }

  revalidatePath(`/items/${getTypeSlug(parsed.data.type)}`);
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

  revalidatePath(`/items/${getTypeSlug(updated.type.name)}`);
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
  revalidatePath(`/items/${getTypeSlug(typeName)}`);
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
  revalidatePath(`/items/${getTypeSlug(typeName)}`);
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
