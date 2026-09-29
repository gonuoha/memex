import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getSystemItemTypes, getUserItemStats } from "@/lib/db/items";
import { getUserStorageUsageBytes } from "@/lib/db/user";
import { PRO_STORAGE_QUOTA_BYTES } from "@/lib/subscription-limits";
import { prisma } from "@/lib/prisma";

export type ProfileItemTypeCount = {
  name: string;
  icon: string | null;
  color: string | null;
  count: number;
};

export type ProfileData = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    isPro: boolean;
    createdAt: Date;
    hasPassword: boolean;
  };
  stats: {
    itemCount: number;
    collectionCount: number;
    storageUsedBytes: number;
    storageQuotaBytes: number;
  };
  itemTypeCounts: ProfileItemTypeCount[];
};

export const getProfileData = cache(async (): Promise<ProfileData> => {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isPro: true,
      createdAt: true,
      password: true,
    },
  });

  if (!user?.name || !user.email) {
    redirect("/api/auth/signout?callbackUrl=/sign-in");
  }

  const [stats, storageUsedBytes, typeCounts, systemTypes] = await Promise.all([
    getUserItemStats(user.id),
    user.isPro ? getUserStorageUsageBytes(user.id) : Promise.resolve(0),
    prisma.item.groupBy({
      by: ["typeId"],
      where: { userId: user.id },
      _count: { typeId: true },
    }),
    getSystemItemTypes(),
  ]);

  const countByTypeId = new Map(
    typeCounts.map((row) => [row.typeId, row._count.typeId]),
  );

  const itemTypeCounts = systemTypes.map((type) => ({
    name: type.name,
    icon: type.icon,
    color: type.color,
    count: countByTypeId.get(type.id) ?? 0,
  }));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      isPro: user.isPro,
      createdAt: user.createdAt,
      hasPassword: Boolean(user.password),
    },
    stats: {
      itemCount: stats.itemCount,
      collectionCount: stats.collectionCount,
      storageUsedBytes,
      storageQuotaBytes: user.isPro ? PRO_STORAGE_QUOTA_BYTES : 0,
    },
    itemTypeCounts,
  };
});
