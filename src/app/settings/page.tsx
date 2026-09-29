import { Suspense } from "react";

import {
  PageContainer,
  PageContent,
  PageHeader,
} from "@/components/layout/page-container";
import { AccountActionsCard } from "@/components/settings/account-actions-card";
import { BillingCard } from "@/components/settings/billing-card";
import { UserPreferencesCard } from "@/components/settings/user-preferences-card";
import { EditorPreferencesCard } from "@/components/settings/editor-preferences-card";
import { getSettingsData } from "@/lib/db/settings";

export default async function SettingsPage() {
  const { user, usage, userPreferences } = await getSettingsData();

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your account security and preferences"
      />

      <PageContent className="space-y-6">
        <UserPreferencesCard initialPreferences={userPreferences} />
        <EditorPreferencesCard />
        <Suspense fallback={null}>
          <BillingCard
            isPro={user.isPro}
            stripeCustomerId={user.stripeCustomerId}
            subscriptionStatus={user.subscriptionStatus}
            currentPeriodEnd={user.currentPeriodEnd}
            cancelAtPeriodEnd={user.cancelAtPeriodEnd}
            itemCount={usage.itemCount}
            collectionCount={usage.collectionCount}
          />
        </Suspense>
        <AccountActionsCard email={user.email} hasPassword={user.hasPassword} />
      </PageContent>
    </PageContainer>
  );
}
