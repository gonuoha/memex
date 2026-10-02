import { getTypeSlug, parseItemTypeSlug } from "@/lib/item-type-slugs";
import { SYSTEM_ITEM_TYPE_ORDER } from "@/lib/item-type-styles";

export const MAX_CUSTOM_ITEM_TYPES = 20;

const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

export function slugifyItemTypeName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return slug || "type";
}

export function isValidItemTypeSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function dedupeItemTypeSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }

  for (let index = 2; index < 1000; index += 1) {
    const suffix = `-${index}`;
    const trimmedBase = base.slice(0, Math.max(1, 40 - suffix.length));
    const candidate = `${trimmedBase}${suffix}`;

    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base.slice(0, 32)}-${Date.now().toString(36)}`.slice(0, 40);
}

export function getReservedTypeSlugs(): Set<string> {
  const reserved = new Set<string>();

  for (const systemName of SYSTEM_ITEM_TYPE_ORDER) {
    reserved.add(systemName.toLowerCase());
    reserved.add(getTypeSlug(systemName));

    const parsed = parseItemTypeSlug(getTypeSlug(systemName));
    if (parsed) {
      reserved.add(parsed);
    }
  }

  for (const alias of [
    "snippets",
    "prompts",
    "commands",
    "notes",
    "files",
    "images",
    "links",
    "url",
    "urls",
  ]) {
    reserved.add(alias);
  }

  return reserved;
}

export function getReservedTypeNames(): Set<string> {
  return new Set(SYSTEM_ITEM_TYPE_ORDER.map((name) => name.toLowerCase()));
}

export function isReservedItemTypeName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return getReservedTypeNames().has(normalized);
}

export function isReservedItemTypeSlug(slug: string): boolean {
  const normalized = slug.toLowerCase();

  if (getReservedTypeSlugs().has(normalized)) {
    return true;
  }

  return parseItemTypeSlug(normalized) !== null;
}
