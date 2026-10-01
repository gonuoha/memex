"use client";

import type { DashboardItem } from "@/lib/db/items";
import { getTypeColorBorderProps } from "@/lib/type-color-border";
import { cn } from "@/lib/utils";

import { ItemCardMeta } from "@/components/items/item-card-meta";
import {
  ITEM_CARD_SURFACE_CLASS,
  ITEM_CARD_TRIGGER_CLASS,
} from "@/components/items/item-card-styles";
import { ItemCardPreview } from "@/components/items/item-card-preview";
import { ItemListActions } from "@/components/items/item-list-actions";
import { useTypeColorPosition } from "@/components/user-preferences/user-preferences-context";

import { useItemDrawer } from "./item-drawer-context";

type ItemCardProps = {
  item: DashboardItem;
};

export function ItemCard({ item }: ItemCardProps) {
  const { openItem } = useItemDrawer();
  const typeColorPosition = useTypeColorPosition();
  const typeColorBorder = getTypeColorBorderProps(
    item.type.color,
    typeColorPosition,
  );

  return (
    <article
      className={cn(
        ITEM_CARD_SURFACE_CLASS,
        "flex h-full flex-col",
        typeColorBorder.className,
      )}
      style={typeColorBorder.style}
    >
      <div className="flex min-w-0 items-start gap-2">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openItem(item.id)}
            className={ITEM_CARD_TRIGGER_CLASS}
            title={item.title}
          >
            {item.title}
          </button>
        </h3>
        <ItemListActions
          itemId={item.id}
          isFavorite={item.isFavorite}
          isPinned={item.isPinned}
          className="-mt-0.5 -mr-1.5"
        />
      </div>
      <ItemCardMeta item={item} className="mt-2" />
      <ItemCardPreview item={item} />
    </article>
  );
}

type ItemsGridProps = {
  items: DashboardItem[];
};

export function ItemsGrid({ items }: ItemsGridProps) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
