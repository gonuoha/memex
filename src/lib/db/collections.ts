import {
  COLLECTIONS_PER_PAGE,
  getTotalPages,
  normalizePage,
  type PaginatedResult,
} from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import {
  activeItemCollectionFilter,
  collectionActiveItemCountSelect,
} from "./item-filters";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type CollectionItemType = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type DashboardCollection = {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  types: CollectionItemType[];
  dominantTypeColor: string | null;
};

export type DashboardStats = {
  itemCount: number;
  collectionCount: number;
  favoriteItemCount: number;
  favoriteCollectionCount: number;
};

export type SidebarCollection = {
  id: string;
  name: string;
  itemCount: number;
  dominantTypeColor: string | null;
};

export type CreatedCollection = {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
};

export type CollectionDetail = {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
};

export type SelectableCollection = {
  id: string;
  name: string;
};

export type FavoriteCollection = {
  id: string;
  name: string;
  updatedAt: Date;
};

type CollectionTypeAggregation = {
  types: CollectionItemType[];
  dominantTypeColor: string | null;
};

async function getCollectionTypeAggregations(
  collectionIds: string[],
): Promise<Map<string, CollectionTypeAggregation>> {
  const result = new Map<string, CollectionTypeAggregation>();

  if (collectionIds.length === 0) {
    return result;
  }

  const typeCounts = await prisma.itemCollection.findMany({
    where: {
      collectionId: { in: collectionIds },
      ...activeItemCollectionFilter,
    },
    select: {
      collectionId: true,
      item: {
        select: {
          typeId: true,
        },
      },
    },
  });

  const groupedCounts = new Map<string, Map<string, number>>();

  for (const row of typeCounts) {
    const countsByType =
      groupedCounts.get(row.collectionId) ?? new Map<string, number>();
    const currentCount = countsByType.get(row.item.typeId) ?? 0;
    countsByType.set(row.item.typeId, currentCount + 1);
    groupedCounts.set(row.collectionId, countsByType);
  }

  if (groupedCounts.size === 0) {
    for (const collectionId of collectionIds) {
      result.set(collectionId, { types: [], dominantTypeColor: null });
    }
    return result;
  }

  const typeIds = [
    ...new Set(
      [...groupedCounts.values()].flatMap((countsByType) => [
        ...countsByType.keys(),
      ]),
    ),
  ];
  const types = await prisma.itemType.findMany({
    where: { id: { in: typeIds } },
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  });
  const typeById = new Map(types.map((type) => [type.id, type]));

  for (const collectionId of collectionIds) {
    const countsByType = groupedCounts.get(collectionId);
    const uniqueTypes: CollectionItemType[] = [];
    let dominantTypeColor: string | null = null;
    let maxCount = 0;

    if (countsByType) {
      for (const [typeId, count] of countsByType) {
        const type = typeById.get(typeId);
        if (!type) {
          continue;
        }

        uniqueTypes.push(type);

        if (count > maxCount) {
          maxCount = count;
          dominantTypeColor = type.color;
        }
      }
    }

    result.set(collectionId, { types: uniqueTypes, dominantTypeColor });
  }

  return result;
}

function mapToDashboardCollection(
  collection: {
    id: string;
    name: string;
    description: string | null;
    isFavorite: boolean;
    _count: { items: number };
  },
  aggregation: CollectionTypeAggregation,
): DashboardCollection {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    isFavorite: collection.isFavorite,
    itemCount: collection._count.items,
    types: aggregation.types,
    dominantTypeColor: aggregation.dominantTypeColor,
  };
}

function mapToSidebarCollection(
  collection: {
    id: string;
    name: string;
    _count: { items: number };
  },
  aggregation: CollectionTypeAggregation,
): SidebarCollection {
  return {
    id: collection.id,
    name: collection.name,
    itemCount: collection._count.items,
    dominantTypeColor: aggregation.dominantTypeColor,
  };
}

const collectionCountInclude = collectionActiveItemCountSelect;

export async function getAllCollectionsPaginated(
  userId: string,
  page: number,
  pageSize: number = COLLECTIONS_PER_PAGE,
): Promise<PaginatedResult<DashboardCollection>> {
  const where = { userId };
  const totalCount = await prisma.collection.count({ where });
  const totalPages = getTotalPages(totalCount, pageSize);
  const normalizedPage = normalizePage(page, totalPages);
  const collections = await prisma.collection.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
    include: collectionCountInclude,
  });

  const aggregations = await getCollectionTypeAggregations(
    collections.map((collection) => collection.id),
  );

  return {
    items: collections.map((collection) =>
      mapToDashboardCollection(
        collection,
        aggregations.get(collection.id) ?? {
          types: [],
          dominantTypeColor: null,
        },
      ),
    ),
    totalCount,
    page: normalizedPage,
    pageSize,
    totalPages,
  };
}

