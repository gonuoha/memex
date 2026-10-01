import type { Prisma } from "@/generated/prisma/client";
import { parseItemTypeSlug } from "@/lib/item-type-slugs";
import { prisma } from "@/lib/prisma";
import {
  API_V1_MAX_SEARCH_OFFSET,
  decodeApiV1ListCursor,
  encodeApiV1ListCursor,
  hashApiV1ListFilters,
  type ApiV1KeysetCursor,
} from "@/lib/api/v1/item-cursors";
import { resolveTagIdForApiFilter } from "@/lib/db/api-v1-tag-filter";
import { searchApiV1ItemIds } from "@/lib/db/search";
import type { ApiV1ListItemsQuery } from "@/lib/validations/api-v1";

import { activeItemWhere } from "./item-filters";
import {
  itemDetailSelectFields,
  mapItemDetail,
  type ItemDetail,
} from "./items";

export type ApiV1ItemsPage = {
  items: ItemDetail[];
  nextCursor: string | null;
};

export type ListApiV1ItemsResult =
  | { ok: true; page: ApiV1ItemsPage }
  | { ok: false; code: "invalid_cursor" };

function buildStructuredFilters(
  query: ApiV1ListItemsQuery,
  tagId: string | null,
): Prisma.ItemWhereInput[] {
  const filters: Prisma.ItemWhereInput[] = [];

  if (query.type) {
    const typeName = parseItemTypeSlug(query.type);

    if (typeName) {
      filters.push({
        type: { name: { equals: typeName, mode: "insensitive" } },
      });
    }
  }

  if (query.tag) {
    if (tagId) {
      filters.push({
        tags: {
          some: {
            tagId,
          },
        },
      });
    } else {
      filters.push({ id: { in: [] } });
    }
  }

  if (query.collection) {
    filters.push({
      collections: {
        some: {
          collectionId: query.collection,
        },
      },
    });
  }

  return filters;
}

function buildKeysetWhere(
  userId: string,
  query: ApiV1ListItemsQuery,
  tagId: string | null,
  cursor: ApiV1KeysetCursor | null,
): Prisma.ItemWhereInput {
  const structured = buildStructuredFilters(query, tagId);
  const base = activeItemWhere(
    userId,
    structured.length > 0 ? { AND: structured } : undefined,
  );

  if (!cursor) {
    return base;
  }

  const updatedAt = new Date(cursor.u);

  return {
    ...base,
    AND: [
      ...(Array.isArray(base.AND) ? base.AND : base.AND ? [base.AND] : []),
      {
        OR: [
          { updatedAt: { lt: updatedAt } },
          {
            AND: [{ updatedAt }, { id: { lt: cursor.id } }],
          },
        ],
      },
    ],
  };
}

async function listKeysetPage(
  userId: string,
  query: ApiV1ListItemsQuery,
  tagId: string | null,
  cursor: ApiV1KeysetCursor | null,
  filterHash: string,
): Promise<ApiV1ItemsPage> {
  const rows = await prisma.item.findMany({
    where: buildKeysetWhere(userId, query, tagId, cursor),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    select: itemDetailSelectFields,
  });

  const hasMore = rows.length > query.limit;
  const pageRows = rows.slice(0, query.limit);
  const items = pageRows.map((row) => mapItemDetail(row));
  const last = pageRows.at(-1);

  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeApiV1ListCursor({
            k: "ks",
            id: last.id,
            u: last.updatedAt.toISOString(),
            h: filterHash,
          })
        : null,
  };
}

async function listSearchPage(
  userId: string,
  query: ApiV1ListItemsQuery,
  tagId: string | null,
  offset: number,
  effectiveLimit: number,
  filterHash: string,
): Promise<ApiV1ItemsPage> {
  const ids = await searchApiV1ItemIds(
    userId,
    query.q ?? "",
    {
      typeSlug: query.type ? parseItemTypeSlug(query.type) : null,
      tagId,
      collectionId: query.collection ?? null,
    },
    effectiveLimit + 1,
    offset,
  );

  const pageIds = ids.slice(0, effectiveLimit);
  const hasMoreIds = ids.length > effectiveLimit;
  const nextOffset = offset + effectiveLimit;

  if (pageIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  const rows = await prisma.item.findMany({
    where: activeItemWhere(userId, { id: { in: pageIds } }),
    select: itemDetailSelectFields,
  });

  const byId = new Map(rows.map((row) => [row.id, mapItemDetail(row)]));
  const items = pageIds
    .map((id) => byId.get(id))
    .filter((item): item is ItemDetail => item !== undefined);

  const canContinue =
    hasMoreIds && nextOffset < API_V1_MAX_SEARCH_OFFSET;

  return {
    items,
    nextCursor: canContinue
      ? encodeApiV1ListCursor({
          k: "q",
          o: nextOffset,
          h: filterHash,
        })
      : null,
  };
}

export async function listApiV1Items(
  userId: string,
  query: ApiV1ListItemsQuery,
): Promise<ListApiV1ItemsResult> {
  const filterHash = hashApiV1ListFilters(query);
  const tagId = query.tag
    ? await resolveTagIdForApiFilter(userId, query.tag)
    : null;

  if (query.q) {
    let offset = 0;

    if (query.cursor) {
      const decoded = decodeApiV1ListCursor(query.cursor);

      if (!decoded || decoded.k !== "q" || decoded.h !== filterHash) {
        return { ok: false, code: "invalid_cursor" };
      }

      offset = decoded.o;
    }

    const remainingBudget = API_V1_MAX_SEARCH_OFFSET - offset;

    if (remainingBudget <= 0) {
      return { ok: true, page: { items: [], nextCursor: null } };
    }

    const effectiveLimit = Math.min(query.limit, remainingBudget);
    const page = await listSearchPage(
      userId,
      query,
      tagId,
      offset,
      effectiveLimit,
      filterHash,
    );

    return { ok: true, page };
  }

  let keysetCursor: ApiV1KeysetCursor | null = null;

  if (query.cursor) {
    const decoded = decodeApiV1ListCursor(query.cursor);

    if (!decoded || decoded.k !== "ks" || decoded.h !== filterHash) {
      return { ok: false, code: "invalid_cursor" };
    }

    keysetCursor = decoded;
  }

  const page = await listKeysetPage(
    userId,
    query,
    tagId,
    keysetCursor,
    filterHash,
  );

  return { ok: true, page };
}
