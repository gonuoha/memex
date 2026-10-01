"use client";

import { createElement, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FolderOpen,
  FolderPlus,
  PanelLeft,
  Plus,
  Search,
} from "lucide-react";

import { CollectionCreateDialog } from "@/components/collections/collection-create-dialog";
import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { useCommandPalette } from "@/components/search/command-palette-context";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useSearchShortcutLabel } from "@/hooks/use-search-shortcut-label";
import type { SelectableCollection } from "@/lib/db/collections";
import {
  getItemTypeIcon,
  getItemTypeLabel,
  getItemTypeStyles,
  SYSTEM_ITEM_TYPE_ORDER,
} from "@/lib/item-type-styles";
import {
  isAtCollectionLimit,
  isAtItemLimit,
  isProOnlyItemType,
} from "@/lib/subscription-limits";
import {
  parseCreatableItemTypeFromPathname,
  type CreatableItemType,
} from "@/lib/validations/items";
import { cn } from "@/lib/utils";

import { useSidebar } from "./sidebar-context";

const MENU_ITEM_TYPES: {
  type: CreatableItemType;
  icon: string;
}[] = SYSTEM_ITEM_TYPE_ORDER.map((type) => {
  const iconMap: Record<CreatableItemType, string> = {
    snippet: "Code",
    prompt: "Sparkles",
    command: "Terminal",
    note: "StickyNote",
    file: "File",
    image: "Image",
    link: "Link",
  };

  return { type, icon: iconMap[type] };
});

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
  const [createType, setCreateType] = useState<CreatableItemType | undefined>();
  const [upgradeReason, setUpgradeReason] = useState<
    "item_limit" | "collection_limit" | "file_upload" | "general" | null
  >(null);
  const defaultType = parseCreatableItemTypeFromPathname(pathname);

  const handleNewItemClick = useCallback(() => {
    if (isAtItemLimit(itemCount, isPro)) {
      setUpgradeReason("item_limit");
      return;
    }

    setCreateType(undefined);
    setIsCreateOpen(true);
  }, [itemCount, isPro]);

  const handleNewItemTypeClick = useCallback(
    (type: CreatableItemType) => {
      if (isProOnlyItemType(type) && !isPro) {
        setUpgradeReason("file_upload");
        return;
      }

      if (isAtItemLimit(itemCount, isPro)) {
        setUpgradeReason("item_limit");
        return;
      }

      setCreateType(type);
      setIsCreateOpen(true);
    },
    [itemCount, isPro],
  );

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

  function renderNewMenuItems() {
    return (
      <>
        {MENU_ITEM_TYPES.map(({ type, icon }) => {
          const Icon = getItemTypeIcon(icon);
          const styles = getItemTypeStyles(null);
          const typeIndex = SYSTEM_ITEM_TYPE_ORDER.indexOf(type);

          return (
            <DropdownMenuItem
              key={type}
              onClick={() => handleNewItemTypeClick(type)}
            >
              {createElement(Icon, {
                className: cn("size-4 shrink-0", styles.textClassName),
                style: styles.textStyle,
              })}
              <span className="flex-1">
                {getItemTypeLabel(type, { plural: false })}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                g {typeIndex + 1}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleNewCollectionClick}>
          <FolderPlus className="size-4 shrink-0" />
          <span className="flex-1">New collection</span>
          <span className="text-xs text-muted-foreground">⇧ C</span>
        </DropdownMenuItem>
      </>
    );
  }

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
            className="flex min-w-0 items-center gap-2 font-semibold md:hidden"
          >
            <FolderOpen
              className="size-6 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="truncate">Memex</span>
          </Link>
        </div>

        <div className="relative hidden min-w-0 max-w-xs justify-self-center md:block md:w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            readOnly
            placeholder={`Search (${searchShortcutLabel})`}
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

        <div className="flex shrink-0 items-center gap-2 justify-self-end">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:hidden"
            onClick={openPalette}
            aria-label="Open search"
          >
            <Search />
          </Button>

          {!isPro ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-muted-foreground sm:inline-flex"
              nativeButton={false}
              render={<Link href="/upgrade" />}
            >
              Upgrade
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants(), "min-h-11 sm:hidden")}
              aria-label="Create"
            >
              <Plus />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleNewItemClick}>
                <Plus className="size-4 shrink-0" />
                <span className="flex-1">New item</span>
                <span className="text-xs text-muted-foreground">c</span>
              </DropdownMenuItem>
              {renderNewMenuItems()}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden items-center sm:flex">
            <Button
              className="min-h-9 rounded-r-none pr-3"
              onClick={handleNewItemClick}
            >
              <Plus className="mr-1 size-4" />
              New
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants(),
                  "min-h-9 rounded-l-none border-l border-primary-foreground/15 px-2",
                )}
                aria-label="More create options"
              >
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {renderNewMenuItems()}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
        onOpenChange={(open) => {
          setIsCreateOpen(open);

          if (!open) {
            setCreateType(undefined);
          }
        }}
        isPro={isPro}
        itemCount={itemCount}
        defaultType={createType ?? defaultType}
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
