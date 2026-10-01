import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { ItemTypeEmptyState } from "@/components/items/item-type-empty-state";
import { ItemsListToolbar } from "@/components/items/items-list-toolbar";
import { ItemsListView } from "@/components/items/items-list-view";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import { getSelectableCollections } from "@/lib/db/collections";
import {
  getFileItemsByTypePaginated,
  getItemTypeTags,
  getItemsByTypePaginated,
  getItemTypeBySlug,
  getUserItemStats,
  type DashboardItem,
  type FileListItem,
  type ItemTypeTagOption,
  type PaginatedResult,
} from "@/lib/db/items";
import { getItemTypeLabel } from "@/lib/item-type-styles";
import { getCanonicalItemTypeSlug, getTypeSlug } from "@/lib/item-type-slugs";
import {
  buildItemsListQueryString,
  hasExplicitItemsListView,
  parseItemsListSearchParams,
  type ItemsListSearchParams,
} from "@/lib/items-list-params";
import { getCurrentUser } from "@/lib/db/user";
import { getUserPreferences } from "@/lib/db/settings";
import { isProOnlyItemType } from "@/lib/subscription-limits";
import { creatableItemTypeSchema } from "@/lib/validations/items";

type ItemsByTypePageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<ItemsListSearchParams>;
};

type ListData =
  | {
      kind: "file";
      result: PaginatedResult<FileListItem>;
      tagOptions: ItemTypeTagOption[];
    }
  | {
      kind: "items";
      result: PaginatedResult<DashboardItem>;
      tagOptions: ItemTypeTagOption[];
    };

export default async function ItemsByTypePage({
  params,
  searchParams,
}: ItemsByTypePageProps) {
  const { type: typeSlug } = await params;
  const rawSearchParams = await searchParams;
  const parsed = parseItemsListSearchParams(rawSearchParams);

  const canonicalSlug = getCanonicalItemTypeSlug(typeSlug);
  if (!canonicalSlug) {
    notFound();
  }

  if (canonicalSlug !== typeSlug) {
    const query = buildItemsListQueryString({
      ...parsed,
      view: hasExplicitItemsListView(rawSearchParams) ? parsed.view : undefined,
    });
    permanentRedirect(`/items/${canonicalSlug}${query}`);
  }

  const user = await getCurrentUser();
  const [itemType, userPreferences, collections, usage] = await Promise.all([
    getItemTypeBySlug(user.id, typeSlug),
    getUserPreferences(user.id),
    getSelectableCollections(user.id),
    getUserItemStats(user.id),
  ]);

  if (!itemType) {
    notFound();
  }

  if (isProOnlyItemType(itemType.name) && !user.isPro) {
    redirect("/upgrade");
  }

  const { sort, tag, favoritesOnly, page } = parsed;
  const view = hasExplicitItemsListView(rawSearchParams)
    ? parsed.view
    : userPreferences.itemsView;
  const listQuery = { sort, tag, favoritesOnly };
  const basePath = `/items/${getTypeSlug(itemType.name)}`;
  const isFileType = itemType.name.toLowerCase() === "file";

  const data: ListData = isFileType
    ? {
        kind: "file",
        result: await getFileItemsByTypePaginated(
          user.id,
          itemType.id,
          page,
          listQuery,
        ),
        tagOptions: [],
      }
    : await Promise.all([
        getItemsByTypePaginated(user.id, itemType.id, page, listQuery),
        getItemTypeTags(user.id, itemType.id),
      ]).then(([result, tagOptions]) => ({
        kind: "items" as const,
        result,
        tagOptions,
      }));

  const { result } = data;
  const creatableType = creatableItemTypeSchema.safeParse(
    itemType.name.toLowerCase(),
  );
  const hasFilters = Boolean(tag || favoritesOnly);
  const getHref = (patch: { page?: number; clearFilters?: boolean }) =>
    `${basePath}${buildItemsListQueryString({
      sort,
      view,
      tag: patch.clearFilters ? null : tag,
      favoritesOnly: patch.clearFilters ? false : favoritesOnly,
      page: patch.page ?? 1,
    })}`;

  return (
    <PageContainer wide className="gap-0">
      <PageHeader
        className="mb-6"
        title={getItemTypeLabel(itemType.name, { plural: true })}
        description={
          result.totalCount === 1 ? "1 item" : `${result.totalCount} items`
        }
      />

      {result.totalCount > 0 || hasFilters ? (
        <div className="mb-4">
          <ItemsListToolbar
            basePath={basePath}
            sort={sort}
            tag={tag}
            favoritesOnly={favoritesOnly}
            view={view}
            tagOptions={data.tagOptions}
            showTagFilter={data.kind === "items"}
          />
        </div>
      ) : null}

      {result.totalCount === 0 && !hasFilters ? (
        creatableType.success ? (
          <ItemTypeEmptyState
            typeName={itemType.name}
            creatableType={creatableType.data}
            typeIcon={itemType.icon}
            isPro={user.isPro}
            itemCount={usage.itemCount}
            collections={collections}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        )
      ) : result.items.length === 0 ? (
        <div className="mt-4 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            No items match your filters.
          </p>
          <Link
            href={getHref({ clearFilters: true })}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          {data.kind === "file" ? (
            <ItemsListView
              items={[]}
              view={view}
              typeName={itemType.name}
              fileItems={data.result.items}
            />
          ) : (
            <ItemsListView
              items={data.result.items}
              view={view}
              typeName={itemType.name}
              tagFilterBasePath={basePath}
            />
          )}
          <div className="mt-8">
            <PaginationControls
              page={result.page}
              totalPages={result.totalPages}
              getHref={(nextPage) => getHref({ page: nextPage })}
            />
          </div>
        </>
      )}
    </PageContainer>
  );
}
