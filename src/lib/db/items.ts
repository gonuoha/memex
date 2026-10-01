import { cache } from "react";

import { Prisma, type Prisma as PrismaTypes } from "@/generated/prisma/client";
import { buildItemListPreview } from "@/lib/item-preview";
import { parseItemTypeSlug } from "@/lib/item-type-slugs";
import type { ItemsListSort } from "@/lib/items-list-params";
import { sortItemTypesBySystemOrder } from "@/lib/item-type-styles";
import {
  COLLECTIONS_PER_PAGE,
  getTotalPages,
  ITEMS_PER_PAGE,
  normalizePage,
  type PaginatedResult,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

import type { CollectionItemType } from "./collections";
import { activeItemWhere } from "./item-filters";
import { countUserTagsWithActiveItems, deleteOrphanTags } from "./tags";
import { daysUntilPermanentDeletion } from "./trash-retention";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function resolveTagNamesForUser(
  userId: string,
  names: string[],
  db: DbClient = prisma,
): Promise<string[]> {
  if (names.length === 0) {
    return [];
  }

  const existing = await db.tag.findMany({
    where: {
      userId,
      OR: names.map((name) => ({
        name: { equals: name, mode: "insensitive" },
      })),
    },
    select: { name: true },
  });

  const canonicalByLower = new Map(
    existing.map((tag) => [tag.name.toLowerCase(), tag.name]),
  );

  return names.map((name) => canonicalByLower.get(name.toLowerCase()) ?? name);
}

const pinnedFirstByUpdatedAt = [
  { isPinned: "desc" as const },
  { updatedAt: "desc" as const },
];

const pinnedFirstByCreatedAt = [
  { isPinned: "desc" as const },
  { createdAt: "desc" as const },
];

const pinnedFirstByTitleAsc = [
  { isPinned: "desc" as const },
  { title: "asc" as const },
];

const pinnedFirstByTitleDesc = [
  { isPinned: "desc" as const },
  { title: "desc" as const },
];

function getItemsListOrderBy(sort: ItemsListSort) {
  switch (sort) {
    case "created":
      return pinnedFirstByCreatedAt;
    case "title_asc":
      return pinnedFirstByTitleAsc;
    case "title_desc":
      return pinnedFirstByTitleDesc;
    case "updated":
    default:
      return pinnedFirstByUpdatedAt;
  }
}

function buildItemsListWhere(
  userId: string,
  base: PrismaTypes.ItemWhereInput,
  query: ItemsListQuery,
): PrismaTypes.ItemWhereInput {
  const tag = query.tag?.trim();
  const favoritesOnly = query.favoritesOnly ?? false;

  return activeItemWhere(userId, {
    ...base,
    ...(favoritesOnly ? { isFavorite: true } : {}),
    ...(tag
      ? {
          tags: {
            some: {
              tag: {
                name: { equals: tag, mode: "insensitive" },
              },
            },
          },
        }
      : {}),
  });
}

export type DashboardItem = {
  id: string;
  title: string;
  description: string | null;
  preview: string | null;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  language: string | null;
  fileUrl: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  type: CollectionItemType;
  tags: string[];
};

export type ItemTypeTagOption = {
  name: string;
  count: number;
};

export type ItemsListQuery = {
  sort: ItemsListSort;
  tag?: string | null;
  favoritesOnly?: boolean;
};

export type FileListItem = {
  id: string;
  title: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: Date;
  isPinned: boolean;
  isFavorite: boolean;
};

export type ItemDetail = {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  content: string | null;
  url: string | null;
  language: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  isFavorite: boolean;
  isPinned: boolean;
  type: CollectionItemType;
  tags: string[];
  collections: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export type UserItemStats = {
  itemCount: number;
  collectionCount: number;
  favoriteItemCount: number;
  favoriteCollectionCount: number;
  pinnedCount: number;
  trashCount: number;
  tagCount: number;
};

export type TrashedItem = {
  id: string;
  title: string;
  deletedAt: Date;
  daysUntilPurge: number;
  type: CollectionItemType;
};

const itemDetailSelect = {
  id: true,
  title: true,
  description: true,
  contentType: true,
  content: true,
  url: true,
  language: true,
  fileUrl: true,
  fileName: true,
  fileSize: true,
  isFavorite: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  type: {
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  },
  tags: {
    select: {
      tag: {
        select: {
          name: true,
        },
      },
    },
  },
  collections: {
    select: {
      collection: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      collection: {
        name: "asc",
      },
    },
  },
} as const;

const itemSelect = {
  id: true,
  title: true,
  description: true,
  url: true,
  fileName: true,
  fileSize: true,
  language: true,
  fileUrl: true,
  isPinned: true,
  isFavorite: true,
  createdAt: true,
  updatedAt: true,
  type: {
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  },
  tags: {
    select: {
      tag: {
        select: {
          name: true,
        },
      },
    },
  },
} as const;

type RawListItem = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  language: string | null;
  fileUrl: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  type: CollectionItemType;
  tags: { tag: { name: string } }[];
};

const CONTENT_PREVIEW_TYPES = new Set([
  "snippet",
  "command",
  "prompt",
  "note",
]);

async function fetchContentExcerpts(
  userId: string,
  itemIds: string[],
): Promise<Map<string, string>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.$queryRaw<{ id: string; excerpt: string | null }[]>`
    SELECT id, left(coalesce("content", ''), 300) AS excerpt
    FROM "Item"
    WHERE id IN (${Prisma.join(itemIds)})
      AND "userId" = ${userId}
      AND "deletedAt" IS NULL
  `;

  return new Map(
    rows.map((row) => [row.id, row.excerpt?.trim() ? row.excerpt : ""]),
  );
}

