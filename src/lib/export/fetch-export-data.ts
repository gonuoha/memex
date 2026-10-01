import { activeItemWhere } from "@/lib/db/item-filters";
import { prisma } from "@/lib/prisma";
import type { MemexExport, MemexExportItem } from "@/lib/validations/export-import";

const EXPORT_ITEM_BATCH_SIZE = 500;

function mapRowToExportItem(
  item: {
    title: string;
    description: string | null;
    content: string | null;
    url: string | null;
    language: string | null;
    isFavorite: boolean;
    isPinned: boolean;
    fileName: string | null;
    fileSize: number | null;
    createdAt: Date;
    updatedAt: Date;
    type: { name: string };
    tags: { tag: { name: string } }[];
    collections: { collection: { name: string } }[];
  },
): MemexExportItem {
  const typeName = item.type.name.toLowerCase();
  const base = {
    type: typeName as MemexExportItem["type"],
    title: item.title,
    description: item.description,
    content: item.content,
    url: item.url,
    language: item.language,
    isFavorite: item.isFavorite,
    isPinned: item.isPinned,
    tags: item.tags.map((entry) => entry.tag.name),
    collections: item.collections.map((entry) => entry.collection.name),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };

  if (
    (typeName === "file" || typeName === "image") &&
    item.fileName &&
    item.fileSize !== null
  ) {
    return {
      ...base,
      file: {
        fileName: item.fileName,
        fileSize: item.fileSize,
      },
    };
  }

  return base;
}

async function fetchExportItems(userId: string): Promise<MemexExportItem[]> {
  const items: MemexExportItem[] = [];
  let cursorId: string | undefined;

  while (true) {
    const batch = await prisma.item.findMany({
      where: activeItemWhere(userId),
      orderBy: { id: "asc" },
      take: EXPORT_ITEM_BATCH_SIZE,
      ...(cursorId
        ? {
            skip: 1,
            cursor: { id: cursorId },
          }
        : {}),
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        url: true,
        language: true,
        isFavorite: true,
        isPinned: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
        type: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
        collections: {
          select: { collection: { select: { name: true } } },
        },
      },
    });

    if (batch.length === 0) {
      break;
    }

    items.push(...batch.map((row) => mapRowToExportItem(row)));
    cursorId = batch[batch.length - 1]?.id;
  }

  return items;
}

export async function fetchMemexExportData(userId: string): Promise<MemexExport> {
  const [items, collections] = await Promise.all([
    fetchExportItems(userId),
    prisma.collection.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        name: true,
        description: true,
        isFavorite: true,
      },
    }),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
    collections: collections.map((collection) => ({
      name: collection.name,
      description: collection.description,
      isFavorite: collection.isFavorite,
    })),
  };
}
