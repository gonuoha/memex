"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/actions/require-session";
import { updateUserPreferences as updateUserPreferencesInDb } from "@/lib/db/settings";
import type { ItemsView } from "@/lib/user-preferences";
import type { ActionResult } from "@/types/actions";

export async function updateItemsViewPreference(
  view: ItemsView,
): Promise<ActionResult<{ itemsView: ItemsView }>> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }

  try {
    const updated = await updateUserPreferencesInDb(sessionResult.userId, {
      itemsView: view,
    });

    revalidatePath("/items", "layout");
    revalidatePath("/collections", "layout");

    return { success: true, data: { itemsView: updated.itemsView } };
  } catch {
    return { success: false, error: "Failed to save view preference" };
  }
}
