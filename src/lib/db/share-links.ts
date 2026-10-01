import type { Prisma } from "@/generated/prisma/client";
import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { activeItemWhere } from "@/lib/db/item-filters";
import { prisma } from "@/lib/prisma";
import {
  activeShareLinkWhere,
  expiresAtFromDays,
  isShareLinkActive,
} from "@/lib/share-links/active";
import {
  FREE_ACTIVE_SHARE_LINK_LIMIT,
  isShareableItemType,
} from "@/lib/share-links/constants";
import { generateShareLinkToken } from "@/lib/share-links/token";

export type ShareLinkRecord = {
  id: string;
  token: string;
  itemId: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
};

export type ShareLinkListEntry = ShareLinkRecord & {
  itemTitle: string;
  itemTypeName: string;
};

export type PublicSharedItem = {
  title: string;
  typeName: string;
  description: string | null;
  content: string | null;
  url: string | null;
  language: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

const activeShareLinkForActiveItemWhere = {
  ...activeShareLinkWhere(),
  item: { deletedAt: null },
} satisfies Prisma.ShareLinkWhereInput;

function mapShareLink(link: {
  id: string;
  token: string;
  itemId: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
}): ShareLinkRecord {
  return {
    id: link.id,
    token: link.token,
    itemId: link.itemId,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt,
  };
}

const shareLinkSelect = {
  id: true,
  token: true,
  itemId: true,
  createdAt: true,
  expiresAt: true,
  revokedAt: true,
  viewCount: true,
  lastViewedAt: true,
} as const;

export async function countActiveShareLinksForUser(
  userId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  return db.shareLink.count({
    where: {
      userId,
      ...activeShareLinkForActiveItemWhere,
    },
  });
}

export async function getActiveShareLinkForItem(
  userId: string,
  itemId: string,
): Promise<ShareLinkRecord | null> {
  const link = await prisma.shareLink.findFirst({
    where: {
      userId,
      itemId,
      ...activeShareLinkForActiveItemWhere,
    },
    orderBy: { createdAt: "desc" },
    select: shareLinkSelect,
  });

  return link ? mapShareLink(link) : null;
}

export async function listActiveShareLinksForUser(
  userId: string,
): Promise<ShareLinkListEntry[]> {
  const links = await prisma.shareLink.findMany({
    where: {
      userId,
      ...activeShareLinkForActiveItemWhere,
    },
    orderBy: { createdAt: "desc" },
    select: {
      ...shareLinkSelect,
      item: {
        select: {
          title: true,
          type: { select: { name: true } },
        },
      },
    },
  });

  return links.map((link) => ({
    ...mapShareLink(link),
    itemTitle: link.item.title,
    itemTypeName: link.item.type.name,
  }));
}

export class ShareLinkLimitExceededError extends Error {
  constructor() {
    super("Active share link limit exceeded");
    this.name = "ShareLinkLimitExceededError";
  }
}

export async function createShareLinkForItem(
  userId: string,
  itemId: string,
  options: {
    expiresInDays: number | null;
    regenerate: boolean;
    isPro: boolean;
  },
): Promise<ShareLinkRecord> {
  const item = await prisma.item.findFirst({
    where: activeItemWhere(userId, { id: itemId }),
    select: { id: true },
  });

  if (!item) {
    throw new Error("ITEM_NOT_FOUND");
  }

  const expiresAt = expiresAtFromDays(options.expiresInDays);

  return prisma.$transaction(async (tx) => {
    await takeUserAdvisoryLock(tx, userId);

    const existing = await tx.shareLink.findFirst({
      where: {
        userId,
        itemId,
        ...activeShareLinkWhere(),
      },
      orderBy: { createdAt: "desc" },
      select: shareLinkSelect,
    });

    if (existing && !options.regenerate) {
      return mapShareLink(existing);
    }

    const now = new Date();

    await tx.shareLink.updateMany({
      where: {
        userId,
        itemId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    if (!options.isPro) {
      const activeCount = await countActiveShareLinksForUser(userId, tx);

      if (activeCount >= FREE_ACTIVE_SHARE_LINK_LIMIT) {
        throw new ShareLinkLimitExceededError();
      }
    }

    const created = await tx.shareLink.create({
      data: {
        userId,
        itemId,
        token: generateShareLinkToken(),
        expiresAt,
      },
      select: shareLinkSelect,
    });

    return mapShareLink(created);
  });
}

export async function revokeShareLinkForItem(
  userId: string,
  itemId: string,
): Promise<boolean> {
  const result = await prisma.shareLink.updateMany({
    where: {
      userId,
      itemId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  return result.count > 0;
}

export async function getPublicSharedItemByToken(
  token: string,
): Promise<{ shareLinkId: string; item: PublicSharedItem } | null> {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      item: {
        select: {
          title: true,
          description: true,
          content: true,
          url: true,
          language: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          type: { select: { name: true } },
          tags: { select: { tag: { select: { name: true } } } },
        },
      },
    },
  });

  if (!link) {
    return null;
  }

  if (!isShareLinkActive(link)) {
    return null;
  }

  if (link.item.deletedAt !== null) {
    return null;
  }

  const typeName = link.item.type.name;

  if (!isShareableItemType(typeName)) {
    return null;
  }

  return {
    shareLinkId: link.id,
    item: {
      title: link.item.title,
      typeName,
      description: link.item.description,
      content: link.item.content,
      url: link.item.url,
      language: link.item.language,
      tags: link.item.tags.map((entry) => entry.tag.name),
      createdAt: link.item.createdAt,
      updatedAt: link.item.updatedAt,
    },
  };
}

export async function recordShareLinkView(shareLinkId: string): Promise<void> {
  await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: {
      viewCount: { increment: 1 },
      lastViewedAt: new Date(),
    },
  });
}

export async function updateShareLinkExpiryForItem(
  userId: string,
  itemId: string,
  expiresInDays: number | null,
): Promise<ShareLinkRecord | null> {
  const link = await prisma.shareLink.findFirst({
    where: {
      userId,
      itemId,
      ...activeShareLinkForActiveItemWhere,
    },
    select: { id: true },
  });

  if (!link) {
    return null;
  }

  const updated = await prisma.shareLink.update({
    where: { id: link.id },
    data: { expiresAt: expiresAtFromDays(expiresInDays) },
    select: shareLinkSelect,
  });

  return mapShareLink(updated);
}
