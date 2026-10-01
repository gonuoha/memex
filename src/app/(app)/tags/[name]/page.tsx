import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ItemsListView } from "@/components/items/items-list-view";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import { TagDetailMenu } from "@/components/tags/tag-detail-menu";
import { getItemsByTagPaginated } from "@/lib/db/items";
import { getUserTagByName, getUserTagsWithCounts } from "@/lib/db/tags";
import { getUserPreferences } from "@/lib/db/settings";
import { getCurrentUser } from "@/lib/db/user";
import { encodeTagNameForPath } from "@/lib/validations/tags";
import { parsePageParam } from "@/lib/pagination";

type TagDetailPageProps = {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ page?: string }>;
};

function getTagPageHref(tagName: string, page: number) {
  const base = `/tags/${encodeTagNameForPath(tagName)}`;
  return page <= 1 ? base : `${base}?page=${page}`;
}

export async function generateMetadata({
  params,
}: TagDetailPageProps): Promise<Metadata> {
  const { name } = await params;

  return {
    title: `#${name} · Tags`,
  };
}

export default async function TagDetailPage({
  params,
  searchParams,
}: TagDetailPageProps) {
  const { name: nameParam } = await params;
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);

  const user = await getCurrentUser();
  const [tag, userPreferences, allTags] = await Promise.all([
    getUserTagByName(user.id, nameParam),
    getUserPreferences(user.id),
    getUserTagsWithCounts(user.id),
  ]);

  if (!tag) {
    notFound();
  }

  const result = await getItemsByTagPaginated(user.id, tag.id, page);
  const tagRow = allTags.find((entry) => entry.id === tag.id) ?? {
    id: tag.id,
    name: tag.name,
    itemCount: result.totalCount,
  };

  return (
    <PageContainer wide className="gap-0">
      <div className="mb-6 flex items-start justify-between gap-3">
        <PageHeader
          className="mb-0 min-w-0 flex-1"
          title={tag.name}
          description={
            result.totalCount === 1
              ? "1 item across all types"
              : `${result.totalCount} items across all types`
          }
        />
        <TagDetailMenu tag={tagRow} allTags={allTags} />
      </div>

      {result.totalCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active items use this tag.{" "}
          <Link href="/tags" className="text-primary underline-offset-4 hover:underline">
            Back to tags
          </Link>
        </p>
      ) : (
        <>
          <ItemsListView
            items={result.items}
            view={userPreferences.itemsView}
            mixedTypes
          />
          <div className="mt-8">
            <PaginationControls
              page={result.page}
              totalPages={result.totalPages}
              getHref={(nextPage) => getTagPageHref(tag.name, nextPage)}
            />
          </div>
        </>
      )}
    </PageContainer>
  );
}
