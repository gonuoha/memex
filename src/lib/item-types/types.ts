import type { ItemTypeKind } from "@/lib/item-types/kinds";

export type ResolvedItemType = {
  id: string;
  name: string;
  slug: string;
  label: string;
  icon: string | null;
  color: string | null;
  kind: ItemTypeKind;
  isSystem: boolean;
};

export type ItemTypeLike = Pick<
  ResolvedItemType,
  "slug" | "name" | "isSystem" | "kind"
>;
