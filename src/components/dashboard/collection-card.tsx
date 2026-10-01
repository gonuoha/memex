"use client";

import Link from "next/link";

import type { DashboardCollection } from "@/lib/db/collections";
import {
  getItemTypeIcon,
  getItemTypeLabel,
  getItemTypeStyles,
} from "@/lib/item-type-styles";
import { getTypeColorBorderProps } from "@/lib/type-color-border";
import { cn } from "@/lib/utils";

import { useTypeColorPosition } from "@/components/user-preferences/user-preferences-context";

import { CollectionCardMenu } from "./collection-card-menu";

type CollectionCardProps = {
  collection: DashboardCollection;
};

export function CollectionCard({ collection }: CollectionCardProps) {
  const typeColorPosition = useTypeColorPosition();
  const typeColorBorder = getTypeColorBorderProps(
    collection.dominantTypeColor,
    typeColorPosition,
  );

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card transition-colors hover:bg-muted/40",
        typeColorBorder.className,
      )}
      style={typeColorBorder.style}
    >
      <div className="absolute top-2 right-2 z-10">
        <CollectionCardMenu
          key={`${collection.id}-${collection.isFavorite}`}
          collection={collection}
        />
      </div>

      <Link href={`/collections/${collection.id}`} className="block min-w-0 p-4">
        <h3 className="truncate pr-8 font-medium" title={collection.name}>
          {collection.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {collection.itemCount === 1
            ? "1 item"
            : `${collection.itemCount} items`}
        </p>
        {collection.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {collection.description}
          </p>
        ) : null}
        {collection.types.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {collection.types.map((type) => {
              const Icon = getItemTypeIcon(type.icon);
              const styles = getItemTypeStyles(type.color);

              return (
                <span
                  key={type.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
                    styles.textClassName,
                    styles.bgClassName,
                  )}
                  style={{ ...styles.textStyle, ...styles.bgStyle }}
                >
                  <Icon className="size-3" aria-hidden="true" />
                  <span className="sr-only">{getItemTypeLabel(type.name)}</span>
                </span>
              );
            })}
          </div>
        ) : null}
      </Link>
    </div>
  );
}

type CollectionsGridProps = {
  collections: DashboardCollection[];
};

export function CollectionsGrid({ collections: collectionList }: CollectionsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {collectionList.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  );
}
