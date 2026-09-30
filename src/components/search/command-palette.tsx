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
import { getItemTypeIcon, getItemTypeLabel } from "@/lib/item-type-styles";
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
  const abortRef = useRef<AbortController | null>(null);

  const highlightTerms = getHighlightTerms(parseSearchQuery(query));
  const hasQuery = query.trim().length > 0;

  function handleClose() {
    abortRef.current?.abort();
    setQuery("");
    setItems([]);
    setCollections([]);
    setIsLoading(false);
    closePalette();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
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
          setItems(data.items);
          setCollections(data.collections);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setItems([]);
          setCollections([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
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
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Searching...
          </div>
        ) : null}

        {showEmpty ? <CommandEmpty>No results found.</CommandEmpty> : null}

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
            {items.map((item) => {
              const Icon = getItemTypeIcon(item.type.icon);

              return (
                <CommandItem
                  key={item.id}
                  value={`item-${item.id}`}
                  onSelect={() => handleItemSelect(item.id)}
                >
                  {createElement(Icon, { className: "size-4 shrink-0" })}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate">{item.title}</span>
                    {item.snippet ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {item.snippet}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {getItemTypeLabel(item.type.name)}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {hasQuery && items.length > 0 ? (
          <CommandGroup heading="Items">
            {items.map((item) => {
              const Icon = getItemTypeIcon(item.type.icon);

              return (
                <CommandItem
                  key={item.id}
                  value={`item-${item.id}-${item.title}`}
                  onSelect={() => handleItemSelect(item.id)}
                >
                  {createElement(Icon, { className: "size-4 shrink-0" })}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate">
                      <HighlightedText text={item.title} terms={highlightTerms} />
                    </span>
                    {item.snippet ? (
                      <span className="truncate text-xs text-muted-foreground">
                        <HighlightedText
                          text={item.snippet}
                          terms={highlightTerms}
                        />
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {getItemTypeLabel(item.type.name)}
                  </span>
                </CommandItem>
              );
            })}
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
      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Filter with <span className="font-mono">type:snippet</span> or{" "}
        <span className="font-mono">tag:react</span>
      </div>
    </CommandDialog>
  );
}
