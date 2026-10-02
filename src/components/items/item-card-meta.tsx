"use client";

import { Pin } from "lucide-react";
import Link from "next/link";

import type { DashboardItem } from "@/lib/db/items";
import { formatLongDate } from "@/lib/format-date";
import { adaptTypeColor } from "@/lib/item-type-color";
import { getItemTypeLabel } from "@/lib/item-type-styles";
import { buildItemsListQueryString } from "@/lib/items-list-params";
import { formatRelativeDate } from "@/lib/relative-date";
import { encodeTagNameForPath } from "@/lib/validations/tags";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_TAGS = 3;

type ItemCardMetaProps = {
  item: DashboardItem;
  className?: string;
  tagFilterBasePath?: string;
};

function getTagHref(tagName: string, tagFilterBasePath?: string): string {
  if (tagFilterBasePath) {
    return `${tagFilterBasePath}${buildItemsListQueryString({
      tag: tagName,
      page: 1,
    })}`;
  }

  return `/tags/${encodeTagNameForPath(tagName)}`;
}

export function ItemCardMeta({
  item,
  className,
  tagFilterBasePath,
}: ItemCardMetaProps) {
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
        <span className="truncate">
          {getItemTypeLabel(item.type.name, {
            isSystem: item.type.isSystem ?? true,
          })}
        </span>
      </span>
      {item.isPinned ? (
        <span className="inline-flex items-center gap-1">
          <Pin className="size-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">Pinned</span>
        </span>
      ) : null}
      {visibleTags.map((tag) => (
        <Link
          key={tag}
          href={getTagHref(tag, tagFilterBasePath)}
          onClick={(event) => event.stopPropagation()}
          className="relative z-10 inline-flex min-h-6 max-w-[8rem] items-center truncate rounded-md bg-muted px-1.5 py-0.5 transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {tag}
        </Link>
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