async function mapListItems(
  userId: string,
  items: RawListItem[],
): Promise<DashboardItem[]> {
  const contentIds = items
    .filter((item) => CONTENT_PREVIEW_TYPES.has(item.type.name.toLowerCase()))
    .map((item) => item.id);
  const excerpts = await fetchContentExcerpts(userId, contentIds);

  return items.map((item) => mapItem(item, excerpts.get(item.id) ?? null));
}

const fileItemSelect = {
  id: true,
  title: true,
  fileName: true,
  fileSize: true,
  createdAt: true,
  isPinned: true,
  isFavorite: true,
} as const;

function mapFileItem(item: {
  id: string;
  title: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: Date;
  isPinned: boolean;
  isFavorite: boolean;
}): FileListItem {
  return {
    id: item.id,
    title: item.title,
    fileName: item.fileName,
    fileSize: item.fileSize,
    createdAt: item.createdAt,
    isPinned: item.isPinned,
    isFavorite: item.isFavorite,
  };
}

export type ItemDetailRow = {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  content: string | null;
  url: string | null;
  language: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  type: CollectionItemType;
  tags: { tag: { name: string } }[];
  collections: { collection: { id: string; name: string } }[];
};

export const itemDetailSelectFields = itemDetailSelect;

export function mapItemDetail(item: ItemDetailRow): ItemDetail {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    contentType: item.contentType,
    content: item.content,
    url: item.url,
    language: item.language,
    fileUrl: item.fileUrl,
    fileName: item.fileName,
    fileSize: item.fileSize,
    isFavorite: item.isFavorite,
    isPinned: item.isPinned,
    type: item.type,
    tags: item.tags.map((entry) => entry.tag.name),
    collections: item.collections.map((entry) => entry.collection),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mapItem(
  item: RawListItem,
  contentExcerpt: string | null = null,
): DashboardItem {
  const typeName = item.type.name;
  const preview = buildItemListPreview({
    typeName,
    description: item.description,
    contentExcerpt,
    url: item.url,
    fileName: item.fileName,
  });

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    preview,
    url: item.url,
    fileName: item.fileName,
    fileSize: item.fileSize,
    language: item.language,
    fileUrl: item.fileUrl,
    isPinned: item.isPinned,
    isFavorite: item.isFavorite,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    type: item.type,
    tags: item.tags.map((entry) => entry.tag.name),
  };
}

