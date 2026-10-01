"use server";

import { revalidatePath } from "next/cache";

import { parseActionInput } from "@/lib/actions/parse-action-input";
import { requireSession } from "@/lib/actions/require-session";
import {
  deleteTag as deleteTagInDb,
  renameTag as renameTagInDb,
  type RenamedTagResult,
} from "@/lib/db/tags";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { deleteTagSchema, renameTagSchema } from "@/lib/validations/tags";
import type { ActionResult } from "@/types/actions";

function revalidateTagPaths() {
  revalidatePath("/", "layout");
}

export async function renameTag(
  tagId: string,
  data: unknown,
): Promise<ActionResult<RenamedTagResult>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(renameTagSchema, {
    tagId,
    ...(typeof data === "object" && data !== null ? data : {}),
  });
  if (!parsed.success) {
    return parsed;
  }

  if (parsed.data.tagId !== tagId) {
    return { success: false, error: "Invalid tag" };
  }

  try {
    const result = await renameTagInDb(userId, tagId, parsed.data.name);

    if (!result) {
      return { success: false, error: "Tag not found" };
    }

    revalidateTagPaths();

    return { success: true, data: result };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        error: "A tag with this name already exists",
      };
    }

    throw error;
  }
}

export async function deleteTag(
  tagId: string,
): Promise<ActionResult<{ name: string }>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(deleteTagSchema, { tagId });
  if (!parsed.success) {
    return parsed;
  }

  try {
    const deleted = await deleteTagInDb(userId, tagId);

    if (!deleted) {
      return { success: false, error: "Tag not found" };
    }

    revalidateTagPaths();

    return { success: true, data: deleted };
  } catch {
    return { success: false, error: "Failed to delete tag" };
  }
}
