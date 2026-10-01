export const SHAREABLE_ITEM_TYPES = new Set([
  "snippet",
  "prompt",
  "command",
  "note",
  "link",
]);

export const FREE_ACTIVE_SHARE_LINK_LIMIT = 10;

export function isShareableItemType(typeName: string): boolean {
  return SHAREABLE_ITEM_TYPES.has(typeName.toLowerCase());
}
