import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/r2/storage";

import { getTrashPurgeDeadline } from "./trash-retention";

const TRASH_DELETE_BATCH_SIZE = 100;
const MAX_PURGE_BATCHES = 50;

export type DeletedTrashResult = {
  deletedCount: number;
};

type TrashDeleteFilter = {
  userId?: string;
  deletedBefore?: Date;
};

function buildTrashWhere(filter: TrashDeleteFilter): Prisma.ItemWhereInput {
  return {
    ...(filter.userId ? { userId: filter.userId } : {}),
    deletedAt: filter.deletedBefore
      ? { lt: filter.deletedBefore }
      : { not: null },
  };
}

async function deleteStoredFiles(fileUrls: string[]): Promise<void> {
  if (fileUrls.length === 0) {
    return;
  }

  try {
    await deleteObjects(fileUrls);
  } catch (error) {
    console.error("Failed to delete trashed item files from R2:", error);
  }
}

async function findExistingIds(ids: string[]): Promise<Set<string>> {
  const items = await prisma.item.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });

  return new Set(items.map((item) => item.id));
}

/**
 * Rows are deleted with the trash condition re-applied and files are only
 * removed for rows that are actually gone, so an item restored mid-way keeps
 * both its row and its R2 object.
 */
async function deleteTrashedItems(
  filter: TrashDeleteFilter,
  maxBatches: number = Number.POSITIVE_INFINITY,
): Promise<DeletedTrashResult> {
  const where = buildTrashWhere(filter);
  let deletedCount = 0;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const batch = await prisma.item.findMany({
      where,
      orderBy: { deletedAt: "asc" },
      take: TRASH_DELETE_BATCH_SIZE,
      select: { id: true, fileUrl: true },
    });

    if (batch.length === 0) {
      break;
    }

    const ids = batch.map((item) => item.id);
    const { count } = await prisma.item.deleteMany({
      where: { ...where, id: { in: ids } },
    });

    const survivingIds =
      count === batch.length ? new Set<string>() : await findExistingIds(ids);

    await deleteStoredFiles(
      batch
        .filter((item) => !survivingIds.has(item.id))
        .flatMap((item) => (item.fileUrl ? [item.fileUrl] : [])),
    );

    deletedCount += count;

    if (batch.length < TRASH_DELETE_BATCH_SIZE) {
      break;
    }
  }

  return { deletedCount };
}

export function emptyTrash(userId: string): Promise<DeletedTrashResult> {
  return deleteTrashedItems({ userId });
}

export async function purgeExpiredTrash(): Promise<number> {
  const { deletedCount } = await deleteTrashedItems(
    { deletedBefore: getTrashPurgeDeadline() },
    MAX_PURGE_BATCHES,
  );

  return deletedCount;
}
