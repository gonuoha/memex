import { Suspense } from "react";

import { FavoritesList } from "@/components/favorites/favorites-list";
import { PageContainer, PageHeader } from "@/components/layout/page-container";
import { getAllFavoriteCollections } from "@/lib/db/collections";
import { getFavoriteItems } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  const [items, collections] = await Promise.all([
    getFavoriteItems(user.id),
    getAllFavoriteCollections(user.id),
  ]);
  const totalCount = items.length + collections.length;

  return (
    <PageContainer wide>
      <PageHeader
        title="Favorites"
        description={
          totalCount === 1
            ? "1 favorite"
            : `${totalCount} favorites`
        }
      />

      <Suspense>
        <FavoritesList items={items} collections={collections} />
      </Suspense>
    </PageContainer>
  );
}
