import { notFound } from "next/navigation";

import { CollectionDetailActions } from "@/components/collections/collection-detail-actions";
import { CollectionItemSections } from "@/components/collections/collection-item-sections";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import { getCollectionById } from "@/lib/db/collections";
import {
  getFileItemsByIds,
  getItemsByCollectionPaginated,
} from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";
import { parsePageParam } from "@/lib/pagination";

type CollectionDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
};

function getCollectionPageHref(collectionId: string, page: number) {
  return page <= 1
    ? `/collections/${collectionId}`
    : `/collections/${collectionId}?page=${page}`;
}

export default async function CollectionDetailPage({
  params,
  searchParams,
}: CollectionDetailPageProps) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const user = await getCurrentUser();
  const collection = await getCollectionById(user.id, id);

  if (!collection) {
    notFound();
  }

  const result = await getItemsByCollectionPaginated(
    user.id,
    collection.id,
    page,
  );
  const fileItemIds = result.items
    .filter((item) => item.type.name.toLowerCase() === "file")
    .map((item) => item.id);
  const fileItems = await getFileItemsByIds(user.id, fileItemIds);

  return (
    <PageContainer wide>
      <div className="flex items-start justify-between gap-4">
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

      {result.items.length > 0 ? (
        <>
          <CollectionItemSections items={result.items} fileItems={fileItems} />
          <div className="mt-8">
            <PaginationControls
              page={result.page}
              totalPages={result.totalPages}
              getHref={(nextPage) => getCollectionPageHref(collection.id, nextPage)}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No items in this collection yet.
        </p>
      )}
    </PageContainer>
  );
}
