import type { Prisma } from "@/generated/prisma/client";
import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { createCollection } from "@/lib/db/collections";
import {
  createCustomItemTypeWithTransaction,
  CustomItemTypeLimitError,
} from "@/lib/db/item-types";
import { MAX_CUSTOM_ITEM_TYPES } from "@/lib/item-types/slug";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import {
  FreeTierLimitExceededError,
  runWithFreeTierCollectionGuard,
  runWithFreeTierItemGuard,
} from "@/lib/db/free-tier-limits";
import { activeItemWhere } from "@/lib/db/item-filters";
import { createItem, resolveTagNamesForUser } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ITEM_TYPE_ORDER } from "@/lib/item-type-styles";
import {
  FREE_ITEM_LIMIT,
  isProOnlyItemType,
} from "@/lib/subscription-limits";
import { createItemTypeSchema } from "@/lib/validations/item-types";
import {
  exportCustomTypeSchema,
  importCollectionInputSchema,
  importItemInputSchema,
  isExportArrayCapExceeded,
  parseMemexExport,
  type ImportItemInput,
  type MemexExport,
} from "@/lib/validations/export-import";

import { fetchActiveItemDuplicateFingerprints } from "./duplicate-hash";
import { buildImportDuplicateFingerprint } from "./duplicate-fingerprint";

const IMPORT_CHUNK_SIZE = 150;
const IMPORT_TX_TIMEOUT_MS = 30_000;

const SYSTEM_TYPE_NAMES = new Set<string>(
  SYSTEM_ITEM_TYPE_ORDER.map((name) => name.toLowerCase()),
);

export type ImportSummary = {
  created: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  skippedUnsupported: number;
  skippedLimit: number;
  skippedInvalidCollections: number;
  collectionsCreated: number;
  failed: number;
};

export type ImportRunResult =
  | ImportSummary
  | { error: "invalid_format" }
  | { error: "array_caps_exceeded" };

function isSystemTypeName(typeName: string): boolean {
  return SYSTEM_TYPE_NAMES.has(typeName.toLowerCase());
}

