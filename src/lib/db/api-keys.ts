import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type ApiKeyListEntry = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type ApiKeyAuthRecord = {
  id: string;
  userId: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  user: { isPro: boolean };
};

const activeApiKeyWhere = (userId: string): Prisma.ApiKeyWhereInput => {
  const now = new Date();

  return {
    userId,
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
};

export async function listApiKeysForUser(
  userId: string,
  db: DbClient = prisma,
): Promise<ApiKeyListEntry[]> {
  return db.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

export async function countActiveApiKeysForUser(
  userId: string,
  db: DbClient = prisma,
): Promise<number> {
  return db.apiKey.count({
    where: activeApiKeyWhere(userId),
  });
}

export async function createApiKeyRecord(
  userId: string,
  data: {
    name: string;
    prefix: string;
    hashedKey: string;
    expiresAt: Date | null;
  },
  db: DbClient = prisma,
) {
  return db.apiKey.create({
    data: {
      userId,
      name: data.name,
      prefix: data.prefix,
      hashedKey: data.hashedKey,
      expiresAt: data.expiresAt,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function revokeApiKeyForUser(
  userId: string,
  keyId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  const existing = await db.apiKey.findFirst({
    where: { id: keyId, userId },
    select: { id: true, revokedAt: true },
  });

  if (!existing || existing.revokedAt) {
    return false;
  }

  await db.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  return true;
}

export async function revokeAllActiveApiKeysForUser(
  userId: string,
  db: DbClient = prisma,
): Promise<void> {
  const now = new Date();

  await db.apiKey.updateMany({
    where: activeApiKeyWhere(userId),
    data: { revokedAt: now },
  });
}

export async function findApiKeyByHash(
  hashedKey: string,
  db: DbClient = prisma,
): Promise<ApiKeyAuthRecord | null> {
  return db.apiKey.findUnique({
    where: { hashedKey },
    select: {
      id: true,
      userId: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { isPro: true } },
    },
  });
}

export async function touchApiKeyLastUsedAtConditional(
  keyId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - 60_000);

  await prisma.apiKey.updateMany({
    where: {
      id: keyId,
      OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cutoff } }],
    },
    data: { lastUsedAt: new Date() },
  });
}
