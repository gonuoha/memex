"use client";

import { Pin } from "lucide-react";

import type { DashboardItem } from "@/lib/db/items";
import { formatLongDate } from "@/lib/format-date";
import { adaptTypeColor } from "@/lib/item-type-color";
import { getItemTypeLabel } from "@/lib/item-type-styles";
import { formatRelativeDate } from "@/lib/relative-date";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_TAGS = 3;

type ItemCardMetaProps = {
  item: DashboardItem;
  className?: string;
};

export function ItemCardMeta({ item, className }: ItemCardMetaProps) {
  const dotStyle = item.type.color?.startsWith("#")
    ? { backgroundColor: adaptTypeColor(item.type.color) }
    : undefined;
  const visibleTags = item.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = item.tags.length - visibleTags.length;
  const absoluteDate = formatLongDate(item.updatedAt);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            !dotStyle && "bg-muted-foreground",
          )}
          style={dotStyle}
          aria-hidden="true"
        />
        <span className="truncate">{getItemTypeLabel(item.type.name)}</span>
      </span>
      {item.isPinned ? (
        <span className="inline-flex items-center gap-1">
          <Pin className="size-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">Pinned</span>
        </span>
      ) : null}
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="max-w-[8rem] truncate rounded-md bg-muted px-1.5 py-0.5"
        >
          {tag}
        </span>
      ))}
      {hiddenTagCount > 0 ? (
        <span className="shrink-0">+{hiddenTagCount}</span>
      ) : null}
      <time
        dateTime={item.updatedAt.toISOString()}
        title={absoluteDate}
        className="shrink-0"
      >
        {formatRelativeDate(item.updatedAt)}
      </time>
    </div>
  );
}
