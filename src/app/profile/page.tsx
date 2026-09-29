import {
  PageContainer,
  PageContent,
  PageHeader,
} from "@/components/layout/page-container";
import { AccountInformationCard } from "@/components/profile/account-information-card";
import { UsageStatisticsCard } from "@/components/profile/usage-statistics-card";
import { getProfileData } from "@/lib/db/profile";

export default async function ProfilePage() {
  const { user, stats, itemTypeCounts } = await getProfileData();

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        description="View your account information and usage"
      />

      <PageContent>
        <AccountInformationCard
          name={user.name}
          email={user.email}
          image={user.image}
          createdAt={user.createdAt.toISOString()}
          hasPassword={user.hasPassword}
        />
        <UsageStatisticsCard
          itemCount={stats.itemCount}
          collectionCount={stats.collectionCount}
          storageUsedBytes={stats.storageUsedBytes}
          storageQuotaBytes={stats.storageQuotaBytes}
          itemTypeCounts={itemTypeCounts}
          isPro={user.isPro}
        />
      </PageContent>
    </PageContainer>
  );
}