export async function getItemById(
  userId: string,
  itemId: string,
): Promise<ItemDetail | null> {
  const item = await prisma.item.findFirst({
    where: activeItemWhere(userId, { id: itemId }),
    select: itemDetailSelect,
  });

  if (!item) {
    return null;
  }

  return mapItemDetail(item);
}

export async function getActiveItemsByIds(
  userId: string,
  ids: string[],
): Promise<ItemDetail[]> {
  if (ids.length === 0) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: activeItemWhere(userId, { id: { in: ids } }),
    select: itemDetailSelect,
  });

  const byId = new Map(items.map((item) => [item.id, mapItemDetail(item)]));

  return ids
    .map((id) => byId.get(id))
    .filter((item): item is ItemDetail => item !== undefined);
}

export type UpdateItemData = {
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  language: string | null;
  tags: string[];
  collectionIds: string[];
};

export type CreateItemData = {
  typeId: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  language: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  tags: string[];
  collectionIds: string[];
  contentType: "text" | "file";
  isFavorite?: boolean;
  isPinned?: boolean;
};

export async function createItem(
  userId: string,
  data: CreateItemData,
  db: DbClient = prisma,
): Promise<ItemDetail> {
  const tagNames = await resolveTagNamesForUser(userId, data.tags, db);

  const item = await db.item.create({
    data: {
      userId,
      typeId: data.typeId,
      title: data.title,
      description: data.description,
      content: data.content,
      url: data.url,
      language: data.language,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      contentType: data.contentType,
      ...(data.isFavorite !== undefined
        ? { isFavorite: data.isFavorite }
        : {}),
      ...(data.isPinned !== undefined ? { isPinned: data.isPinned } : {}),
      tags: {
        create: tagNames.map((name) => ({
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId, name } },
              create: { userId, name },
            },
          },
        })),
      },
      collections: {
        create: data.collectionIds.map((collectionId) => ({
          collection: {
            connect: { id: collectionId },
          },
        })),
      },
    },
    select: itemDetailSelect,
  });

  return mapItemDetail(item);
}

export async function updateItem(
  userId: string,
  itemId: string,
  data: UpdateItemData,
): Promise<ItemDetail | null> {
  const existing = await prisma.item.findFirst({
    where: activeItemWhere(userId, { id: itemId }),
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const previousTagLinks = await tx.itemTag.findMany({
      where: { itemId },
      select: { tagId: true },
    });
    const previousTagIds = previousTagLinks.map((link) => link.tagId);
    const tagNames = await resolveTagNamesForUser(userId, data.tags, tx);

    const item = await tx.item.update({
      where: { id: itemId },
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        url: data.url,
        language: data.language,
        tags: {
          deleteMany: {},
          create: tagNames.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { userId_name: { userId, name } },
                create: { userId, name },
              },
            },
          })),
        },
        collections: {
          deleteMany: {},
          create: data.collectionIds.map((collectionId) => ({
            collection: {
              connect: { id: collectionId },
            },
          })),
        },
      },
      select: itemDetailSelect,
    });

    await deleteOrphanTags(userId, previousTagIds, tx);

    return mapItemDetail(item);
  });
}

export type ToggleItemFavoriteResult = {
  id: string;
  isFavorite: boolean;
  typeName: string;
};

