"use client";

import { ItemCopyButton } from "@/components/items/item-copy-button";
import { ItemFavoriteButton } from "@/components/items/item-favorite-button";
import { ItemPinButton } from "@/components/items/item-pin-button";
import { cn } from "@/lib/utils";

type ItemListActionsProps = {
  itemId: string;
  isFavorite: boolean;
  isPinned: boolean;
  className?: string;
};

const ACTION_BUTTON_CLASS = "pointer-coarse:size-8";

/** Sits above the card's stretched trigger (`z-10`); hover-revealed only on fine pointers. */
export function ItemListActions({
  itemId,
  isFavorite,
  isPinned,
  className,
}: ItemListActionsProps) {
  return (
    <div
      className={cn(
        "relative z-10 flex shrink-0 items-center gap-0.5 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/item:opacity-100 pointer-fine:group-focus-within/item:opacity-100",
        className,
      )}
    >
      <ItemPinButton
        itemId={itemId}
        isPinned={isPinned}
        className={ACTION_BUTTON_CLASS}
      />
      <ItemFavoriteButton
        key={`${itemId}-${isFavorite}`}
        itemId={itemId}
        isFavorite={isFavorite}
        className={ACTION_BUTTON_CLASS}
      />
      <ItemCopyButton itemId={itemId} className={ACTION_BUTTON_CLASS} />
    </div>
  );
}
