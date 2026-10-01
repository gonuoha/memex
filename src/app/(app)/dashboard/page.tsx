import Link from "next/link";

import { CollectionsGrid } from "@/components/dashboard/collection-card";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { DashboardQuickCapture } from "@/components/dashboard/dashboard-quick-capture";
import { DashboardStatsStrip } from "@/components/dashboard/dashboard-stats-strip";
import { ItemRow } from "@/components/dashboard/item-row";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import {
  PageContainer,
  SectionHeading,
} from "@/components/layout/page-container";
import { getDashboardLayoutData, getDashboardPageData } from "@/lib/db/dashboard";

export default async function DashboardPage() {
  const [
    {
      collections,
      stats,
      pinnedItems,
      recentItems,
      showOverview,
      firstName,
      itemCount,
      collectionCount,
      isPro,
      showOnboarding,
    },
    layoutData,
  ] = await Promise.all([getDashboardPageData(), getDashboardLayoutData()]);

  return (
    <PageContainer wide>
      <div className="space-y-5">
        <DashboardGreeting firstName={firstName}>
          {showOverview ? (
            <DashboardStatsStrip
              itemCount={stats.itemCount}
              collectionCount={stats.collectionCount}
              favoriteItemCount={stats.favoriteItemCount}
              favoriteCollectionCount={stats.favoriteCollectionCount}
            />
          ) : null}
        </DashboardGreeting>
        <DashboardQuickCapture
          isPro={isPro}
          itemCount={layoutData.usage.itemCount}
        />
      </div>

      {showOnboarding ? (
        <OnboardingCard
          itemCount={itemCount}
          collectionCount={collectionCount}
          isPro={isPro}
        />
      ) : null}

      {pinnedItems.length > 0 ? (
        <section>
          <SectionHeading>Pinned</SectionHeading>
          <div className="space-y-2">
            {pinnedItems.map((item) => (
              <ItemRow key={item.id} item={item} compact />
            ))}
          </div>
        </section>
      ) : null}

      {recentItems.length > 0 ? (
        <section>
          <SectionHeading>Recent</SectionHeading>
          <div className="space-y-2">
            {recentItems.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {collections.length > 0 ? (
        <section>
          <SectionHeading
            action={
              <Link
                href="/collections"
                className="rounded-sm px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                View all
              </Link>
            }
          >
            Collections
          </SectionHeading>
          <CollectionsGrid collections={collections} />
        </section>
      ) : null}
    </PageContainer>
  );
}
