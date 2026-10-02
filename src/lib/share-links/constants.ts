import type { ItemTypeKind } from "@/lib/item-types/kinds";
import { normalizeItemTypeKind } from "@/lib/item-types/kinds";

export const SHAREABLE_ITEM_TYPE_KINDS = new Set<ItemTypeKind>([
  "code",
  "markdown",
  "link",
]);

export const FREE_ACTIVE_SHARE_LINK_LIMIT = 10;

export function isShareableItemTypeKind(kind: string): boolean {
  return SHAREABLE_ITEM_TYPE_KINDS.has(normalizeItemTypeKind(kind));
}

/** @deprecated Use isShareableItemTypeKind with resolved kind. */
export function isShareableItemType(typeName: string): boolean {
  const normalized = typeName.toLowerCase();
  if (
    normalized === "snippet" ||
    normalized === "prompt" ||
    normalized === "command" ||
    normalized === "note" ||
    normalized === "link"
  ) {
    return true;
  }

  return false;
}
