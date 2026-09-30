import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildContainsLikePattern,
  buildPrefixTsQuery,
  getTypeNameCandidates,
  parseSearchQuery,
} from "@/lib/search-query";

export type SearchItemType = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type SearchItemTag = {
  id: string;
  name: string;
};

export type SearchItemResult = {
  id: string;
  title: string;
  snippet: string | null;
  type: SearchItemType;
  tags: SearchItemTag[];
};

export type SearchCollectionResult = {
  id: string;
  name: string;
  itemCount: number;
};

export type SearchItemsOptions = {
  limit: number;
};

const RECENT_ITEMS_LIMIT = 8;
const SNIPPET_MAX_LENGTH = 160;

type RawSearchRow = {
  id: string;
  title: string;
  snippet: string | null;
  type_id: string;
  type_name: string;
  type_icon: string | null;
  type_color: string | null;
};

type ItemSearchSql = {
  snippet: Prisma.Sql;
  match: Prisma.Sql;
  orderBy: Prisma.Sql;
};

export function normalizeSnippet(value: string | null): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= SNIPPET_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, SNIPPET_MAX_LENGTH - 3)}...`;
}

const PLAIN_SNIPPET_SQL = Prisma.sql`left(coalesce(nullif(btrim(i."description"), ''), i."content", ''), 200)`;

function buildRecentItemsSql(): ItemSearchSql {
  return {
    snippet: PLAIN_SNIPPET_SQL,
    match: Prisma.empty,
    orderBy: Prisma.sql`i."updatedAt" DESC`,
  };
}

/**
 * Match predicates are only emitted when they apply (no `$1 IS NULL OR ...`
 * guards) so the planner can use the tsvector GIN and title trigram indexes.
 */
function buildTextSearchSql(text: string): ItemSearchSql {
  const tsQuery = buildPrefixTsQuery(text);
  const titleSimilarity = Prisma.sql`similarity(i."title", ${text}) * 0.4`;
  const titleMatch = Prisma.sql`i."title" ILIKE ${buildContainsLikePattern(text)} OR i."title" % ${text}`;

  if (!tsQuery) {
    return {
      snippet: PLAIN_SNIPPET_SQL,
      match: Prisma.sql`AND (${titleMatch})`,
      orderBy: Prisma.sql`${titleSimilarity} DESC, i."updatedAt" DESC`,
    };
  }

  const query = Prisma.sql`to_tsquery('simple', ${tsQuery})`;

  return {
    snippet: Prisma.sql`ts_headline(
      'simple',
      concat_ws(' ', nullif(btrim(i."description"), ''), left(i."content", 2000)),
      ${query},
      'StartSel="", StopSel="", MaxFragments=1, MaxWords=20, MinWords=5, ShortWord=2'
    )`,
    match: Prisma.sql`AND (i."searchVector" @@ ${query} OR ${titleMatch})`,
    orderBy: Prisma.sql`ts_rank(i."searchVector", ${query}) + ${titleSimilarity} DESC, i."updatedAt" DESC`,
  };
}

function buildItemFilterSql(typeSlug: string | null, tag: string | null): Prisma.Sql {
  const typeFilter = typeSlug
    ? Prisma.sql`AND lower(it."name") = ANY(${getTypeNameCandidates(typeSlug)}::text[])`
    : Prisma.empty;
  const tagFilter = tag
    ? Prisma.sql`AND EXISTS (
        SELECT 1
        FROM "ItemTag" itg
        INNER JOIN "Tag" t ON t."id" = itg."tagId"
        WHERE itg."itemId" = i."id"
          AND lower(t."name") = ${tag}
      )`
    : Prisma.empty;

  return Prisma.sql`${typeFilter} ${tagFilter}`;
}

async function fetchTagsForItems(
  itemIds: string[],
): Promise<Map<string, SearchItemTag[]>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.itemTag.findMany({
    where: { itemId: { in: itemIds } },
    select: {
      itemId: true,
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const map = new Map<string, SearchItemTag[]>();

  for (const row of rows) {
    const current = map.get(row.itemId) ?? [];
    current.push(row.tag);
    map.set(row.itemId, current);
  }

  return map;
}

export async function searchItems(
  userId: string,
  query: string,
  options: SearchItemsOptions,
): Promise<SearchItemResult[]> {
  const parsed = parseSearchQuery(query);
  const hasFilters = Boolean(parsed.typeSlug || parsed.tag);
  const search = parsed.text
    ? buildTextSearchSql(parsed.text)
    : buildRecentItemsSql();
  const limit =
    parsed.text || hasFilters
      ? options.limit
      : Math.min(options.limit, RECENT_ITEMS_LIMIT);

  const rows = await prisma.$queryRaw<RawSearchRow[]>`
    SELECT
      i."id" AS id,
      i."title" AS title,
      ${search.snippet} AS snippet,
      it."id" AS type_id,
      it."name" AS type_name,
      it."icon" AS type_icon,
      it."color" AS type_color
    FROM "Item" i
    INNER JOIN "ItemType" it ON it."id" = i."typeId"
    WHERE i."userId" = ${userId}
      AND i."deletedAt" IS NULL
      ${buildItemFilterSql(parsed.typeSlug, parsed.tag)}
      ${search.match}
    ORDER BY ${search.orderBy}
    LIMIT ${limit}
  `;

  const tagMap = await fetchTagsForItems(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: normalizeSnippet(row.snippet),
    type: {
      id: row.type_id,
      name: row.type_name,
      icon: row.type_icon,
      color: row.type_color,
    },
    tags: tagMap.get(row.id) ?? [],
  }));
}

type RawCollectionRow = {
  id: string;
  name: string;
  item_count: bigint;
};

export async function searchCollections(
  userId: string,
  query: string,
  limit: number,
): Promise<SearchCollectionResult[]> {
  const parsed = parseSearchQuery(query);
  const text = parsed.text;

  if (!text && (parsed.typeSlug || parsed.tag)) {
    return [];
  }

  if (!text) {
    const collections = await prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            items: {
              where: {
                item: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      },
    });

    return collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      itemCount: collection._count.items,
    }));
  }

  const likePattern = buildContainsLikePattern(text);

  const rows = await prisma.$queryRaw<RawCollectionRow[]>`
    SELECT
      c."id" AS id,
      c."name" AS name,
      (
        SELECT count(*)::bigint
        FROM "ItemCollection" ic
        INNER JOIN "Item" i ON i."id" = ic."itemId"
        WHERE ic."collectionId" = c."id"
          AND i."deletedAt" IS NULL
      ) AS item_count
    FROM "Collection" c
    WHERE c."userId" = ${userId}
      AND (c."name" ILIKE ${likePattern} OR c."name" % ${text})
    ORDER BY
      similarity(c."name", ${text})
        + CASE WHEN c."name" ILIKE ${likePattern} THEN 0.5 ELSE 0 END
        DESC,
      c."updatedAt" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    itemCount: Number(row.item_count),
  }));
}
