import type { Prisma } from "@/generated/prisma/client";

/** Serializes per-user quota checks (items, collections, storage) within a transaction. */
export async function takeUserAdvisoryLock(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}
