"use client";

import { createElement } from "react";
import { Download, Pin } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { FileListItem } from "@/lib/db/items";
import { formatFileSize } from "@/lib/file-upload";
import { getFileIconByExtension } from "@/lib/file-icons";
import { formatShortDateWithYear } from "@/lib/format-date";
import { cn } from "@/lib/utils";

import { ITEM_CARD_TRIGGER_CLASS } from "./item-card-styles";
import { ItemFavoriteButton } from "./item-favorite-button";
import { useItemDrawer } from "./item-drawer-context";

type FileListRowProps = {
  item: FileListItem;
};

export function FileListRow({ item }: FileListRowProps) {
  const { openItem } = useItemDrawer();
  const displayName = item.fileName ?? item.title;
  const FileIcon = getFileIconByExtension(displayName);

  return (
    <div className="group relative flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {createElement(FileIcon, { className: "size-5" })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openItem(item.id)}
              title={displayName}
              className={ITEM_CARD_TRIGGER_CLASS}
            >
              {displayName}
            </button>
            {item.isPinned ? (
              <Pin
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-label="Pinned"
                role="img"
              />
            ) : null}
          </div>
          <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:hidden">
            {item.fileSize ? <span>{formatFileSize(item.fileSize)}</span> : null}
            <time dateTime={item.createdAt.toISOString()}>
              {formatShortDateWithYear(item.createdAt)}
            </time>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4 sm:shrink-0">
        <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          {item.fileSize ? (
            <span className="w-16 text-right">{formatFileSize(item.fileSize)}</span>
          ) : (
            <span className="w-16" />
          )}
          <time
            dateTime={item.createdAt.toISOString()}
            className="w-28 text-right"
          >
            {formatShortDateWithYear(item.createdAt)}
          </time>
        </div>
        <ItemFavoriteButton
          key={`${item.id}-${item.isFavorite}`}
          itemId={item.id}
          isFavorite={item.isFavorite}
        />
        <a
          href={`/api/items/${item.id}/download?download=1`}
          download={item.fileName ?? undefined}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-xs" }),
            "shrink-0 text-muted-foreground hover:text-foreground",
          )}
        >
          <Download />
          <span className="sr-only">Download</span>
        </a>
      </div>
    </div>
  );
}

type FileListProps = {
  items: FileListItem[];
};

export function FileList({ items }: FileListProps) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <FileListRow key={item.id} item={item} />
      ))}
    </div>
  );
}
