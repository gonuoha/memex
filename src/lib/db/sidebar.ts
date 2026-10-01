import {
  getFavoriteCollections,
  getSidebarRecentCollections,
  type SidebarCollection,
} from "@/lib/db/collections";
import {
  getSidebarItemTypes,
  getUserItemStats,
  toSidebarItemCounts,
  type SidebarItemCounts,
  type SidebarItemType,
} from "@/lib/db/items";
import type { DashboardUser } from "@/lib/db/user";

export type SidebarUsage = {
  itemCount: number;
  collectionCount: number;
};

export type SidebarData = {
  user: DashboardUser;
  itemTypes: SidebarItemType[];
  favoriteCollections: SidebarCollection[];
  recentCollections: SidebarCollection[];
  itemCounts: SidebarItemCounts;
  usage: SidebarUsage;
};

export async function getSidebarData(user: DashboardUser): Promise<SidebarData> {
  const [itemTypes, favoriteCollections, recentCollections, stats] =
    await Promise.all([
      getSidebarItemTypes(user.id),
      getFavoriteCollections(user.id),
      getSidebarRecentCollections(user.id),
      getUserItemStats(user.id),
    ]);

  return {
    user,
    itemTypes,
    favoriteCollections,
    recentCollections,
    itemCounts: toSidebarItemCounts(stats),
    usage: {
      itemCount: stats.itemCount,
      collectionCount: stats.collectionCount,
    },
  };
}
