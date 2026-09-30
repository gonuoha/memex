import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isPro: boolean;
};

/** Counts attached files (including trashed items) plus unattached uploads that have not been cleaned up yet. */
export async function getUserStorageUsageBytes(
  userId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const [items, pendingUploads] = await Promise.all([
    db.item.aggregate({
      where: { userId },
      _sum: { fileSize: true },
    }),
    db.pendingUpload.aggregate({
      where: { userId },
      _sum: { size: true },
    }),
  ]);

  return (items._sum.fileSize ?? 0) + (pendingUploads._sum.size ?? 0);
}

export async function getUserIsPro(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true },
  });

  return user?.isPro ?? false;
}

export const getCurrentUser = cache(async (): Promise<DashboardUser> => {
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
    },
  });

  if (!user?.name || !user.email) {
    redirect("/api/auth/signout?callbackUrl=/sign-in");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    isPro: user.isPro,
  };
});
