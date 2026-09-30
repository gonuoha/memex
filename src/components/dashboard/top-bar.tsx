"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, PanelLeft, Plus, Search, Star } from "lucide-react";

import { CollectionCreateDialog } from "@/components/collections/collection-create-dialog";
import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { useCommandPalette } from "@/components/search/command-palette-context";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useSearchShortcutLabel } from "@/hooks/use-search-shortcut-label";
import type { SelectableCollection } from "@/lib/db/collections";
import {
  isAtCollectionLimit,
  isAtItemLimit,
} from "@/lib/subscription-limits";
import { parseCreatableItemTypeFromPathname } from "@/lib/validations/items";
import { cn } from "@/lib/utils";

import { useSidebar } from "./sidebar-context";

export function TopBar({
  isPro,
  collections,
  itemCount,
  collectionCount,
}: {
  isPro: boolean;
  collections: SelectableCollection[];
  itemCount: number;
  collectionCount: number;
}) {
  const { toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const { openPalette, registerCreateHandlers } = useCommandPalette();
  const searchShortcutLabel = useSearchShortcutLabel();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCollectionCreateOpen, setIsCollectionCreateOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<
    "item_limit" | "collection_limit" | null
  >(null);
  const defaultType = parseCreatableItemTypeFromPathname(pathname);

  const handleNewItemClick = useCallback(() => {
    if (isAtItemLimit(itemCount, isPro)) {
      setUpgradeReason("item_limit");
      return;
    }

    setIsCreateOpen(true);
  }, [itemCount, isPro]);

  const handleNewCollectionClick = useCallback(() => {
    if (isAtCollectionLimit(collectionCount, isPro)) {
      setUpgradeReason("collection_limit");
      return;
    }

    setIsCollectionCreateOpen(true);
  }, [collectionCount, isPro]);

  useEffect(() => {
    registerCreateHandlers({
      openItemCreate: handleNewItemClick,
      openCollectionCreate: handleNewCollectionClick,
    });

    return () => {
      registerCreateHandlers(null);
    };
  }, [registerCreateHandlers, handleNewItemClick, handleNewCollectionClick]);

  return (
    <>
      <header className="grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)_minmax(0,1fr)] md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 justify-self-start">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="size-11 shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
        >
          <PanelLeft />
        </Button>
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 font-semibold"
        >
          <FolderOpen className="size-6 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">Memex</span>
        </Link>
      </div>

      <div className="relative hidden min-w-0 max-w-xs justify-self-center md:block md:w-full">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          readOnly
          placeholder={`Search items, collections... (${searchShortcutLabel})`}
          className="h-9 w-full cursor-pointer pr-14 pl-9"
          onClick={openPalette}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPalette();
            }
          }}
          aria-label="Open search"
        />
        <kbd
          className={cn(
            "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2",
            "rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
          )}
        >
          {searchShortcutLabel}
        </kbd>
      </div>

      <div className="flex shrink-0 items-center gap-3 justify-self-end">
        {!isPro ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            nativeButton={false}
            render={<Link href="/upgrade" />}
          >
            Upgrade
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 md:size-8"
          nativeButton={false}
          render={<Link href="/favorites" aria-label="Favorites" />}
        >
          <Star
            className={cn(
              pathname === "/favorites" && "fill-favorite text-favorite",
            )}
          />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants(), "min-h-11 sm:hidden")}
            aria-label="Create"
          >
            <Plus />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleNewItemClick}>
              New Item
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleNewCollectionClick}>
              New Collection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          className="hidden min-h-11 sm:inline-flex"
          onClick={handleNewCollectionClick}
        >
          New Collection
        </Button>
        <Button
          className="hidden min-h-11 sm:inline-flex"
          onClick={handleNewItemClick}
        >
          New Item
        </Button>
      </div>
    </header>

      <CollectionCreateDialog
        open={isCollectionCreateOpen}
        onOpenChange={setIsCollectionCreateOpen}
        collectionCount={collectionCount}
        isPro={isPro}
      />

      <ItemCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        isPro={isPro}
        itemCount={itemCount}
        defaultType={defaultType}
        collections={collections}
      />

      <UpgradePrompt
        open={upgradeReason !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUpgradeReason(null);
          }
        }}
        reason={upgradeReason ?? "general"}
      />
    </>
  );
}
