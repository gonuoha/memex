"use client";

import type { DashboardItem } from "@/lib/db/items";
import { getTypeColorBorderProps } from "@/lib/type-color-border";
import { cn } from "@/lib/utils";

import {
  ITEM_CARD_SURFACE_CLASS,
  ITEM_CARD_TRIGGER_CLASS,
} from "@/components/items/item-card-styles";
import { ItemCardMeta } from "@/components/items/item-card-meta";
import { ItemCardPreview } from "@/components/items/item-card-preview";
import { ItemListActions } from "@/components/items/item-list-actions";
import { useItemDrawer } from "@/components/items/item-drawer-context";
import { useTypeColorPosition } from "@/components/user-preferences/user-preferences-context";

type ItemRowProps = {
  item: DashboardItem;
  compact?: boolean;
};

export function ItemRow({ item, compact = false }: ItemRowProps) {
  const { openItem } = useItemDrawer();
  const typeColorPosition = useTypeColorPosition();
  const typeColorBorder = getTypeColorBorderProps(
    item.type.color,
    typeColorPosition,
  );
  const isImage = item.type.name.toLowerCase() === "image";

  return (
    <article
      className={cn(
        ITEM_CARD_SURFACE_CLASS,
        "flex gap-3",
        compact ? "py-3" : undefined,
        isImage ? "items-stretch" : "items-start",
        typeColorBorder.className,
      )}
      style={typeColorBorder.style}
    >
      {isImage ? (
        <div className="hidden h-16 w-28 shrink-0 overflow-hidden rounded-md border border-border sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated download route, not optimizable by next/image */}
          <img
            src={`/api/items/${item.id}/download`}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
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
        <ItemCardMeta item={item} className="mt-1.5" />
        {!isImage && !compact ? (
          <ItemCardPreview item={item} className="mt-2" />
        ) : null}
      </div>
    </article>
  );
}
