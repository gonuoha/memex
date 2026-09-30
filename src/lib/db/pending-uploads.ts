import type { Prisma } from "@/generated/prisma/client";
import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { getUserStorageUsageBytes } from "@/lib/db/user";
import type { UploadCategory } from "@/lib/file-upload";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/r2/storage";
import { isAtStorageLimit } from "@/lib/subscription-limits";

export const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000;
export const MAX_PENDING_UPLOADS_PER_USER = 20;

const PENDING_UPLOAD_PURGE_BATCH_SIZE = 100;
const MAX_PENDING_UPLOAD_PURGE_BATCHES = 50;

export class PendingUploadNotFoundError extends Error {
  constructor() {
    super("Pending upload not found");
    this.name = "PendingUploadNotFoundError";
  }
}

export type PendingUploadRecord = {
  key: string;
  size: number;
  category: string;
};

export type ReservePendingUploadInput = {
  userId: string;
  key: string;
  size: number;
  category: UploadCategory;
  isPro: boolean;
};

export type ReservePendingUploadResult =
  | { success: true }
  | { success: false; reason: "too_many_pending" | "storage_quota" };

export function getPendingUploadExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + PENDING_UPLOAD_TTL_MS);
}

/** Reserves quota for an upload before its presigned URL is issued, so unattached objects still count. */
export async function reservePendingUpload(
  input: ReservePendingUploadInput,
): Promise<ReservePendingUploadResult> {
  return prisma.$transaction(async (tx) => {
    await takeUserAdvisoryLock(tx, input.userId);
    const now = new Date();

    const activeCount = await tx.pendingUpload.count({
      where: { userId: input.userId, expiresAt: { gt: now } },
    });

    if (activeCount >= MAX_PENDING_UPLOADS_PER_USER) {
      return { success: false, reason: "too_many_pending" };
    }

    const usedBytes = await getUserStorageUsageBytes(input.userId, tx);

    if (isAtStorageLimit(usedBytes, input.size, input.isPro)) {
      return { success: false, reason: "storage_quota" };
    }

    await tx.pendingUpload.create({
      data: {
        userId: input.userId,
        key: input.key,
        size: input.size,
        category: input.category,
        expiresAt: getPendingUploadExpiry(now),
      },
    });

    return { success: true };
  });
}

export async function findPendingUpload(
  userId: string,
  key: string,
): Promise<PendingUploadRecord | null> {
  return prisma.pendingUpload.findFirst({
    where: { userId, key },
    select: { key: true, size: true, category: true },
  });
}

/** Deleting the row in the item-creation transaction makes attach and cleanup mutually exclusive. */
export async function consumePendingUpload(
  tx: Prisma.TransactionClient,
  userId: string,
  key: string,
): Promise<void> {
  const { count } = await tx.pendingUpload.deleteMany({
    where: { userId, key },
  });

  if (count === 0) {
    throw new PendingUploadNotFoundError();
  }
}

/** Returns false when the row was already consumed or purged, in which case the object must not be deleted. */
export async function releasePendingUpload(
  userId: string,
  key: string,
): Promise<boolean> {
  const { count } = await prisma.pendingUpload.deleteMany({
    where: { userId, key },
  });

  return count > 0;
}

type PurgedPendingUploadRow = {
  id: string;
  userId: string;
  key: string;
  size: number;
  category: string;
  createdAt: Date;
};

async function deleteExpiredBatch(
  now: Date,
  userId: string | null,
): Promise<PurgedPendingUploadRow[]> {
  return prisma.$queryRaw<PurgedPendingUploadRow[]>`
    DELETE FROM "PendingUpload"
    WHERE "id" IN (
      SELECT "id"
      FROM "PendingUpload"
      WHERE "expiresAt" < ${now}
        AND (${userId}::text IS NULL OR "userId" = ${userId})
      ORDER BY "expiresAt" ASC
      LIMIT ${PENDING_UPLOAD_PURGE_BATCH_SIZE}
    )
    RETURNING "id", "userId", "key", "size", "category", "createdAt"
  `;
}

/** Rows whose objects could not be deleted are restored as already-expired so the next run retries them. */
async function deleteObjectsOrRestoreRows(
  rows: PurgedPendingUploadRow[],
  now: Date,
): Promise<boolean> {
  try {
    await deleteObjects(rows.map((row) => row.key));
    return true;
  } catch (error) {
    console.error("Failed to delete expired pending uploads from R2:", error);
    await prisma.pendingUpload.createMany({
      data: rows.map((row) => ({ ...row, expiresAt: now })),
      skipDuplicates: true,
    });
    return false;
  }
}

export async function purgeExpiredPendingUploads(options?: {
  userId?: string;
  now?: Date;
  maxBatches?: number;
}): Promise<number> {
  const now = options?.now ?? new Date();
  const maxBatches = options?.maxBatches ?? MAX_PENDING_UPLOAD_PURGE_BATCHES;
  let purgedCount = 0;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const rows = await deleteExpiredBatch(now, options?.userId ?? null);

    if (rows.length === 0) {
      break;
    }

    if (!(await deleteObjectsOrRestoreRows(rows, now))) {
      break;
    }

    purgedCount += rows.length;

    if (rows.length < PENDING_UPLOAD_PURGE_BATCH_SIZE) {
      break;
    }
  }

  return purgedCount;
}
