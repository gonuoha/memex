"use client";

import { createElement, useState } from "react";
import type { DashboardItem } from "@/lib/db/items";
import { formatFileSize } from "@/lib/file-upload";
import { getItemPreviewLineClamp } from "@/lib/item-preview";
import { getItemTypeIcon } from "@/lib/item-type-styles";
import { cn } from "@/lib/utils";
import { useShowLinkFavicons } from "@/components/user-preferences/user-preferences-context";

type ItemCardPreviewProps = {
  item: DashboardItem;
  className?: string;
};

function LinkPreview({ item }: { item: DashboardItem }) {
  const showLinkFavicons = useShowLinkFavicons();
  const [faviconFailed, setFaviconFailed] = useState(false);

  let hostname = "";
  try {
    hostname = item.url ? new URL(item.url).hostname : "";
  } catch {
    hostname = "";
  }

  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground">
        {showLinkFavicons && hostname && !faviconFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- external favicon service; next/image would proxy every hostname through our server
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-4 rounded-sm"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          createElement(getItemTypeIcon(item.type.icon), { className: "size-3.5" })
        )}
      </span>
      <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
        {item.preview}
      </p>
    </div>
  );
}

export function ItemCardPreview({ item, className }: ItemCardPreviewProps) {
  const typeName = item.type.name.toLowerCase();

  if (typeName === "image") {
    return (
      <div
        className={cn(
          "mt-3 aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/30",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated download route, not optimizable by next/image */}
        <img
          src={`/api/items/${item.id}/download`}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
    );
  }

  if (!item.preview && typeName !== "file") {
    return null;
  }

  if (typeName === "link") {
    return (
      <div className={cn("mt-3 min-w-0", className)}>
        <LinkPreview item={item} />
      </div>
    );
  }

  if (typeName === "file") {
    return (
      <div
        className={cn(
          "mt-3 flex min-w-0 items-center gap-2 text-xs text-muted-foreground",
          className,
        )}
      >
        {createElement(getItemTypeIcon(item.type.icon), { className: "size-3.5 shrink-0" })}
        <span className="min-w-0 truncate">{item.fileName ?? item.title}</span>
        {item.fileSize ? (
          <span className="shrink-0">· {formatFileSize(item.fileSize)}</span>
        ) : null}
      </div>
    );
  }

  const lineClamp = getItemPreviewLineClamp(typeName);
  const isMonospace = typeName === "snippet" || typeName === "command";

  return (
    <pre
      className={cn(
        "mt-3 min-w-0 whitespace-pre-wrap break-words text-xs text-muted-foreground",
        isMonospace && "font-mono",
        lineClamp === 4 ? "line-clamp-4" : "line-clamp-2",
        className,
      )}
    >
      {item.preview}
    </pre>
  );
}
