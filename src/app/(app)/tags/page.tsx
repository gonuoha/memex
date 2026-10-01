import { TagsList } from "@/components/tags/tags-list";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import { getUserTagsWithCounts } from "@/lib/db/tags";
import { getCurrentUser } from "@/lib/db/user";

export default async function TagsPage() {
  const user = await getCurrentUser();
  const tags = await getUserTagsWithCounts(user.id);

  return (
    <PageContainer wide>
      <PageHeader
        title="Tags"
        description={
          tags.length === 1 ? "1 tag" : `${tags.length} tags`
        }
      />

      <TagsList tags={tags} />
    </PageContainer>
  );
}
