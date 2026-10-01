import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { activeItemWhere } from "./item-filters";

type DbClient = Prisma.TransactionClient | typeof prisma;

const activeTaggedItemWhere = (userId: string) => ({
  items: {
    some: {
      item: activeItemWhere(userId),
    },
  },
});

export type UserTagRow = {
  id: string;
  name: string;
  itemCount: number;
};

export type RenamedTagResult = {
  id: string;
  name: string;
  merged: boolean;
};

export async function deleteOrphanTags(
  userId: string,
  tagIds?: string[],
  db: DbClient = prisma,
): Promise<number> {
  if (tagIds !== undefined && tagIds.length === 0) {
    return 0;
  }

  const { count } = await db.tag.deleteMany({
    where: {
      userId,
      ...(tagIds ? { id: { in: tagIds } } : {}),
      items: { none: {} },
    },
  });

  return count;
}

export async function getUserTagsWithCounts(
  userId: string,
): Promise<UserTagRow[]> {
  const tags = await prisma.tag.findMany({
    where: {
      userId,
      ...activeTaggedItemWhere(userId),
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          items: {
            where: {
              item: activeItemWhere(userId),
            },
          },
        },
      },
    },
  });

  return tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      itemCount: tag._count.items,
    }))
    .sort((a, b) => {
      if (b.itemCount !== a.itemCount) {
        return b.itemCount - a.itemCount;
      }

      return a.name.localeCompare(b.name);
    });
}

export async function getUserTagByName(
  userId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const trimmed = name.trim();

  const exact = await prisma.tag.findFirst({
    where: { userId, name: trimmed },
    select: { id: true, name: true },
  });

  if (exact) {
    return exact;
  }

  return prisma.tag.findFirst({
    where: {
      userId,
      name: { equals: trimmed, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

async function mergeTagsIntoKeeper(
  tx: DbClient,
  userId: string,
  keeperId: string,
  mergeFromIds: string[],
): Promise<void> {
  for (const variantId of mergeFromIds) {
    const links = await tx.itemTag.findMany({
      where: { tagId: variantId },
      select: { itemId: true },
    });

    if (links.length > 0) {
      await tx.itemTag.createMany({
        data: links.map((link) => ({
          itemId: link.itemId,
          tagId: keeperId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.itemTag.deleteMany({ where: { tagId: variantId } });
    await tx.tag.deleteMany({ where: { id: variantId, userId } });
  }
}

async function consolidateNameVariants(
  tx: DbClient,
  userId: string,
  trimmed: string,
): Promise<RenamedTagResult> {
  const variants = await tx.tag.findMany({
    where: {
      userId,
      name: { equals: trimmed, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const keeper =
    variants.find((variant) => variant.name === trimmed) ?? variants[0];
  const mergeFromIds = variants
    .filter((variant) => variant.id !== keeper.id)
    .map((variant) => variant.id);

  if (mergeFromIds.length > 0) {
    await mergeTagsIntoKeeper(tx, userId, keeper.id, mergeFromIds);
  }

  let finalName = keeper.name;

  if (keeper.name !== trimmed) {
    const updated = await tx.tag.update({
      where: { id: keeper.id },
      data: { name: trimmed },
      select: { id: true, name: true },
    });
    finalName = updated.name;
  }

  return {
    id: keeper.id,
    name: finalName,
    merged: mergeFromIds.length > 0,
  };
}

export async function renameTag(
  userId: string,
  tagId: string,
  newName: string,
): Promise<RenamedTagResult | null> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.tag.findFirst({
      where: { id: tagId, userId },
      select: { id: true, name: true },
    });

    if (!source) {
      return null;
    }

    const trimmed = newName.trim();

    if (source.name.toLowerCase() !== trimmed.toLowerCase()) {
      const target = await tx.tag.findFirst({
        where: {
          userId,
          name: { equals: trimmed, mode: "insensitive" },
          NOT: { id: source.id },
        },
        select: { id: true, name: true },
      });

      if (target) {
        await mergeTagsIntoKeeper(tx, userId, target.id, [source.id]);

        return { id: target.id, name: target.name, merged: true };
      }

      const updated = await tx.tag.update({
        where: { id: source.id },
        data: { name: trimmed },
        select: { id: true, name: true },
      });

      return { id: updated.id, name: updated.name, merged: false };
    }

    return consolidateNameVariants(tx, userId, trimmed);
  });
}

export async function deleteTag(
  userId: string,
  tagId: string,
): Promise<{ name: string } | null> {
  const existing = await prisma.tag.findFirst({
    where: { id: tagId, userId },
    select: { id: true, name: true },
  });

  if (!existing) {
    return null;
  }

  const { count } = await prisma.tag.deleteMany({
    where: { id: tagId, userId },
  });

  if (count === 0) {
    return null;
  }

  return { name: existing.name };
}

export async function countUserTagsWithActiveItems(
  userId: string,
): Promise<number> {
  return prisma.tag.count({
    where: {
      userId,
      ...activeTaggedItemWhere(userId),
    },
  });
}
