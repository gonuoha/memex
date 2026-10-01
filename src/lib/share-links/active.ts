import type { Prisma } from "@/generated/prisma/client";

export function activeShareLinkWhere(
  now: Date = new Date(),
): Prisma.ShareLinkWhereInput {
  return {
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export function isShareLinkActive(
  link: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (link.revokedAt) {
    return false;
  }

  if (link.expiresAt && link.expiresAt <= now) {
    return false;
  }

  return true;
}

export function expiresAtFromDays(
  expiresInDays: number | null,
  from: Date = new Date(),
): Date | null {
  if (expiresInDays === null) {
    return null;
  }

  const expiresAt = new Date(from);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);
  return expiresAt;
}
