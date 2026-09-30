import { notFound, redirect } from "next/navigation";

import { FileList } from "@/components/items/file-list";
import { ImageGalleryGrid } from "@/components/items/image-thumbnail-card";
import { ItemsGrid } from "@/components/items/item-card";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import {
  getFileItemsByTypePaginated,
  getItemsByTypePaginated,
  getItemTypeBySlug,
} from "@/lib/db/items";
import { getItemTypeLabel } from "@/lib/item-type-styles";
import { getCurrentUser } from "@/lib/db/user";
import { parsePageParam } from "@/lib/pagination";
import { isProOnlyItemType } from "@/lib/subscription-limits";

type ItemsByTypePageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
};

function getItemsPageHref(typeSlug: string, page: number) {
  return page <= 1 ? `/items/${typeSlug}` : `/items/${typeSlug}?page=${page}`;
}

export default async function ItemsByTypePage({
  params,
  searchParams,
}: ItemsByTypePageProps) {
  const { type: typeSlug } = await params;
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const user = await getCurrentUser();
  const itemType = await getItemTypeBySlug(user.id, typeSlug);

  if (!itemType) {
    notFound();
  }

  const isImageType = itemType.name.toLowerCase() === "image";
  const isFileType = itemType.name.toLowerCase() === "file";

  if (isProOnlyItemType(itemType.name) && !user.isPro) {
    redirect("/upgrade");
  }

  if (isFileType) {
    const result = await getFileItemsByTypePaginated(user.id, itemType.id, page);

    return (
      <PageContainer wide>
        <PageHeader
          title={getItemTypeLabel(itemType.name, { plural: true })}
          description={
            result.totalCount === 1
              ? "1 item"
              : `${result.totalCount} items`
          }
        />

        {result.items.length > 0 ? (
          <>
            <FileList items={result.items} />
            <div className="mt-8">
              <PaginationControls
                page={result.page}
                totalPages={result.totalPages}
                getHref={(nextPage) => getItemsPageHref(typeSlug, nextPage)}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No {itemType.name} items yet.
          </p>
        )}
      </PageContainer>
    );
  }

  const result = await getItemsByTypePaginated(user.id, itemType.id, page);

  return (
    <PageContainer wide>
      <PageHeader
        title={getItemTypeLabel(itemType.name, { plural: true })}
        description={
          result.totalCount === 1 ? "1 item" : `${result.totalCount} items`
        }
      />

      {result.items.length > 0 ? (
        <>
          {isImageType ? (
            <ImageGalleryGrid items={result.items} />
          ) : (
            <ItemsGrid items={result.items} />
          )}
          <div className="mt-8">
            <PaginationControls
              page={result.page}
              totalPages={result.totalPages}
              getHref={(nextPage) => getItemsPageHref(typeSlug, nextPage)}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No {itemType.name} items yet.
        </p>
      )}
    </PageContainer>
  );
}
