"use client";

import Link from "next/link";

import { FREE_ITEM_LIMIT } from "@/lib/subscription-limits";
import { cn } from "@/lib/utils";

import { useSidebar } from "./sidebar-context";

export function SidebarUsageMeter({
  itemCount,
  isPro,
}: {
  itemCount: number;
  isPro: boolean;
}) {
  const { collapsed } = useSidebar();

  if (isPro || collapsed) {
    return null;
  }

  const progress = Math.min(100, (itemCount / FREE_ITEM_LIMIT) * 100);

  return (
    <div className="sidebar-text group-data-[collapsed]:hidden mb-2 space-y-1.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Items</span>
        <span className="tabular-nums text-muted-foreground">
          {itemCount} / {FREE_ITEM_LIMIT}
        </span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={itemCount}
        aria-valuemin={0}
        aria-valuemax={FREE_ITEM_LIMIT}
        aria-label="Free plan item usage"
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width]",
            progress >= 100 && "bg-destructive",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <Link
        href="/upgrade"
        className="text-xs font-medium text-primary hover:underline"
      >
        Upgrade
      </Link>
    </div>
  );
}
