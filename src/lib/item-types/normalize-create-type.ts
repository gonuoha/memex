import { getTypeSlug, parseItemTypeSlug } from "@/lib/item-type-slugs";
import type { ItemTypeKind } from "@/lib/item-types/kinds";
import { getSystemKindForName } from "@/lib/item-types/kinds";
import type { ItemTypeLike } from "@/lib/item-types/types";

const AI_TYPE_BY_KIND: Record<
  Extract<ItemTypeKind, "code" | "markdown" | "link">,
  "snippet" | "note" | "link"
> = {
  code: "snippet",
  markdown: "note",
  link: "link",
};

/** Maps arbitrary user input (singular name, plural slug, custom slug) to a creatable type slug. */
export function normalizeCreateTypeSlug(
  input: string | undefined,
  itemTypes: ItemTypeLike[],
): string | undefined {
  if (!input?.trim()) {
    return undefined;
  }

  const normalized = input.trim().toLowerCase();

  for (const type of itemTypes) {
    if (type.slug.toLowerCase() === normalized) {
      return type.slug;
    }
  }

  const systemName = parseItemTypeSlug(normalized);

  if (systemName) {
    const slug = getTypeSlug(systemName);

    for (const type of itemTypes) {
      if (type.isSystem && type.slug.toLowerCase() === slug.toLowerCase()) {
        return type.slug;
      }
    }

    return slug;
  }

  for (const type of itemTypes) {
    if (!type.isSystem && type.name.toLowerCase() === normalized) {
      return type.slug;
    }
  }

  for (const type of itemTypes) {
    if (type.isSystem && type.name.toLowerCase() === normalized) {
      return type.slug;
    }
  }

  return undefined;
}

export function resolveDefaultCreateTypeSlug(
  defaultType: string | undefined,
  itemTypes: ItemTypeLike[],
  isPro: boolean,
): string {
  const fallback = normalizeCreateTypeSlug("snippet", itemTypes) ?? "snippets";
  const resolved = normalizeCreateTypeSlug(defaultType, itemTypes) ?? fallback;
  const type = itemTypes.find((entry) => entry.slug === resolved);

  if (!type) {
    return fallback;
  }

  if ((type.kind === "file" || type.kind === "image") && !isPro) {
    return fallback;
  }

  if (!type.isSystem && !isPro) {
    return fallback;
  }

  return type.slug;
}

export function toAiItemTypeName(type: ItemTypeLike): string {
  if (type.isSystem) {
    return type.name.toLowerCase();
  }

  if (type.kind === "code" || type.kind === "markdown" || type.kind === "link") {
    return AI_TYPE_BY_KIND[type.kind];
  }

  return getSystemKindForName(type.name) === "code" ? "snippet" : "note";
}

export function isLinkKind(type: ItemTypeLike | undefined): boolean {
  return type?.kind === "link";
}

/** Canonical creatable slug for UI boundaries (singular names, plural slugs, custom slugs). */
export const normalizeTypeKey = normalizeCreateTypeSlug;

export function getCanonicalItemTypeSlugFromCatalog(
  input: string | undefined,
  itemTypes: ItemTypeLike[],
): string | undefined {
  return normalizeCreateTypeSlug(input, itemTypes);
}
