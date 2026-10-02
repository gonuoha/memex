import type { Prisma } from "@/generated/prisma/client";

import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { activeItemWhere } from "@/lib/db/item-filters";
import type { CustomCreatableKind } from "@/lib/item-types/kinds";
import { getSystemKindForName, kindsCompatibleForMove, normalizeItemTypeKind } from "@/lib/item-types/kinds";
import {
  dedupeItemTypeSlug,
  MAX_CUSTOM_ITEM_TYPES,
  slugifyItemTypeName,
} from "@/lib/item-types/slug";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type ItemTypeListEntry = {
  id: string;
  name: string;
  kind: string;
  slug: string | null;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  itemCount: number;
  totalItemCount: number;
};

export type CreatedItemType = {
  id: string;
  name: string;
  kind: string;
  slug: string;
  icon: string;
  color: string;
};

export class CustomItemTypeLimitError extends Error {
  constructor() {
    super("Custom item type limit reached");
    this.name = "CustomItemTypeLimitError";
  }
}

export async function listItemTypesForUser(
  userId: string,
): Promise<ItemTypeListEntry[]> {
  const [types, activeCounts, totalCounts] = await Promise.all([
    prisma.itemType.findMany({
      where: {
        OR: [{ isSystem: true }, { userId, isSystem: false }],
      },
      select: {
        id: true,
        name: true,
        kind: true,
        slug: true,
        icon: true,
        color: true,
        isSystem: true,
      },
    }),
    prisma.item.groupBy({
      by: ["typeId"],
      where: activeItemWhere(userId),
      _count: { _all: true },
    }),
    prisma.item.groupBy({
      by: ["typeId"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const activeCountByTypeId = new Map(
    activeCounts.map((row) => [row.typeId, row._count._all]),
  );
  const totalCountByTypeId = new Map(
    totalCounts.map((row) => [row.typeId, row._count._all]),
  );

  return types.map((type) => ({
    ...type,
    itemCount: activeCountByTypeId.get(type.id) ?? 0,
    totalItemCount: totalCountByTypeId.get(type.id) ?? 0,
  }));
}

export async function countCustomItemTypesForUser(
  userId: string,
  db: DbClient = prisma,
): Promise<number> {
  return db.itemType.count({
    where: { userId, isSystem: false },
  });
}

export async function countItemsForItemType(
  userId: string,
  typeId: string,
): Promise<number> {
  return prisma.item.count({
    where: activeItemWhere(userId, { typeId }),
  });
}

export async function countAllItemsForItemType(
  userId: string,
  typeId: string,
  db: DbClient = prisma,
): Promise<number> {
  return db.item.count({
    where: {
      userId,
      typeId,
    },
  });
}

async function collectTakenSlugs(
  userId: string,
  db: DbClient,
): Promise<Set<string>> {
  const rows = await db.itemType.findMany({
    where: { userId, isSystem: false, slug: { not: null } },
    select: { slug: true },
  });

  return new Set(
    rows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)),
  );
}

export async function createCustomItemTypeWithTransaction(
  userId: string,
  input: {
    name: string;
    kind: CustomCreatableKind;
    icon: string;
    color: string;
  },
  tx: Prisma.TransactionClient,
): Promise<CreatedItemType> {
  const customCount = await countCustomItemTypesForUser(userId, tx);

  if (customCount >= MAX_CUSTOM_ITEM_TYPES) {
    throw new CustomItemTypeLimitError();
  }

  const duplicateName = await tx.itemType.findFirst({
    where: {
      userId,
      isSystem: false,
      name: { equals: input.name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicateName) {
    throw new Error("DUPLICATE_NAME");
  }

  const takenSlugs = await collectTakenSlugs(userId, tx);
  const baseSlug = slugifyItemTypeName(input.name);
  const slug = dedupeItemTypeSlug(baseSlug, takenSlugs);

  const created = await tx.itemType.create({
    data: {
      userId,
      name: input.name,
      kind: input.kind,
      slug,
      icon: input.icon,
      color: input.color,
      isSystem: false,
    },
    select: {
      id: true,
      name: true,
      kind: true,
      slug: true,
      icon: true,
      color: true,
    },
  });

  return {
    id: created.id,
    name: created.name,
    kind: created.kind,
    slug: created.slug ?? slug,
    icon: created.icon ?? input.icon,
    color: created.color ?? input.color,
  };
}

export async function createCustomItemType(
  userId: string,
  input: {
    name: string;
    kind: CustomCreatableKind;
    icon: string;
    color: string;
  },
): Promise<CreatedItemType> {
  return prisma.$transaction(async (tx) => {
    await takeUserAdvisoryLock(tx, userId);

    return createCustomItemTypeWithTransaction(userId, input, tx);
  });
}

export async function updateCustomItemType(
  userId: string,
  typeId: string,
  input: {
    name?: string;
    kind?: CustomCreatableKind;
    icon?: string;
    color?: string;
  },
): Promise<CreatedItemType | null> {
  const existing = await prisma.itemType.findFirst({
    where: { id: typeId, userId, isSystem: false },
    select: {
      id: true,
      name: true,
      kind: true,
      slug: true,
      icon: true,
      color: true,
    },
  });

  if (!existing) {
    return null;
  }

  if (input.kind && input.kind !== existing.kind) {
    const itemCount = await countAllItemsForItemType(userId, typeId);

    if (itemCount > 0) {
      throw new Error("KIND_IMMUTABLE");
    }
  }

  let slug = existing.slug;

  if (input.name && input.name !== existing.name) {
    const takenSlugs = await collectTakenSlugs(userId, prisma);
    if (slug) {
      takenSlugs.delete(slug);
    }
    const baseSlug = slugifyItemTypeName(input.name);
    slug = dedupeItemTypeSlug(baseSlug, takenSlugs);
  }

  const updated = await prisma.itemType.update({
      where: { id: typeId },
      data: {
        ...(input.name ? { name: input.name, slug } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.icon ? { icon: input.icon } : {}),
        ...(input.color ? { color: input.color } : {}),
      },
      select: {
        id: true,
        name: true,
        kind: true,
        slug: true,
        icon: true,
        color: true,
      },
    });

  return {
    id: updated.id,
    name: updated.name,
    kind: updated.kind,
    slug: updated.slug ?? slug ?? slugifyItemTypeName(updated.name),
    icon: updated.icon ?? "",
    color: updated.color ?? "",
  };
}

export async function deleteCustomItemType(
  userId: string,
  typeId: string,
  moveToTypeId?: string,
): Promise<{ name: string } | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.itemType.findFirst({
      where: { id: typeId, userId, isSystem: false },
      select: { id: true, name: true, kind: true },
    });

    if (!existing) {
      return null;
    }

    const itemCount = await tx.item.count({
      where: { userId, typeId },
    });

    if (itemCount > 0) {
      const sourceKind = normalizeItemTypeKind(existing.kind);

      if (!moveToTypeId) {
        throw new Error("MOVE_REQUIRED");
      }

      if (moveToTypeId === typeId) {
        throw new Error("INVALID_MOVE_TARGET");
      }

      const target = await tx.itemType.findFirst({
        where: {
          id: moveToTypeId,
          OR: [{ isSystem: true }, { userId }],
        },
        select: { id: true, kind: true, name: true, isSystem: true },
      });

      if (!target) {
        throw new Error("INVALID_MOVE_TARGET");
      }

      const targetKind = target.isSystem
        ? getSystemKindForName(target.name)
        : normalizeItemTypeKind(target.kind);

      if (!kindsCompatibleForMove(sourceKind, targetKind)) {
        throw new Error("INCOMPATIBLE_MOVE");
      }

      await tx.item.updateMany({
        where: { userId, typeId },
        data: { typeId: moveToTypeId },
      });

      await tx.itemType.delete({
        where: { id: typeId },
      });

      return { name: existing.name };
    }

    await tx.itemType.delete({
      where: { id: typeId },
    });

    return { name: existing.name };
  });
}

export async function getOwnedCustomItemType(
  userId: string,
  typeId: string,
): Promise<{ id: string; kind: string } | null> {
  return prisma.itemType.findFirst({
    where: { id: typeId, userId, isSystem: false },
    select: { id: true, kind: true },
  });
}
