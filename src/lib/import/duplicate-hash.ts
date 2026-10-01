import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export { buildImportDuplicateFingerprint } from "./duplicate-fingerprint";

type DuplicateRow = {
  type_name: string;
  title_key: string;
  content_hash: string;
  url_part: string;
};

export async function fetchActiveItemDuplicateFingerprints(
  userId: string,
): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<DuplicateRow[]>(Prisma.sql`
    SELECT
      lower(t.name) AS type_name,
      lower(trim(i.title)) AS title_key,
      md5(coalesce(i.content, '')) AS content_hash,
      coalesce(i.url, '') AS url_part
    FROM "Item" i
    INNER JOIN "ItemType" t ON i."typeId" = t.id
    WHERE i."userId" = ${userId}
      AND i."deletedAt" IS NULL
  `);

  const fingerprints = new Set<string>();

  for (const row of rows) {
    fingerprints.add(
      `${row.type_name}|${row.title_key}|${row.content_hash}|${row.url_part}`,
    );
  }

  return fingerprints;
}

export async function itemDuplicateExists(
  userId: string,
  fingerprint: string,
): Promise<boolean> {
  const set = await fetchActiveItemDuplicateFingerprints(userId);
  return set.has(fingerprint);
}
