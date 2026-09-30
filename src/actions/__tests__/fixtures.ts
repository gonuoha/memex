import type { UserItemStats } from "@/lib/db/items";

export const TEST_USER_ID = "user-1";

export const defaultStats = {
  itemCount: 0,
  collectionCount: 0,
  favoriteItemCount: 0,
  favoriteCollectionCount: 0,
  pinnedCount: 0,
  trashCount: 0,
} satisfies UserItemStats;