async function resolveItemTypeMap(
  userId: string,
): Promise<Map<string, string>> {
  const types = await prisma.itemType.findMany({
    where: {
      OR: [{ isSystem: true }, { userId }],
    },
    select: { id: true, name: true, isSystem: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  const map = new Map<string, string>();

  for (const type of types) {
    const key = type.name.toLowerCase();

    if (type.isSystem || !map.has(key)) {
      map.set(key, type.id);
    }
  }

  return map;
}

async function ensureImportCustomTypes(
  userId: string,
  exportData: MemexExport,
  typeIdByName: Map<string, string>,
): Promise<number> {
  if (!exportData.types?.length) {
    return 0;
  }

  let skippedInvalidTypes = 0;
  const pending: Array<{
    name: string;
    kind: "code" | "markdown" | "link";
    icon: string;
    color: string;
  }> = [];

  for (const raw of exportData.types) {
    const exportParsed = exportCustomTypeSchema.safeParse(raw);

    if (!exportParsed.success) {
      skippedInvalidTypes += 1;
      continue;
    }

    const createParsed = createItemTypeSchema.safeParse(exportParsed.data);

    if (!createParsed.success) {
      skippedInvalidTypes += 1;
      continue;
    }

    const key = createParsed.data.name.toLowerCase();

    if (typeIdByName.has(key)) {
      continue;
    }

    pending.push(createParsed.data);
  }

  if (pending.length === 0) {
    return skippedInvalidTypes;
  }

  await prisma.$transaction(async (tx) => {
    await takeUserAdvisoryLock(tx, userId);

    for (const input of pending) {
      const key = input.name.toLowerCase();

      if (typeIdByName.has(key)) {
        continue;
      }

      const customCount = await tx.itemType.count({
        where: { userId, isSystem: false },
      });

      if (customCount >= MAX_CUSTOM_ITEM_TYPES) {
        break;
      }

      try {
        const created = await createCustomItemTypeWithTransaction(
          userId,
          input,
          tx,
        );
        typeIdByName.set(key, created.id);
      } catch (error) {
        if (error instanceof CustomItemTypeLimitError) {
          break;
        }

        if (isUniqueConstraintError(error)) {
          const existing = await tx.itemType.findFirst({
            where: {
              userId,
              isSystem: false,
              name: { equals: input.name, mode: "insensitive" },
            },
            select: { id: true },
          });

          if (existing) {
            typeIdByName.set(key, existing.id);
          }
        }
      }
    }
  });

  return skippedInvalidTypes;
}

async function ensureCollections(
  userId: string,
  isPro: boolean,
  exportData: MemexExport,
): Promise<{
  nameToId: Map<string, string>;
  collectionsCreated: number;
  skippedInvalidCollections: number;
}> {
  const existing = await prisma.collection.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  const nameToId = new Map(
    existing.map((collection) => [
      collection.name.toLowerCase(),
      collection.id,
    ]),
  );

  let collectionsCreated = 0;
  let skippedInvalidCollections = 0;

  for (const collection of exportData.collections) {
    const parsed = importCollectionInputSchema.safeParse(collection);

    if (!parsed.success) {
      skippedInvalidCollections += 1;
      continue;
    }

    const key = parsed.data.name.toLowerCase();

    if (nameToId.has(key)) {
      continue;
    }

    try {
      const created = await runWithFreeTierCollectionGuard(userId, isPro, (db) =>
        createCollection(
          userId,
          {
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            isFavorite: parsed.data.isFavorite,
          },
          db,
        ),
      );

      nameToId.set(key, created.id);
      collectionsCreated += 1;
    } catch (error) {
      if (error instanceof FreeTierLimitExceededError) {
        break;
      }

      throw error;
    }
  }

  return { nameToId, collectionsCreated, skippedInvalidCollections };
}

async function insertImportItem(
  userId: string,
  validated: ImportItemInput,
  typeId: string,
  nameToId: Map<string, string>,
  db: Prisma.TransactionClient,
): Promise<void> {
  const collectionIds = validated.collections
    .map((name) => nameToId.get(name.toLowerCase()))
    .filter((id): id is string => Boolean(id));

  const tagNames = await resolveTagNamesForUser(userId, validated.tags, db);

  await createItem(
    userId,
    {
      typeId,
      title: validated.title,
      description: validated.description,
      content: validated.content,
      url: validated.url ?? null,
      language: validated.language,
      fileUrl: null,
      fileName: null,
      fileSize: null,
      tags: tagNames,
      collectionIds,
      contentType: "text",
      isFavorite: validated.isFavorite,
      isPinned: validated.isPinned,
    },
    db,
  );
}

async function importChunkWithTransaction(
  userId: string,
  isPro: boolean,
  chunk: ImportItemInput[],
  typeIdByName: Map<string, string>,
  nameToId: Map<string, string>,
  duplicateFingerprints: Set<string>,
  summary: ImportSummary,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await takeUserAdvisoryLock(tx, userId);

        let headroom = chunk.length;

        if (!isPro) {
          const count = await tx.item.count({ where: activeItemWhere(userId) });
          headroom = Math.max(0, FREE_ITEM_LIMIT - count);
        }

        const limited = chunk.slice(0, headroom);
        summary.skippedLimit += chunk.length - limited.length;

        for (const validated of limited) {
          const typeId = typeIdByName.get(validated.type.toLowerCase());

          if (!typeId) {
            summary.skippedInvalid += 1;
            continue;
          }

          const fingerprint = buildImportDuplicateFingerprint(
            validated.type,
            validated.title,
            validated.content,
            validated.url ?? null,
          );

          if (duplicateFingerprints.has(fingerprint)) {
            summary.skippedDuplicates += 1;
            continue;
          }

          try {
            await insertImportItem(
              userId,
              validated,
              typeId,
              nameToId,
              tx,
            );
            duplicateFingerprints.add(fingerprint);
            summary.created += 1;
          } catch {
            summary.failed += 1;
          }
        }
      },
      { timeout: IMPORT_TX_TIMEOUT_MS },
    );
  } catch {
    await importChunkPerItem(
      userId,
      isPro,
      chunk,
      typeIdByName,
      nameToId,
      duplicateFingerprints,
      summary,
    );
  }
}

