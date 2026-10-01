import { parsePageParam } from "@/lib/pagination";
import type { ItemsView } from "@/lib/user-preferences";

export const ITEMS_LIST_SORTS = [
  "updated",
  "created",
  "title_asc",
  "title_desc",
] as const;

export type ItemsListSort = (typeof ITEMS_LIST_SORTS)[number];

export type ParsedItemsListParams = {
  sort: ItemsListSort;
  tag: string | null;
  favoritesOnly: boolean;
  view: ItemsView;
  page: number;
};

export function parseItemsListSort(value?: string): ItemsListSort {
  if (value && ITEMS_LIST_SORTS.includes(value as ItemsListSort)) {
    return value as ItemsListSort;
  }
  return "updated";
}

export function parseItemsListView(
  value?: string,
  fallback: ItemsView = "grid",
): ItemsView {
  return value === "list" || value === "grid" ? value : fallback;
}

export function parseFavoritesOnly(value?: string): boolean {
  return value === "1" || value === "true";
}

export const ITEMS_LIST_TAG_MAX_LENGTH = 40;

export function parseItemsListTag(value?: string): string | null {
  const tag = value?.trim();

  if (!tag || tag.length > ITEMS_LIST_TAG_MAX_LENGTH) {
    return null;
  }

  return tag;
}

export type ItemsListSearchParams = Record<
  string,
  string | string[] | undefined
>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseItemsListSearchParams(
  searchParams: ItemsListSearchParams,
  fallbackView: ItemsView = "grid",
): ParsedItemsListParams {
  return {
    sort: parseItemsListSort(firstValue(searchParams.sort)),
    tag: parseItemsListTag(firstValue(searchParams.tag)),
    favoritesOnly: parseFavoritesOnly(firstValue(searchParams.fav)),
    view: parseItemsListView(firstValue(searchParams.view), fallbackView),
    page: parsePageParam(firstValue(searchParams.page)),
  };
}

export function hasExplicitItemsListView(
  searchParams: ItemsListSearchParams,
): boolean {
  const view = firstValue(searchParams.view);
  return view === "grid" || view === "list";
}

export function buildItemsListQueryString(params: {
  sort?: ItemsListSort;
  tag?: string | null;
  favoritesOnly?: boolean;
  view?: ItemsView;
  page?: number;
}): string {
  const search = new URLSearchParams();

  if (params.sort && params.sort !== "updated") {
    search.set("sort", params.sort);
  }
  if (params.tag) {
    search.set("tag", params.tag);
  }
  if (params.favoritesOnly) {
    search.set("fav", "1");
  }
  if (params.view && params.view !== "grid") {
    search.set("view", params.view);
  }
  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}
