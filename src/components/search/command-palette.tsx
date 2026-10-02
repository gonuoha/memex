"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Plus,
  Settings,
  Star,
  Trash2,
} from "lucide-react";

import { useItemDrawer } from "@/components/items/item-drawer-context";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type {
  SearchCollectionResult,
  SearchItemResult,
} from "@/lib/db/search";
import {
  getItemTypeIcon,
  getItemTypeLabel,
  getItemTypeStyles,
} from "@/lib/item-type-styles";
import { parseSearchQuery, getHighlightTerms } from "@/lib/search-query";
import { splitHighlightParts } from "@/lib/search-highlight";
import { cn } from "@/lib/utils";

import { useCommandPalette } from "./command-palette-context";

type SearchResponse = {
  items: SearchItemResult[];
  collections: SearchCollectionResult[];
};

const SEARCH_DEBOUNCE_MS = 150;

function HighlightedText({
  text,
  terms,
  className,
}: {
  text: string;
  terms: string[];
  className?: string;
}) {
  const parts = splitHighlightParts(text, terms);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark
            key={index}
            className="rounded-sm bg-primary/20 text-foreground"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function formatCollectionItemCount(itemCount: number) {
  return `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
}

function ItemTypeMarker({
  icon,
  color,
}: {
  icon: string | null;
  color: string | null;
}) {
  const Icon = getItemTypeIcon(icon);
  const styles = getItemTypeStyles(color);

  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      {createElement(Icon, {
        className: cn("size-4", styles.textClassName),
        style: styles.textStyle,
      })}
      <span
        aria-hidden
        className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-popover"
        style={{
          backgroundColor: color?.startsWith("#") ? color : "var(--muted-foreground)",
        }}
      />
    </span>
  );
}

function ItemSearchResultRow({
  item,
  highlightTerms,
  onSelect,
}: {
  item: SearchItemResult;
  highlightTerms: string[];
  onSelect: () => void;
}) {
  const visibleTags = item.tags.slice(0, 3);

  return (
    <CommandItem
      value={`item-${item.id}-${item.title}`}
      onSelect={onSelect}
    >
      <ItemTypeMarker icon={item.type.icon} color={item.type.color} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate">
          <HighlightedText text={item.title} terms={highlightTerms} />
        </span>
        {item.snippet ? (
          <span className="truncate text-xs text-muted-foreground">
            <HighlightedText text={item.snippet} terms={highlightTerms} />
          </span>
        ) : null}
        {visibleTags.length > 0 ? (
          <span className="flex flex-wrap gap-1 pt-0.5">
            {visibleTags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-md bg-muted px-1.5 py-0 text-[10px] text-muted-foreground"
              >
                {tag.name}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {getItemTypeLabel(item.type.name, {
          isSystem: item.type.isSystem,
        })}
      </span>
    </CommandItem>
  );
}

function CommandListWithScrollHint({
  children,
  className,
  onContentChange,
}: {
  children: React.ReactNode;
  className?: string;
  onContentChange?: unknown;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const updateScrollHint = useCallback(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const hasOverflow = list.scrollHeight > list.clientHeight + 1;
    const isScrolledToBottom =
      list.scrollTop + list.clientHeight >= list.scrollHeight - 1;

    setShowBottomFade(hasOverflow && !isScrolledToBottom);
  }, []);

  useEffect(() => {
    updateScrollHint();

    const list = listRef.current;

    if (!list) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateScrollHint);
    resizeObserver.observe(list);

    return () => {
      resizeObserver.disconnect();
    };
  }, [onContentChange, updateScrollHint]);

  return (
    <div className="relative">
      <CommandList
        ref={listRef}
        className={className}
        onScroll={updateScrollHint}
      >
        {children}
      </CommandList>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-1 bottom-0 h-8 rounded-b-xl bg-gradient-to-t from-popover to-transparent transition-opacity",
          showBottomFade ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const {
    open,
    closePalette,
    openPalette,
    openItemCreate,
    openCollectionCreate,
  } = useCommandPalette();
  const { openItem } = useItemDrawer();

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItemResult[]>([]);
  const [collections, setCollections] = useState<SearchCollectionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (!open) {
      setQuery("");
      setItems([]);
      setCollections([]);
      setIsLoading(false);
      setHasError(false);
    }
  }

  const highlightTerms = getHighlightTerms(parseSearchQuery(query));
  const hasQuery = query.trim().length > 0;

  function handleClose() {
    closePalette();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setIsLoading(true);

      const params = new URLSearchParams({
        q: query.trim(),
        limit: "20",
      });

      void fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Search failed");
          }

          return (await response.json()) as SearchResponse;
        })
        .then((data) => {
          if (controller.signal.aborted) {
            return;
          }

          setItems(data.items);
          setCollections(data.collections);
          setHasError(false);
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return;
          }

          setItems([]);
          setCollections([]);
          setHasError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [open, query]);

  function handleItemSelect(itemId: string) {
    handleClose();
    openItem(itemId);
  }

  function handleCollectionSelect(collectionId: string) {
    handleClose();
    router.push(`/collections/${collectionId}`);
  }

  function navigate(path: string) {
    handleClose();
    router.push(path);
  }

  function handleCreateItem() {
    handleClose();
    openItemCreate();
  }

  function handleCreateCollection() {
    handleClose();
    openCollectionCreate();
  }

  const showQuickLinks = !hasQuery;
  const showEmpty =
    !isLoading &&
    !showQuickLinks &&
    items.length === 0 &&
    collections.length === 0;

  return (
    <CommandDialog
      title="Search"
      description="Search items and collections"
      shouldFilter={false}
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          openPalette();
          return;
        }

        handleClose();
      }}
    >
      <CommandInput
        placeholder="Search items and collections..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandListWithScrollHint
        onContentChange={[
          query,
          items.length,
          collections.length,
          open,
          isLoading,
        ]}
      >
        {isLoading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Searching...
          </div>
        ) : null}

        {showEmpty ? (
          <CommandEmpty>
            {hasError ? "Search failed. Try again." : "No results found."}
          </CommandEmpty>
        ) : null}

        {showQuickLinks ? (
          <CommandGroup heading="Quick links">
            <CommandItem onSelect={() => navigate("/dashboard")}>
              <LayoutDashboard className="size-4 shrink-0" />
              Dashboard
            </CommandItem>
            <CommandItem onSelect={() => navigate("/favorites")}>
              <Star className="size-4 shrink-0" />
              Favorites
            </CommandItem>
            <CommandItem onSelect={() => navigate("/collections")}>
              <LayoutGrid className="size-4 shrink-0" />
              Collections
            </CommandItem>
            <CommandItem onSelect={() => navigate("/trash")}>
              <Trash2 className="size-4 shrink-0" />
              Trash
            </CommandItem>
            <CommandItem onSelect={() => navigate("/settings")}>
              <Settings className="size-4 shrink-0" />
              Settings
            </CommandItem>
            <CommandItem onSelect={handleCreateItem}>
              <Plus className="size-4 shrink-0" />
              New item
            </CommandItem>
            <CommandItem onSelect={handleCreateCollection}>
              <FolderOpen className="size-4 shrink-0" />
              New collection
            </CommandItem>
          </CommandGroup>
        ) : null}

        {showQuickLinks && items.length > 0 ? (
          <CommandGroup heading="Recent items">
            {items.map((item) => (
              <ItemSearchResultRow
                key={item.id}
                item={item}
                highlightTerms={[]}
                onSelect={() => handleItemSelect(item.id)}
              />
            ))}
          </CommandGroup>
        ) : null}

        {hasQuery && items.length > 0 ? (
          <CommandGroup heading="Items">
            {items.map((item) => (
              <ItemSearchResultRow
                key={item.id}
                item={item}
                highlightTerms={highlightTerms}
                onSelect={() => handleItemSelect(item.id)}
              />
            ))}
          </CommandGroup>
        ) : null}

        {hasQuery && collections.length > 0 ? (
          <CommandGroup heading="Collections">
            {collections.map((collection) => (
              <CommandItem
                key={collection.id}
                value={`collection-${collection.id}-${collection.name}`}
                onSelect={() => handleCollectionSelect(collection.id)}
              >
                <FolderOpen className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  <HighlightedText
                    text={collection.name}
                    terms={highlightTerms}
                  />
                </span>
                <span className="w-[4.75rem] shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {formatCollectionItemCount(collection.itemCount)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandListWithScrollHint>
      <div className="flex flex-col gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Filter with <span className="font-mono">type:snippet</span> or{" "}
          <span className="font-mono">tag:react</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              ↵
            </kbd>{" "}
            open
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              esc
            </kbd>{" "}
            close
          </span>
        </p>
      </div>
    </CommandDialog>
  );
}
