import type { DashboardStats } from "@/lib/db/collections";

type DashboardStatsStripProps = Pick<
  DashboardStats,
  "itemCount" | "collectionCount" | "favoriteItemCount" | "favoriteCollectionCount"
>;

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function DashboardStatsStrip({
  itemCount,
  collectionCount,
  favoriteItemCount,
  favoriteCollectionCount,
}: DashboardStatsStripProps) {
  const favoriteCount = favoriteItemCount + favoriteCollectionCount;

  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground tabular-nums">
        {itemCount}
      </span>{" "}
      {pluralize(itemCount, "item", "items")} ·{" "}
      <span className="font-medium text-foreground tabular-nums">
        {collectionCount}
      </span>{" "}
      {pluralize(collectionCount, "collection", "collections")} ·{" "}
      <span className="font-medium text-foreground tabular-nums">
        {favoriteCount}
      </span>{" "}
      {pluralize(favoriteCount, "favorite", "favorites")}
    </p>
  );
}
