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
import {
  buildItemsListQueryString,
  hasExplicitItemsListView,
  parseItemsListSearchParams,
  type ItemsListSearchParams,
} from "@/lib/items-list-params";
import { getItemTypeBehaviour } from "@/lib/item-types/kinds";
import { getCurrentUser } from "@/lib/db/user";
import { getUserPreferences } from "@/lib/db/settings";

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

  const user = await getCurrentUser();
  const itemType = await getItemTypeBySlug(user.id, typeSlug);

  if (!itemType) {
    notFound();
  }

  if (typeSlug !== itemType.slug) {
    const query = buildItemsListQueryString({
      ...parsed,
      view: hasExplicitItemsListView(rawSearchParams) ? parsed.view : undefined,
    });
    permanentRedirect(`/items/${itemType.slug}${query}`);
  }

  const [userPreferences, collections, usage] = await Promise.all([
    getUserPreferences(user.id),
    getSelectableCollections(user.id),
    getUserItemStats(user.id),
  ]);

  if (
    (itemType.kind === "file" || itemType.kind === "image") &&
    !user.isPro
  ) {
    redirect("/upgrade");
  }

  const { sort, tag, favoritesOnly, page } = parsed;
  const view = hasExplicitItemsListView(rawSearchParams)
    ? parsed.view
    : userPreferences.itemsView;
  const listQuery = { sort, tag, favoritesOnly };
  const basePath = `/items/${itemType.slug}`;
  const typeBehaviour = getItemTypeBehaviour(itemType.kind);
  const isFileType = typeBehaviour.isGalleryView && itemType.kind === "file";

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
  const canCreateHere = itemType.isSystem || user.isPro;
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
        title={
          itemType.isSystem
            ? getItemTypeLabel(itemType.name, { plural: true, isSystem: true })
            : itemType.name
        }
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
        canCreateHere ? (
          <ItemTypeEmptyState
            typeName={itemType.name}
            creatableType={itemType.slug}
            typeIcon={itemType.icon}
            isSystem={itemType.isSystem}
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
