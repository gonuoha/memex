import { TrashList } from "@/components/trash/trash-list";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import { getTrashedItemsPaginated } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";
import { parsePageParam } from "@/lib/pagination";

type TrashPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function TrashPage({ searchParams }: TrashPageProps) {
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const user = await getCurrentUser();
  const result = await getTrashedItemsPaginated(user.id, page);

  return (
    <PageContainer wide>
      <PageHeader
        title="Trash"
        description={
          result.totalCount === 1
            ? "1 deleted item"
            : `${result.totalCount} deleted items`
        }
      />

      <TrashList
        items={result.items}
        page={result.page}
        totalPages={result.totalPages}
      />
    </PageContainer>
  );
}
