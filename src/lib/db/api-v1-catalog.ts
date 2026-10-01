import { prisma } from "@/lib/prisma";

export async function listApiV1Collections(userId: string) {
  return prisma.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function listApiV1Tags(userId: string) {
  return prisma.tag.findMany({
    where: {
      userId,
      items: {
        some: {
          item: {
            deletedAt: null,
          },
        },
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}
