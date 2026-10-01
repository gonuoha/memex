import type { ItemDetail, UpdateItemData } from "@/lib/db/items";
import {
  itemDetailSelectFields,
  mapItemDetail,
  resolveTagNamesForUser,
} from "@/lib/db/items";
import { prisma } from "@/lib/prisma";
import { mergeApiV1ItemUpdate } from "@/lib/api/v1/patch-item";
import type { ApiV1UpdateItemInput } from "@/lib/validations/api-v1";

import { activeItemWhere } from "./item-filters";

export type PatchApiV1ItemResult =
  | { ok: true; item: ItemDetail }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "validation_error"; message: string; path: string };

export async function patchApiV1Item(
  userId: string,
  itemId: string,
  patch: ApiV1UpdateItemInput,
  rawBody: Record<string, unknown>,
): Promise<PatchApiV1ItemResult> {
  return prisma.$transaction(async (tx) => {
    const existingRow = await tx.item.findFirst({
      where: activeItemWhere(userId, { id: itemId }),
      select: itemDetailSelectFields,
    });

    if (!existingRow) {
      return { ok: false, code: "not_found" };
    }

    const existing = mapItemDetail(existingRow);
    const merged = mergeApiV1ItemUpdate(existing, patch, rawBody);

    if (!merged.ok) {
      return {
        ok: false,
        code: "validation_error",
        message: merged.message,
        path: merged.path,
      };
    }

    const data: UpdateItemData = merged.data;
    const tagNames = await resolveTagNamesForUser(userId, data.tags, tx);

    const item = await tx.item.update({
      where: { id: itemId },
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        url: data.url,
        language: data.language,
        tags: {
          deleteMany: {},
          create: tagNames.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { userId_name: { userId, name } },
                create: { userId, name },
              },
            },
          })),
        },
        collections: {
          deleteMany: {},
          create: data.collectionIds.map((collectionId) => ({
            collection: {
              connect: { id: collectionId },
            },
          })),
        },
      },
      select: itemDetailSelectFields,
    });

    return { ok: true, item: mapItemDetail(item) };
  });
}
