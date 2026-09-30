import type { Prisma } from "@/generated/prisma/client";

import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { activeItemWhere } from "@/lib/db/item-filters";
import { prisma } from "@/lib/prisma";
import {
  isAtCollectionLimit,
  isAtItemLimit,
} from "@/lib/subscription-limits";

export class FreeTierLimitExceededError extends Error {
  readonly kind: "item" | "collection";

  constructor(kind: "item" | "collection") {
    super(`Free tier ${kind} limit exceeded`);
    this.name = "FreeTierLimitExceededError";
    this.kind = kind;
  }
}

/** Always runs `create` in a transaction so callers can make related writes atomic with the insert. */
export async function runWithFreeTierItemGuard<T>(
  userId: string,
  isPro: boolean,
  create: (db: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isPro) {
    return prisma.$transaction((tx) => create(tx));
  }

  return prisma.$transaction(async (tx) => {
    await takeUserAdvisoryLock(tx, userId);
    const count = await tx.item.count({ where: activeItemWhere(userId) });

    if (isAtItemLimit(count, false)) {
      throw new FreeTierLimitExceededError("item");
    }

    return create(tx);
  });
}

export async function runWithFreeTierItemRestoreGuard<T>(
  userId: string,
  isPro: boolean,
  restore: (db: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isPro) {
    return restore(prisma);
  }

  return prisma.$transaction(async (tx) => {
    await takeUserAdvisoryLock(tx, userId);
    const count = await tx.item.count({ where: activeItemWhere(userId) });

    if (isAtItemLimit(count, false)) {
      throw new FreeTierLimitExceededError("item");
    }

    return restore(tx);
  });
}

export async function runWithFreeTierCollectionGuard<T>(
  userId: string,
  isPro: boolean,
  create: (db: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isPro) {
    return create(prisma);
  }

  return prisma.$transaction(async (tx) => {
    await takeUserAdvisoryLock(tx, userId);
    const count = await tx.collection.count({ where: { userId } });

    if (isAtCollectionLimit(count, false)) {
      throw new FreeTierLimitExceededError("collection");
    }

    return create(tx);
  });
}
