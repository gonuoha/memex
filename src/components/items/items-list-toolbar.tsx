"use client";

import { LayoutGrid, List, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateItemsViewPreference } from "@/actions/preferences";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ItemTypeTagOption } from "@/lib/db/items";
import {
  buildItemsListQueryString,
  ITEMS_LIST_SORTS,
  type ItemsListSort,
} from "@/lib/items-list-params";
import type { ItemsView } from "@/lib/user-preferences";
import { cn } from "@/lib/utils";

type ItemsListToolbarProps = {
  basePath: string;
  sort: ItemsListSort;
  tag: string | null;
  favoritesOnly: boolean;
  view: ItemsView;
  tagOptions: ItemTypeTagOption[];
  showTagFilter?: boolean;
};

const SORT_LABELS: Record<ItemsListSort, string> = {
  updated: "Recently updated",
  created: "Recently created",
  title_asc: "Title A–Z",
  title_desc: "Title Z–A",
};

const ALL_TAGS_VALUE = "__all__";

const VIEW_OPTIONS: { view: ItemsView; label: string; icon: typeof List }[] = [
  { view: "grid", label: "Grid view", icon: LayoutGrid },
  { view: "list", label: "List view", icon: List },
];

export function ItemsListToolbar({
  basePath,
  sort,
  tag,
  favoritesOnly,
  view,
  tagOptions,
  showTagFilter = true,
}: ItemsListToolbarProps) {
  const router = useRouter();
  const [isSavingView, startSavingView] = useTransition();

  function buildHref(patch: {
    sort?: ItemsListSort;
    tag?: string | null;
    favoritesOnly?: boolean;
    view?: ItemsView;
  }) {
    return `${basePath}${buildItemsListQueryString({
      sort: patch.sort ?? sort,
      tag: patch.tag !== undefined ? patch.tag : tag,
      favoritesOnly: patch.favoritesOnly ?? favoritesOnly,
      view: patch.view ?? view,
      page: 1,
    })}`;
  }

  function handleViewChange(nextView: ItemsView) {
    if (nextView === view) {
      return;
    }

    startSavingView(async () => {
      const result = await updateItemsViewPreference(nextView);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      router.push(buildHref({ view: nextView }));
    });
  }

  const hasFilters = Boolean(tag) || favoritesOnly;
  const selectedTagLabel = tag ?? "All tags";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <Select
          value={sort}
          onValueChange={(value) =>
            router.push(buildHref({ sort: value as ItemsListSort }))
          }
        >
          <SelectTrigger
            className="w-full data-[size=default]:h-9 sm:w-44"
            aria-label="Sort items"
          >
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ITEMS_LIST_SORTS.map((key) => (
              <SelectItem key={key} value={key}>
                {SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showTagFilter ? (
          <Select
            value={tag ?? ALL_TAGS_VALUE}
            onValueChange={(value) =>
              router.push(
                buildHref({ tag: value === ALL_TAGS_VALUE ? null : value }),
              )
            }
          >
            <SelectTrigger
              className="w-full data-[size=default]:h-9 sm:w-40"
              aria-label="Filter by tag"
            >
              <SelectValue>
                <span className="truncate">{selectedTagLabel}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS_VALUE}>All tags</SelectItem>
              {tagOptions.map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  {option.name}
                  <span className="text-muted-foreground tabular-nums">
                    {option.count}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="flex items-center gap-3 sm:flex-1">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 text-sm text-muted-foreground sm:ml-2">
          <Switch
            checked={favoritesOnly}
            onCheckedChange={(checked) =>
              router.push(buildHref({ favoritesOnly: checked }))
            }
          />
          <Star className="size-3.5" aria-hidden="true" />
          Favorites only
        </label>

        {hasFilters ? (
          <Link
            href={buildHref({ tag: null, favoritesOnly: false })}
            className="rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Clear
          </Link>
        ) : null}

        <div
          role="group"
          aria-label="Layout"
          className="ml-auto inline-flex h-9 items-center rounded-lg border border-border p-0.5"
        >
          {VIEW_OPTIONS.map(({ view: option, label, icon: Icon }) => (
            <button
              key={option}
              type="button"
              aria-label={label}
              aria-pressed={view === option}
              disabled={isSavingView}
              onClick={() => handleViewChange(option)}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
                view === option && "bg-muted text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
