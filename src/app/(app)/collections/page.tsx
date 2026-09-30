import { CollectionsGrid } from "@/components/dashboard/collection-card";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import { getAllCollectionsPaginated } from "@/lib/db/collections";
import { getCurrentUser } from "@/lib/db/user";
import { parsePageParam } from "@/lib/pagination";

type CollectionsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

function getCollectionsPageHref(page: number) {
  return page <= 1 ? "/collections" : `/collections?page=${page}`;
}

export default async function CollectionsPage({
  searchParams,
}: CollectionsPageProps) {
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const user = await getCurrentUser();
  const result = await getAllCollectionsPaginated(user.id, page);

  return (
    <PageContainer wide>
      <PageHeader
        title="Collections"
        description={
          result.totalCount === 1
            ? "1 collection"
            : `${result.totalCount} collections`
        }
      />

      {result.items.length > 0 ? (
        <>
          <CollectionsGrid collections={result.items} />
          <div className="mt-8">
            <PaginationControls
              page={result.page}
              totalPages={result.totalPages}
              getHref={getCollectionsPageHref}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No collections yet.</p>
      )}
    </PageContainer>
  );
}
