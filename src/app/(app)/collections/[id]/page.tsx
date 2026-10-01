import Link from "next/link";
import { notFound } from "next/navigation";

import { CollectionDetailActions } from "@/components/collections/collection-detail-actions";
import { CollectionItemSections } from "@/components/collections/collection-item-sections";
import { ItemsListToolbar } from "@/components/items/items-list-toolbar";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import { getCollectionById } from "@/lib/db/collections";
import {
  getFileItemsByIds,
  getItemsByCollectionPaginated,
} from "@/lib/db/items";
import {
  buildItemsListQueryString,
  hasExplicitItemsListView,
  parseItemsListSearchParams,
  type ItemsListSearchParams,
} from "@/lib/items-list-params";
import { getCurrentUser } from "@/lib/db/user";
import { getUserPreferences } from "@/lib/db/settings";

type CollectionDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<ItemsListSearchParams>;
};

export default async function CollectionDetailPage({
  params,
  searchParams,
}: CollectionDetailPageProps) {
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const { sort, favoritesOnly, page, view: explicitView } =
    parseItemsListSearchParams(rawSearchParams);

  const user = await getCurrentUser();
  const [collection, userPreferences] = await Promise.all([
    getCollectionById(user.id, id),
    getUserPreferences(user.id),
  ]);

  if (!collection) {
    notFound();
  }

  const view = hasExplicitItemsListView(rawSearchParams)
    ? explicitView
    : userPreferences.itemsView;
  const listQuery = { sort, favoritesOnly };

  const result = await getItemsByCollectionPaginated(
    user.id,
    collection.id,
    page,
    listQuery,
  );
  const fileItemIds = result.items
    .filter((item) => item.type.name.toLowerCase() === "file")
    .map((item) => item.id);
  const fileItems = await getFileItemsByIds(user.id, fileItemIds);

  const getHref = (patch: { page?: number; clearFilters?: boolean }) =>
    `/collections/${collection.id}${buildItemsListQueryString({
      sort,
      view,
      favoritesOnly: patch.clearFilters ? false : favoritesOnly,
      page: patch.page ?? 1,
    })}`;

  return (
    <PageContainer wide className="gap-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title={collection.name}
          description={
            collection.description ??
            (collection.itemCount === 1
              ? "1 item"
              : `${collection.itemCount} items`)
          }
        />
        <CollectionDetailActions collection={collection} />
      </div>

      {collection.itemCount > 0 ? (
        <div className="mb-4">
          <ItemsListToolbar
            basePath={`/collections/${collection.id}`}
            sort={sort}
            tag={null}
            favoritesOnly={favoritesOnly}
            view={view}
            tagOptions={[]}
            showTagFilter={false}
          />
        </div>
      ) : null}

      {collection.itemCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No items in this collection yet.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add items from the item drawer or create something new.
          </p>
        </div>
      ) : result.items.length === 0 ? (
        <div className="mt-4 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">No items match your filters.</p>
          <Link
            href={getHref({ clearFilters: true })}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <CollectionItemSections
            items={result.items}
            fileItems={fileItems}
            view={view}
          />
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