async function importChunkPerItem(
  userId: string,
  isPro: boolean,
  chunk: ImportItemInput[],
  typeIdByName: Map<string, string>,
  nameToId: Map<string, string>,
  duplicateFingerprints: Set<string>,
  summary: ImportSummary,
): Promise<void> {
  for (const validated of chunk) {
    const typeId = typeIdByName.get(validated.type.toLowerCase());

    if (!typeId) {
      summary.skippedInvalid += 1;
      continue;
    }

    const fingerprint = buildImportDuplicateFingerprint(
      validated.type,
      validated.title,
      validated.content,
      validated.url ?? null,
    );

    if (duplicateFingerprints.has(fingerprint)) {
      summary.skippedDuplicates += 1;
      continue;
    }

    try {
      await runWithFreeTierItemGuard(userId, isPro, async (db) => {
        await insertImportItem(
          userId,
          validated,
          typeId,
          nameToId,
          db,
        );
      });

      duplicateFingerprints.add(fingerprint);
      summary.created += 1;
    } catch (error) {
      if (error instanceof FreeTierLimitExceededError) {
        summary.skippedLimit += 1;
        continue;
      }

      summary.failed += 1;
    }
  }
}

export async function runMemexImport(
  userId: string,
  isPro: boolean,
  raw: unknown,
): Promise<ImportRunResult> {
  if (isExportArrayCapExceeded(raw)) {
    return { error: "array_caps_exceeded" };
  }

  const exportData = parseMemexExport(raw);

  if (!exportData) {
    return { error: "invalid_format" };
  }

  const summary: ImportSummary = {
    created: 0,
    skippedDuplicates: 0,
    skippedInvalid: 0,
    skippedUnsupported: 0,
    skippedLimit: 0,
    skippedInvalidCollections: 0,
    collectionsCreated: 0,
    failed: 0,
  };

  const { nameToId, collectionsCreated, skippedInvalidCollections } =
    await ensureCollections(userId, isPro, exportData);

  summary.collectionsCreated = collectionsCreated;
  summary.skippedInvalidCollections = skippedInvalidCollections;

  const typeIdByName = await resolveItemTypeMap(userId);

  if (isPro) {
    summary.skippedInvalid += await ensureImportCustomTypes(
      userId,
      exportData,
      typeIdByName,
    );
  }

  const duplicateFingerprints =
    await fetchActiveItemDuplicateFingerprints(userId);

  const validatedItems: ImportItemInput[] = [];

  for (const item of exportData.items) {
    if (isProOnlyItemType(item.type)) {
      summary.skippedUnsupported += 1;
      continue;
    }

    if (!isPro && !isSystemTypeName(item.type)) {
      summary.skippedUnsupported += 1;
      continue;
    }

    const parsed = importItemInputSchema.safeParse(item);

    if (!parsed.success) {
      summary.skippedInvalid += 1;
      continue;
    }

    const fingerprint = buildImportDuplicateFingerprint(
      parsed.data.type,
      parsed.data.title,
      parsed.data.content,
      parsed.data.url ?? null,
    );

    if (duplicateFingerprints.has(fingerprint)) {
      summary.skippedDuplicates += 1;
      continue;
    }

    validatedItems.push(parsed.data);
  }

  for (let offset = 0; offset < validatedItems.length; offset += IMPORT_CHUNK_SIZE) {
    const chunk = validatedItems.slice(offset, offset + IMPORT_CHUNK_SIZE);

    await importChunkWithTransaction(
      userId,
      isPro,
      chunk,
      typeIdByName,
      nameToId,
      duplicateFingerprints,
      summary,
    );
  }

  return summary;
}