export async function toggleItemFavorite(
  userId: string,
  itemId: string,
): Promise<ToggleItemFavoriteResult | null> {
  const existing = await prisma.item.findFirst({
    where: activeItemWhere(userId, { id: itemId }),
    select: {
      id: true,
      isFavorite: true,
      type: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.item.update({
    where: { id: itemId },
    data: { isFavorite: !existing.isFavorite },
    select: {
      id: true,
      isFavorite: true,
      type: {
        select: {
          name: true,
        },
      },
    },
  });

  return {
    id: updated.id,
    isFavorite: updated.isFavorite,
    typeName: updated.type.name,
  };
}

export type ToggleItemPinResult = {
  id: string;
  isPinned: boolean;
  typeName: string;
};

export async function toggleItemPin(
  userId: string,
  itemId: string,
): Promise<ToggleItemPinResult | null> {
  const existing = await prisma.item.findFirst({
    where: activeItemWhere(userId, { id: itemId }),
    select: {
      id: true,
      isPinned: true,
      type: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.item.update({
    where: { id: itemId },
    data: { isPinned: !existing.isPinned },
    select: {
      id: true,
      isPinned: true,
      type: {
        select: {
          name: true,
        },
      },
    },
  });

  return {
    id: updated.id,
    isPinned: updated.isPinned,
    typeName: updated.type.name,
  };
}

export type DeleteItemResult = {
  typeName: string;
};

export async function deleteItem(
  userId: string,
  itemId: string,
): Promise<DeleteItemResult | null> {
  const existing = await prisma.item.findFirst({
    where: activeItemWhere(userId, { id: itemId }),
    select: {
      id: true,
      type: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.shareLink.updateMany({
      where: {
        userId,
        itemId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    await tx.item.update({
      where: { id: itemId },
      data: {
        deletedAt: now,
        isPinned: false,
      },
    });
  });

  return {
    typeName: existing.type.name,
  };
}

export type RestoreItemResult = {
  id: string;
  typeName: string;
};

export async function restoreItem(
  userId: string,
  itemId: string,
  db: DbClient = prisma,
): Promise<RestoreItemResult | null> {
  const existing = await db.item.findFirst({
    where: { id: itemId, userId, deletedAt: { not: null } },
    select: {
      id: true,
      type: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  await db.item.update({
    where: { id: itemId },
    data: { deletedAt: null },
  });

  return {
    id: existing.id,
    typeName: existing.type.name,
  };
}

export type PermanentDeleteItemResult = {
  typeName: string;
  fileUrl: string | null;
};

export async function permanentlyDeleteItem(
  userId: string,
  itemId: string,
): Promise<PermanentDeleteItemResult | null> {
  const existing = await prisma.item.findFirst({
    where: { id: itemId, userId, deletedAt: { not: null } },
    select: {
      id: true,
      fileUrl: true,
      type: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const tagLinks = await prisma.itemTag.findMany({
    where: { itemId },
    select: { tagId: true },
  });
  const tagIds = tagLinks.map((link) => link.tagId);

  const { count } = await prisma.item.deleteMany({
    where: { id: itemId, userId, deletedAt: { not: null } },
  });

  if (count === 0) {
    return null;
  }

  await deleteOrphanTags(userId, tagIds);

  return {
    typeName: existing.type.name,
    fileUrl: existing.fileUrl,
  };
}

export async function getFavoriteItems(userId: string): Promise<DashboardItem[]> {
  const items = await prisma.item.findMany({
    where: activeItemWhere(userId, { isFavorite: true }),
    orderBy: { updatedAt: "desc" },
    select: itemSelect,
  });

  return mapListItems(userId, items);
}

export async function getPinnedItems(
  userId: string,
  limit = 20,
): Promise<DashboardItem[]> {
  const items = await prisma.item.findMany({
    where: activeItemWhere(userId, { isPinned: true }),
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: itemSelect,
  });

  return mapListItems(userId, items);
}

export async function getRecentItems(
  userId: string,
  limit = 10,
): Promise<DashboardItem[]> {
  const items = await prisma.item.findMany({
    where: activeItemWhere(userId),
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: itemSelect,
  });

  return mapListItems(userId, items);
}

export async function getItemTypeBySlug(userId: string, slug: string) {
  const typeName = parseItemTypeSlug(slug);

  if (!typeName) {
    return null;
  }

  return prisma.itemType.findFirst({
    where: {
      name: { equals: typeName, mode: "insensitive" },
      OR: [{ isSystem: true }, { userId }],
    },
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  });
}

export type { PaginatedResult } from "@/lib/pagination";

export async function getItemTypeTags(
  userId: string,
  typeId: string,
): Promise<ItemTypeTagOption[]> {
  const rows = await prisma.itemTag.groupBy({
    by: ["tagId"],
    where: {
      item: activeItemWhere(userId, { typeId }),
    },
    _count: { _all: true },
  });

  if (rows.length === 0) {
    return [];
  }

  const tags = await prisma.tag.findMany({
    where: {
      id: { in: rows.map((row) => row.tagId) },
      userId,
    },
    select: { id: true, name: true },
  });

  const countByTagId = new Map(
    rows.map((row) => [row.tagId, row._count._all]),
  );

  return tags
    .map((tag) => ({
      name: tag.name,
      count: countByTagId.get(tag.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getItemsByTagPaginated(
  userId: string,
  tagId: string,
  page: number,
  query: Pick<ItemsListQuery, "sort"> = { sort: "updated" },
  pageSize: number = ITEMS_PER_PAGE,
): Promise<PaginatedResult<DashboardItem>> {
  const where = activeItemWhere(userId, {
    tags: {
      some: { tagId },
    },
  });
  const totalCount = await prisma.item.count({ where });
  const totalPages = getTotalPages(totalCount, pageSize);
  const normalizedPage = normalizePage(page, totalPages);
  const items = await prisma.item.findMany({
    where,
    orderBy: getItemsListOrderBy(query.sort),
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
    select: itemSelect,
  });

  return {
    items: await mapListItems(userId, items),
    totalCount,
    page: normalizedPage,
    pageSize,
    totalPages,
  };
}

export async function getItemsByTypePaginated(
  userId: string,
  typeId: string,
  page: number,
  query: ItemsListQuery = { sort: "updated" },
  pageSize: number = ITEMS_PER_PAGE,
): Promise<PaginatedResult<DashboardItem>> {
  const where = buildItemsListWhere(userId, { typeId }, query);
  const totalCount = await prisma.item.count({ where });
  const totalPages = getTotalPages(totalCount, pageSize);
  const normalizedPage = normalizePage(page, totalPages);
  const items = await prisma.item.findMany({
    where,
    orderBy: getItemsListOrderBy(query.sort),
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
    select: itemSelect,
  });

  return {
    items: await mapListItems(userId, items),
    totalCount,
    page: normalizedPage,
    pageSize,
    totalPages,
  };
}

export async function getItemsByCollectionPaginated(
  userId: string,
  collectionId: string,
  page: number,
  query: ItemsListQuery = { sort: "updated" },
  pageSize: number = COLLECTIONS_PER_PAGE,
): Promise<PaginatedResult<DashboardItem>> {
  const where = buildItemsListWhere(
    userId,
    {
      collections: {
        some: { collectionId },
      },
    },
    query,
  );
  const totalCount = await prisma.item.count({ where });
  const totalPages = getTotalPages(totalCount, pageSize);
  const normalizedPage = normalizePage(page, totalPages);
  const items = await prisma.item.findMany({
    where,
    orderBy: getItemsListOrderBy(query.sort),
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
    select: itemSelect,
  });

  return {
    items: await mapListItems(userId, items),
    totalCount,
    page: normalizedPage,
    pageSize,
    totalPages,
  };
}

export async function getFileItemsByTypePaginated(
  userId: string,
  typeId: string,
  page: number,
  query: ItemsListQuery = { sort: "updated" },
  pageSize: number = ITEMS_PER_PAGE,
): Promise<PaginatedResult<FileListItem>> {
  const where = buildItemsListWhere(userId, { typeId }, query);
  const totalCount = await prisma.item.count({ where });
  const totalPages = getTotalPages(totalCount, pageSize);
  const normalizedPage = normalizePage(page, totalPages);
  const orderBy =
    query.sort === "title_asc" || query.sort === "title_desc"
      ? getItemsListOrderBy(query.sort)
      : query.sort === "created"
        ? pinnedFirstByCreatedAt
        : pinnedFirstByUpdatedAt;
  const items = await prisma.item.findMany({
    where,
    orderBy,
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
    select: fileItemSelect,
  });

  return {
    items: items.map(mapFileItem),
    totalCount,
    page: normalizedPage,
    pageSize,
    totalPages,
  };
}

export async function getFileItemsByIds(
  userId: string,
  itemIds: string[],
): Promise<FileListItem[]> {
  if (itemIds.length === 0) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: activeItemWhere(userId, {
      id: { in: itemIds },
      type: {
        name: { equals: "file", mode: "insensitive" },
      },
    }),
    orderBy: pinnedFirstByCreatedAt,
    select: fileItemSelect,
  });

  return items.map(mapFileItem);
}

export type SystemItemType = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type SidebarItemType = SystemItemType & {
  itemCount: number;
};

export type SidebarItemCounts = {
  favoriteCount: number;
  pinnedCount: number;
  trashCount: number;
  tagCount: number;
};

export async function getSystemItemTypes(): Promise<SystemItemType[]> {
  const itemTypes = await prisma.itemType.findMany({
    where: { isSystem: true },
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
    },
  });

  return sortItemTypesBySystemOrder(itemTypes);
}

export async function getSidebarItemTypes(
  userId: string,
): Promise<SidebarItemType[]> {
  const [itemTypes, typeCounts] = await Promise.all([
    getSystemItemTypes(),
    prisma.item.groupBy({
      by: ["typeId"],
      where: activeItemWhere(userId),
      _count: { _all: true },
    }),
  ]);

  const countByTypeId = new Map(
    typeCounts.map((entry) => [entry.typeId, entry._count._all]),
  );

  return itemTypes.map((type) => ({
    ...type,
    itemCount: countByTypeId.get(type.id) ?? 0,
  }));
}

export const getUserItemStats = cache(
  async (userId: string): Promise<UserItemStats> => {
  const [
    itemCount,
    collectionCount,
    favoriteItemCount,
    favoriteCollectionCount,
    pinnedCount,
    trashCount,
    tagCount,
  ] = await Promise.all([
    prisma.item.count({ where: activeItemWhere(userId) }),
    prisma.collection.count({ where: { userId } }),
    prisma.item.count({ where: activeItemWhere(userId, { isFavorite: true }) }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
    prisma.item.count({ where: activeItemWhere(userId, { isPinned: true }) }),
    prisma.item.count({ where: { userId, deletedAt: { not: null } } }),
    countUserTagsWithActiveItems(userId),
  ]);

  return {
    itemCount,
    collectionCount,
    favoriteItemCount,
    favoriteCollectionCount,
    pinnedCount,
    trashCount,
    tagCount,
  };
  },
);

export async function getTrashedItemsPaginated(
  userId: string,
  page: number,
  pageSize: number = ITEMS_PER_PAGE,
): Promise<PaginatedResult<TrashedItem>> {
  const where = { userId, deletedAt: { not: null } };
  const totalCount = await prisma.item.count({ where });
  const totalPages = getTotalPages(totalCount, pageSize);
  const normalizedPage = normalizePage(page, totalPages);
  const items = await prisma.item.findMany({
    where,
    orderBy: { deletedAt: "desc" },
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      deletedAt: true,
      type: {
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
        },
      },
    },
  });

  return {
    items: items.flatMap(({ deletedAt, ...item }) =>
      deletedAt
        ? [
            {
              ...item,
              deletedAt,
              daysUntilPurge: daysUntilPermanentDeletion(deletedAt),
            },
          ]
        : [],
    ),
    totalCount,
    page: normalizedPage,
    pageSize,
    totalPages,
  };
}

export function toSidebarItemCounts(
  stats: UserItemStats,
): SidebarItemCounts {
  return {
    favoriteCount: stats.favoriteItemCount + stats.favoriteCollectionCount,
    pinnedCount: stats.pinnedCount,
    trashCount: stats.trashCount,
    tagCount: stats.tagCount,
  };
}
