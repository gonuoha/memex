"use server";

import { revalidatePath } from "next/cache";

import { parseActionInput } from "@/lib/actions/parse-action-input";
import { requireSession } from "@/lib/actions/require-session";
import {
  createCustomItemType,
  CustomItemTypeLimitError,
  deleteCustomItemType,
  updateCustomItemType,
  type CreatedItemType,
} from "@/lib/db/item-types";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { getUserIsPro } from "@/lib/db/user";
import type { ActionResult } from "@/types/actions";
import {
  createItemTypeSchema,
  deleteItemTypeSchema,
  updateItemTypeSchema,
} from "@/lib/validations/item-types";

function revalidateAppLayout() {
  revalidatePath("/", "layout");
}

export async function createItemType(
  data: unknown,
): Promise<ActionResult<CreatedItemType>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const isPro = await getUserIsPro(userId);

  if (!isPro) {
    return {
      success: false,
      error: "Custom item types require a Pro subscription",
    };
  }

  const parsed = parseActionInput(createItemTypeSchema, data);
  if (!parsed.success) {
    return parsed;
  }

  try {
    const created = await createCustomItemType(userId, parsed.data);

    revalidateAppLayout();

    return { success: true, data: created };
  } catch (error) {
    if (error instanceof CustomItemTypeLimitError) {
      return {
        success: false,
        error: "You can create at most 20 custom item types",
      };
    }

    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        error: "An item type with this name already exists",
      };
    }

    throw error;
  }
}

export async function updateItemType(
  typeId: string,
  data: unknown,
): Promise<ActionResult<CreatedItemType>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(updateItemTypeSchema, {
    ...(typeof data === "object" && data !== null ? data : {}),
  });
  if (!parsed.success) {
    return parsed;
  }

  try {
    const updated = await updateCustomItemType(userId, typeId, parsed.data);

    if (!updated) {
      return { success: false, error: "Item type not found" };
    }

    revalidateAppLayout();

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof Error && error.message === "KIND_IMMUTABLE") {
      return {
        success: false,
        error: "Kind cannot be changed while items use this type",
      };
    }

    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        error: "An item type with this name already exists",
      };
    }

    throw error;
  }
}

export async function deleteItemType(
  typeId: string,
  data: unknown = {},
): Promise<ActionResult<{ name: string }>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const parsed = parseActionInput(deleteItemTypeSchema, {
    typeId,
    ...(typeof data === "object" && data !== null ? data : {}),
  });
  if (!parsed.success) {
    return parsed;
  }

  if (parsed.data.typeId !== typeId) {
    return { success: false, error: "Invalid item type" };
  }

  try {
    const deleted = await deleteCustomItemType(
      userId,
      typeId,
      parsed.data.moveToTypeId,
    );

    if (!deleted) {
      return { success: false, error: "Item type not found" };
    }

    revalidateAppLayout();

    return { success: true, data: deleted };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "MOVE_REQUIRED") {
        return {
          success: false,
          error: "Choose a destination type for existing items",
        };
      }

      if (error.message === "INVALID_MOVE_TARGET") {
        return { success: false, error: "Invalid destination type" };
      }

      if (error.message === "INCOMPATIBLE_MOVE") {
        return {
          success: false,
          error: "Destination type must have the same kind",
        };
      }
    }

    return { success: false, error: "Failed to delete item type" };
  }
}
