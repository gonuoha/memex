import { prisma } from "@/lib/prisma";
import {
  buildPrefixTsQuery,
  parseSearchQuery,
  type ParsedSearchQuery,
} from "@/lib/search-query";

import { activeItemWhere } from "./item-filters";

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
  typeSlug?: string | null;
  tag?: string | null;
};

const RECENT_ITEMS_LIMIT = 8;

const itemTagSelect = {
  tags: {
    select: {
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

function buildSnippet(
  description: string | null,
  content: string | null,
): string | null {
  const source = description?.trim() || content?.trim();

  if (!source) {
    return null;
  }

  const normalized = source.replace(/\s+/g, " ");

  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157)}...`;
}

function mapItemsWithTags(
  rows: {
    id: string;
    title: string;
    description: string | null;
    content: string | null;
    type: SearchItemType;
    tags: { tag: SearchItemTag }[];
  }[],
  snippetById?: Map<string, string | null>,
): SearchItemResult[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet:
      snippetById?.get(row.id) ??
      buildSnippet(row.description, row.content),
    type: row.type,
    tags: row.tags.map((entry) => entry.tag),
  }));
}

async function getRecentSearchItems(
  userId: string,
  options: SearchItemsOptions,
): Promise<SearchItemResult[]> {
  const parsedType = options.typeSlug?.trim().toLowerCase() || null;
  const parsedTag = options.tag?.trim().toLowerCase() || null;

  const items = await prisma.item.findMany({
    where: activeItemWhere(userId, {
      ...(parsedType
        ? { type: { name: parsedType } }
        : {}),
      ...(parsedTag
        ? {
            tags: {
              some: {
                tag: {
                  name: { equals: parsedTag, mode: "insensitive" },
                },
              },
            },
          }
        : {}),
    }),
    orderBy: { updatedAt: "desc" },
    take: options.limit,
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      type: {
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
        },
      },
      ...itemTagSelect,
    },
  });

  return mapItemsWithTags(items);
}

type RawSearchRow = {
  id: string;
  title: string;
  snippet: string | null;
  type_id: string;
  type_name: string;
  type_icon: string | null;
  type_color: string | null;
  rank: number;
};

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

async function searchItemsWithFullText(
  userId: string,
  parsed: ParsedSearchQuery,
  options: SearchItemsOptions,
): Promise<SearchItemResult[]> {
  const limit = options.limit;
  const typeSlug =
    options.typeSlug?.trim().toLowerCase() ||
    parsed.typeSlug?.trim().toLowerCase() ||
    null;
  const tag =
    options.tag?.trim().toLowerCase() ||
    parsed.tag?.trim().toLowerCase() ||
    null;
  const text = parsed.text.trim();
  const prefixQuery = buildPrefixTsQuery(text);
  const safeIlikeText = text.replace(/[%_]/g, " ").trim();
  const ilikePattern = safeIlikeText ? `%${safeIlikeText}%` : null;

  const rows = await prisma.$queryRaw<RawSearchRow[]>`
    SELECT
      i."id" AS id,
      i."title" AS title,
      CASE
        WHEN ${prefixQuery}::text IS NOT NULL THEN
          ts_headline(
            'simple',
            coalesce(i."description", left(i."content", 500), ''),
            to_tsquery('simple', ${prefixQuery}),
            'StartSel="", StopSel="", MaxFragments=1, MaxWords=20, MinWords=5, ShortWord=2'
          )
        ELSE left(coalesce(i."description", i."content", ''), 160)
      END AS snippet,
      it."id" AS type_id,
      it."name" AS type_name,
      it."icon" AS type_icon,
      it."color" AS type_color,
      (
        coalesce(
          CASE
            WHEN ${prefixQuery}::text IS NOT NULL THEN
              ts_rank(i."searchVector", to_tsquery('simple', ${prefixQuery}))
            ELSE 0
          END,
          0
        )
        + coalesce(similarity(i."title", ${text}), 0) * 0.4
        + extract(epoch from i."updatedAt") / 1e12
      ) AS rank
    FROM "Item" i
    INNER JOIN "ItemType" it ON it."id" = i."typeId"
    WHERE i."userId" = ${userId}
      AND i."deletedAt" IS NULL
      AND (${typeSlug}::text IS NULL OR lower(it."name") = ${typeSlug})
      AND (
        ${tag}::text IS NULL
        OR EXISTS (
          SELECT 1
          FROM "ItemTag" itg
          INNER JOIN "Tag" t ON t."id" = itg."tagId"
          WHERE itg."itemId" = i."id"
            AND lower(t."name") = ${tag}
        )
      )
      AND (
        ${text} = ''
        OR (
          ${prefixQuery}::text IS NOT NULL
          AND i."searchVector" @@ to_tsquery('simple', ${prefixQuery})
        )
        OR (${ilikePattern}::text IS NOT NULL AND i."title" ILIKE ${ilikePattern})
        OR similarity(i."title", ${text}) > 0.25
      )
    ORDER BY rank DESC, i."updatedAt" DESC
    LIMIT ${limit}
  `;

  const tagMap = await fetchTagsForItems(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: row.snippet?.trim() ? row.snippet.trim() : null,
    type: {
      id: row.type_id,
      name: row.type_name,
      icon: row.type_icon,
      color: row.type_color,
    },
    tags: tagMap.get(row.id) ?? [],
  }));
}

export async function searchItems(
  userId: string,
  query: string,
  options: SearchItemsOptions,
): Promise<SearchItemResult[]> {
  const parsed = parseSearchQuery(query);
  const hasFilters = Boolean(parsed.typeSlug || parsed.tag);
  const hasText = parsed.text.trim().length > 0;

  if (!hasText && !hasFilters) {
    return getRecentSearchItems(userId, {
      ...options,
      limit: Math.min(options.limit, RECENT_ITEMS_LIMIT),
    });
  }

  if (!hasText && hasFilters) {
    return getRecentSearchItems(userId, {
      ...options,
      typeSlug: parsed.typeSlug,
      tag: parsed.tag,
    });
  }

  return searchItemsWithFullText(userId, parsed, options);
}

type RawCollectionRow = {
  id: string;
  name: string;
  item_count: bigint;
  rank: number;
};

export async function searchCollections(
  userId: string,
  query: string,
  limit: number,
): Promise<SearchCollectionResult[]> {
  const parsed = parseSearchQuery(query);
  const text = parsed.text.trim();

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

  const safeIlikeText = text.replace(/[%_]/g, " ").trim();
  const ilikePattern = `%${safeIlikeText}%`;

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
      ) AS item_count,
      (
        coalesce(similarity(c."name", ${text}), 0)
        + CASE WHEN c."name" ILIKE ${ilikePattern} THEN 0.5 ELSE 0 END
        + extract(epoch from c."updatedAt") / 1e12
      ) AS rank
    FROM "Collection" c
    WHERE c."userId" = ${userId}
      AND (
        c."name" ILIKE ${ilikePattern}
        OR similarity(c."name", ${text}) > 0.2
      )
    ORDER BY rank DESC, c."name" ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    itemCount: Number(row.item_count),
  }));
}
