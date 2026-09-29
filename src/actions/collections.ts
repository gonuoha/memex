"use server";

import { revalidatePath } from "next/cache";

import { parseActionInput } from "@/lib/actions/parse-action-input";
import { requireSession } from "@/lib/actions/require-session";
import {
  createCollection as createCollectionInDb,
  deleteCollection as deleteCollectionInDb,
  toggleCollectionFavorite as toggleCollectionFavoriteInDb,
  updateCollection as updateCollectionInDb,
  type CreatedCollection,
  type DeletedCollection,
  type ToggleCollectionFavoriteResult,
} from "@/lib/db/collections";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import {
  FreeTierLimitExceededError,
  runWithFreeTierCollectionGuard,
} from "@/lib/db/free-tier-limits";
import { getUserIsPro } from "@/lib/db/user";
import { collectionLimitErrorMessage } from "@/lib/subscription-limits";
import type { ActionResult } from "@/types/actions";
import {
  createCollectionSchema,
  updateCollectionSchema,
} from "@/lib/validations/collections";

export async function createCollection(
  data: unknown,
): Promise<ActionResult<CreatedCollection>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(createCollectionSchema, data);
  if (!parsed.success) {
    return parsed;
  }

  const isPro = await getUserIsPro(userId);

  try {
    const created = await runWithFreeTierCollectionGuard(userId, isPro, (db) =>
      createCollectionInDb(
        userId,
        {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
        },
        db,
      ),
    );

    revalidateCollectionPaths();

    return { success: true, data: created };
  } catch (error) {
    if (error instanceof FreeTierLimitExceededError) {
      return { success: false, error: collectionLimitErrorMessage() };
    }

    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        error: "A collection with this name already exists",
      };
    }

    throw error;
  }
}

function revalidateCollectionPaths(collectionId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/favorites");
  revalidatePath("/collections");

  if (collectionId) {
    revalidatePath(`/collections/${collectionId}`);
  }
}

export async function updateCollection(
  collectionId: string,
  data: unknown,
): Promise<ActionResult<CreatedCollection>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(updateCollectionSchema, data);
  if (!parsed.success) {
    return parsed;
  }

  try {
    const updated = await updateCollectionInDb(userId, collectionId, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });

    if (!updated) {
      return { success: false, error: "Collection not found" };
    }

    revalidateCollectionPaths(collectionId);

    return { success: true, data: updated };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        error: "A collection with this name already exists",
      };
    }

    throw error;
  }
}

export async function deleteCollection(
  collectionId: string,
): Promise<ActionResult<DeletedCollection>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const deleted = await deleteCollectionInDb(userId, collectionId);

  if (!deleted) {
    return { success: false, error: "Collection not found" };
  }

  revalidateCollectionPaths(collectionId);

  return { success: true, data: deleted };
}

export async function toggleCollectionFavorite(
  collectionId: string,
): Promise<ActionResult<ToggleCollectionFavoriteResult>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const result = await toggleCollectionFavoriteInDb(userId, collectionId);

  if (!result) {
    return { success: false, error: "Collection not found" };
  }

  revalidateCollectionPaths(collectionId);

  return { success: true, data: result };
}