export async function getCollectionById(
  userId: string,
  collectionId: string,
): Promise<CollectionDetail | null> {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    include: collectionCountInclude,
  });

  if (!collection) {
    return null;
  }

  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    isFavorite: collection.isFavorite,
    itemCount: collection._count.items,
  };
}

export async function getRecentCollections(
  userId: string,
  limit = 6,
): Promise<DashboardCollection[]> {
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: collectionCountInclude,
  });

  const aggregations = await getCollectionTypeAggregations(
    collections.map((collection) => collection.id),
  );

  return collections.map((collection) =>
    mapToDashboardCollection(
      collection,
      aggregations.get(collection.id) ?? { types: [], dominantTypeColor: null },
    ),
  );
}

export async function getAllFavoriteCollections(
  userId: string,
): Promise<FavoriteCollection[]> {
  return prisma.collection.findMany({
    where: { userId, isFavorite: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
    },
  });
}

export async function getFavoriteCollections(
  userId: string,
  limit = 10,
): Promise<SidebarCollection[]> {
  const collections = await prisma.collection.findMany({
    where: { userId, isFavorite: true },
    orderBy: { name: "asc" },
    take: limit,
    include: collectionCountInclude,
  });

  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    itemCount: collection._count.items,
    dominantTypeColor: null,
  }));
}

export async function getSidebarRecentCollections(
  userId: string,
  limit = 10,
): Promise<SidebarCollection[]> {
  const collections = await prisma.collection.findMany({
    where: { userId, isFavorite: false },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: collectionCountInclude,
  });

  const aggregations = await getCollectionTypeAggregations(
    collections.map((collection) => collection.id),
  );

  return collections.map((collection) =>
    mapToSidebarCollection(
      collection,
      aggregations.get(collection.id) ?? { types: [], dominantTypeColor: null },
    ),
  );
}

export async function createCollection(
  userId: string,
  data: {
    name: string;
    description: string | null;
    isFavorite?: boolean;
  },
  db: DbClient = prisma,
): Promise<CreatedCollection> {
  return db.collection.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      ...(data.isFavorite !== undefined
        ? { isFavorite: data.isFavorite }
        : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isFavorite: true,
    },
  });
}

export async function updateCollection(
  userId: string,
  collectionId: string,
  data: {
    name: string;
    description: string | null;
  },
): Promise<CreatedCollection | null> {
  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  return prisma.collection.update({
    where: { id: collectionId },
    data: {
      name: data.name,
      description: data.description,
    },
    select: {
      id: true,
      name: true,
      description: true,
      isFavorite: true,
    },
  });
}

export type ToggleCollectionFavoriteResult = {
  id: string;
  isFavorite: boolean;
};

export async function toggleCollectionFavorite(
  userId: string,
  collectionId: string,
): Promise<ToggleCollectionFavoriteResult | null> {
  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true, isFavorite: true },
  });

  if (!existing) {
    return null;
  }

  return prisma.collection.update({
    where: { id: collectionId },
    data: { isFavorite: !existing.isFavorite },
    select: {
      id: true,
      isFavorite: true,
    },
  });
}

export type DeletedCollection = {
  id: string;
  name: string;
};

export async function deleteCollection(
  userId: string,
  collectionId: string,
): Promise<DeletedCollection | null> {
  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true, name: true },
  });

  if (!existing) {
    return null;
  }

  await prisma.collection.delete({
    where: { id: collectionId },
  });

  return existing;
}

const SELECTABLE_COLLECTIONS_LIMIT = 500;

export async function getSelectableCollections(
  userId: string,
): Promise<SelectableCollection[]> {
  return prisma.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    take: SELECTABLE_COLLECTIONS_LIMIT,
    select: {
      id: true,
      name: true,
    },
  });
}

export async function validateUserCollectionIds(
  userId: string,
  collectionIds: string[],
): Promise<boolean> {
  if (collectionIds.length === 0) {
    return true;
  }

  const count = await prisma.collection.count({
    where: {
      userId,
      id: { in: collectionIds },
    },
  });

  return count === collectionIds.length;
}

export function toDashboardStats(stats: {
  itemCount: number;
  collectionCount: number;
  favoriteItemCount: number;
  favoriteCollectionCount: number;
}): DashboardStats {
  return {
    itemCount: stats.itemCount,
    collectionCount: stats.collectionCount,
    favoriteItemCount: stats.favoriteItemCount,
    favoriteCollectionCount: stats.favoriteCollectionCount,
  };
}
