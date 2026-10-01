import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function resolveTagIdForApiFilter(
  userId: string,
  tagName: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT t."id" AS id
    FROM "Tag" t
    WHERE t."userId" = ${userId}
      AND lower(t."name") = lower(${tagName})
    LIMIT 1
  `;

  return rows[0]?.id ?? null;
}

export function buildApiV1TagIdFilterSql(tagId: string | null): Prisma.Sql {
  if (!tagId) {
    return Prisma.sql`AND 1 = 0`;
  }

  return Prisma.sql`AND EXISTS (
    SELECT 1
    FROM "ItemTag" itg
    WHERE itg."itemId" = i."id"
      AND itg."tagId" = ${tagId}
  )`;
}
