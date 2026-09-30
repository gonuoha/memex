import type { Prisma } from "@/generated/prisma/client";

export const notTrashed: Prisma.ItemWhereInput = {
  deletedAt: null,
};

export function activeItemWhere(
  userId: string,
  extra?: Prisma.ItemWhereInput,
): Prisma.ItemWhereInput {
  return {
    userId,
    ...notTrashed,
    ...extra,
  };
}

export const activeItemCollectionFilter: Prisma.ItemCollectionWhereInput = {
  item: notTrashed,
};

export const collectionActiveItemCountSelect = {
  _count: {
    select: {
      items: {
        where: activeItemCollectionFilter,
      },
    },
  },
} as const;
