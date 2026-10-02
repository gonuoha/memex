import { cache } from "react";

import {
  getItemTypeBehaviour,
  getSystemKindForName,
  normalizeItemTypeKind,
} from "@/lib/item-types/kinds";
import { getTypeSlug, parseItemTypeSlug } from "@/lib/item-type-slugs";
import type { ResolvedItemType } from "@/lib/item-types/types";
import { sortItemTypesBySystemOrder } from "@/lib/item-type-styles";
import { prisma } from "@/lib/prisma";

export type { ResolvedItemType } from "@/lib/item-types/types";

type RawItemTypeRow = {
  id: string;
  name: string;
  kind: string;
  slug: string | null;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
};

const itemTypeSelect = {
  id: true,
  name: true,
  kind: true,
  slug: true,
  icon: true,
  color: true,
  isSystem: true,
} as const;

function toResolvedItemType(row: RawItemTypeRow): ResolvedItemType {
  const name = row.name;
  const kind = row.isSystem
    ? getSystemKindForName(name)
    : normalizeItemTypeKind(row.kind);
  const slug = row.isSystem
    ? getTypeSlug(name)
    : (row.slug ?? getTypeSlug(name));

  return {
    id: row.id,
    name,
    slug,
    label: getPluralLabel(name, row.isSystem),
    icon: row.icon,
    color: row.color,
    kind,
    isSystem: row.isSystem,
  };
}

function getPluralLabel(name: string, isSystem: boolean): string {
  const normalized = name.toLowerCase();

  if (isSystem && normalized === "link") {
    return "Links";
  }

  if (isSystem) {
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}s`;
  }

  return name.trim();
}

export function resolveSlugForItemType(row: RawItemTypeRow): string {
  return toResolvedItemType(row).slug;
}

export const getUserItemTypes = cache(
  async (userId: string): Promise<ResolvedItemType[]> => {
    const rows = await prisma.itemType.findMany({
      where: {
        OR: [{ isSystem: true }, { userId }],
      },
      select: itemTypeSelect,
    });

    const system = sortItemTypesBySystemOrder(
      rows.filter((row) => row.isSystem),
    ).map(toResolvedItemType);

    const custom = rows
      .filter((row) => !row.isSystem)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
      .map(toResolvedItemType);

    return [...system, ...custom];
  },
);

export async function resolveItemTypeBySlug(
  userId: string,
  slug: string,
): Promise<ResolvedItemType | null> {
  const normalized = slug.toLowerCase();
  const systemName = parseItemTypeSlug(normalized);

  if (systemName) {
    const row = await prisma.itemType.findFirst({
      where: {
        isSystem: true,
        name: { equals: systemName, mode: "insensitive" },
      },
      select: itemTypeSelect,
    });

    return row ? toResolvedItemType(row) : null;
  }

  const custom = await prisma.itemType.findFirst({
    where: {
      userId,
      slug: normalized,
      isSystem: false,
    },
    select: itemTypeSelect,
  });

  return custom ? toResolvedItemType(custom) : null;
}

export async function resolveItemTypeById(
  userId: string,
  typeId: string,
): Promise<ResolvedItemType | null> {
  const row = await prisma.itemType.findFirst({
    where: {
      id: typeId,
      OR: [{ isSystem: true }, { userId }],
    },
    select: itemTypeSelect,
  });

  return row ? toResolvedItemType(row) : null;
}

export { getItemTypeBehaviour };

export function isCustomItemTypeProGatedForCreate(
  type: ResolvedItemType,
  isPro: boolean,
): boolean {
  return !type.isSystem && !isPro;
}

export function requiresProSubscription(type: ResolvedItemType): boolean {
  return type.kind === "file" || type.kind === "image";
}
