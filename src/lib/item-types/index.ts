export type { ItemTypeKind, ItemTypeBehaviour } from "@/lib/item-types/kinds";
export {
  CUSTOM_CREATABLE_KINDS,
  getItemTypeBehaviour,
  getSystemKindForName,
  kindsCompatibleForMove,
  normalizeItemTypeKind,
} from "@/lib/item-types/kinds";
export {
  CUSTOM_TYPE_COLORS,
  isCustomTypeColor,
  type CustomTypeColor,
} from "@/lib/item-types/custom-colors";
export {
  CUSTOM_TYPE_ICON_NAMES,
  isCustomTypeIconName,
  resolveItemTypeLucideIcon,
  type CustomTypeIconName,
} from "@/lib/item-types/custom-icons";
export {
  dedupeItemTypeSlug,
  getReservedTypeNames,
  getReservedTypeSlugs,
  isReservedItemTypeName,
  isReservedItemTypeSlug,
  isValidItemTypeSlug,
  MAX_CUSTOM_ITEM_TYPES,
  slugifyItemTypeName,
} from "@/lib/item-types/slug";
export type { ResolvedItemType } from "@/lib/item-types/resolve";
