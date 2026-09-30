import Link from "next/link";

import { CollectionsGrid } from "@/components/dashboard/collection-card";
import { ItemRow } from "@/components/dashboard/item-row";
import { StatsCards } from "@/components/dashboard/stats-cards";
import {
  PageContainer,
  PageContent,
  PageHeader,
  PageSection,
} from "@/components/layout/page-container";
import { getDashboardPageData } from "@/lib/db/dashboard";

export default async function DashboardPage() {
  const { collections, stats, pinnedItems, recentItems, showOverview } =
    await getDashboardPageData();

  return (
    <PageContainer wide>
      <PageHeader
        title="Dashboard"
        description="Your developer knowledge hub"
      />

      <PageContent>
        {showOverview ? (
          <PageSection
            title="Overview"
            className="rounded-none border-0 bg-background p-0"
          >
            <StatsCards {...stats} />
          </PageSection>
        ) : null}

        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Collections</h2>
            <Link
              href="/collections"
              className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </Link>
          </div>
          <div className="mt-4">
            <CollectionsGrid collections={collections} />
          </div>
        </section>

        {pinnedItems.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold">Pinned</h2>
            <div className="mt-4 space-y-3">
              {pinnedItems.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-semibold">Recent Items</h2>
          <div className="mt-4 space-y-3">
            {recentItems.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      </PageContent>
    </PageContainer>
  );
}
