import type { ItemDetail, UpdateItemData } from "@/lib/db/items";
import { parseItemTypeSlug } from "@/lib/item-type-slugs";
import type { ApiV1UpdateItemInput } from "@/lib/validations/api-v1";

export type MergeApiV1ItemUpdateResult =
  | { ok: true; data: UpdateItemData }
  | { ok: false; message: string; path: string };

function itemTypeName(item: ItemDetail): string {
  return parseItemTypeSlug(item.type.name) ?? item.type.name.toLowerCase();
}

export function mergeApiV1ItemUpdate(
  existing: ItemDetail,
  patch: ApiV1UpdateItemInput,
  rawBody: Record<string, unknown>,
): MergeApiV1ItemUpdateResult {
  const title =
    "title" in rawBody ? (patch.title ?? existing.title) : existing.title;
  const description =
    "description" in rawBody
      ? patch.description ?? null
      : existing.description;
  const content =
    "content" in rawBody ? patch.content ?? null : existing.content;
  const language =
    "language" in rawBody ? patch.language ?? null : existing.language;
  const url = "url" in rawBody ? patch.url ?? null : existing.url;
  const tags = "tags" in rawBody ? patch.tags ?? [] : existing.tags;
  const collectionIds =
    "collectionIds" in rawBody ? patch.collectionIds ?? [] : existing.collections.map((c) => c.id);

  if (!title || title.trim().length === 0) {
    return { ok: false, message: "Title is required", path: "title" };
  }

  if (itemTypeName(existing) === "link" && !url) {
    return {
      ok: false,
      message: "URL is required",
      path: "url",
    };
  }

  return {
    ok: true,
    data: {
      title,
      description,
      content,
      url,
      language,
      tags,
      collectionIds,
    },
  };
}
