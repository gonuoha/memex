import type { ItemDetail } from "@/lib/db/items";

export type ApiV1Item = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  language: string | null;
  tags: string[];
  collections: { id: string; name: string }[];
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiV1Collection = {
  id: string;
  name: string;
};

export type ApiV1Tag = {
  id: string;
  name: string;
};

function serializeItemTypeSlug(type: ItemDetail["type"]): string {
  if (type.isSystem) {
    return type.name.toLowerCase();
  }

  if (type.slug) {
    return type.slug;
  }

  return type.name.toLowerCase();
}

export function serializeApiV1Item(item: ItemDetail): ApiV1Item {
  return {
    id: item.id,
    type: serializeItemTypeSlug(item.type),
    title: item.title,
    description: item.description,
    content: item.content,
    url: item.url,
    language: item.language,
    tags: item.tags,
    collections: item.collections,
    isFavorite: item.isFavorite,
    isPinned: item.isPinned,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeApiV1Items(items: ItemDetail[]): ApiV1Item[] {
  return items.map(serializeApiV1Item);
}
