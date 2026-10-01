import { cache } from "react";

import {
  DASHBOARD_COLLECTIONS_LIMIT,
  DASHBOARD_RECENT_ITEMS_LIMIT,
} from "@/lib/pagination";

import {
  getRecentCollections,
  getSelectableCollections,
  toDashboardStats,
  type DashboardCollection,
  type DashboardStats,
  type SelectableCollection,
} from "@/lib/db/collections";
import {
  getPinnedItems,
  getRecentItems,
  getUserItemStats,
  type DashboardItem,
} from "@/lib/db/items";
import { getSidebarData, type SidebarData } from "@/lib/db/sidebar";
import { getUserPreferences, getEditorPreferences } from "@/lib/db/settings";
import { getCurrentUser, type DashboardUser } from "@/lib/db/user";
import type { EditorPreferences } from "@/lib/editor-preferences";
import type { UserPreferences } from "@/lib/user-preferences";

export type DashboardPageData = {
  collections: DashboardCollection[];
  stats: DashboardStats;
  pinnedItems: DashboardItem[];
  recentItems: DashboardItem[];
  showOverview: boolean;
  firstName: string;
  itemCount: number;
  collectionCount: number;
  isPro: boolean;
  showOnboarding: boolean;
};

export type DashboardLayoutData = {
  user: DashboardUser;
  sidebarData: SidebarData;
  collections: SelectableCollection[];
  editorPreferences: EditorPreferences;
  userPreferences: UserPreferences;
  usage: {
    itemCount: number;
    collectionCount: number;
  };
};

export const getDashboardPageData = cache(
  async (): Promise<DashboardPageData> => {
    const user = await getCurrentUser();
    const [userPreferences, stats, collections, pinnedItems, recentItems] =
      await Promise.all([
        getUserPreferences(user.id),
        getUserItemStats(user.id),
        getRecentCollections(user.id, DASHBOARD_COLLECTIONS_LIMIT),
        getPinnedItems(user.id),
        getRecentItems(user.id, DASHBOARD_RECENT_ITEMS_LIMIT),
      ]);

    const firstName = user.name.trim().split(/\s+/)[0] || "there";

    return {
      collections,
      stats: toDashboardStats(stats),
      pinnedItems,
      recentItems,
      showOverview: userPreferences.showOverview,
      firstName,
      itemCount: stats.itemCount,
      collectionCount: stats.collectionCount,
      isPro: user.isPro,
      showOnboarding:
        stats.itemCount === 0 && !userPreferences.onboardingDismissed,
    };
  },
);

export const getDashboardLayoutData = cache(
  async (): Promise<DashboardLayoutData> => {
    const user = await getCurrentUser();
    const [sidebarData, collections, editorPreferences, userPreferences, stats] =
      await Promise.all([
        getSidebarData(user),
        getSelectableCollections(user.id),
        getEditorPreferences(user.id),
        getUserPreferences(user.id),
        getUserItemStats(user.id),
      ]);

    return {
      user,
      sidebarData,
      collections,
      editorPreferences,
      userPreferences,
      usage: {
        itemCount: stats.itemCount,
        collectionCount: stats.collectionCount,
      },
    };
  },
);
