import { Suspense } from "react";

import {
  PageContainer,
  PageContent,
  PageHeader,
} from "@/components/layout/page-container";
import { AccountActionsCard } from "@/components/settings/account-actions-card";
import { BillingCard } from "@/components/settings/billing-card";
import { UserPreferencesCard } from "@/components/settings/user-preferences-card";
import { ApiKeysCard } from "@/components/settings/api-keys-card";
import { ItemTypesCard } from "@/components/settings/item-types-card";
import { EditorPreferencesCard } from "@/components/settings/editor-preferences-card";
import { DataCard } from "@/components/settings/data-card";
import { SharedLinksCard } from "@/components/settings/shared-links-card";
import { listApiKeysForUser } from "@/lib/db/api-keys";
import { listItemTypesForUser } from "@/lib/db/item-types";
import { listActiveShareLinksForUser } from "@/lib/db/share-links";
import { getSettingsData } from "@/lib/db/settings";

export default async function SettingsPage() {
  const { user, usage, userPreferences } = await getSettingsData();
  const [apiKeys, itemTypes, shareLinks] = await Promise.all([
    listApiKeysForUser(user.id),
    listItemTypesForUser(user.id),
    listActiveShareLinksForUser(user.id),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your account security and preferences"
      />

      <PageContent className="space-y-6">
        <UserPreferencesCard initialPreferences={userPreferences} />
        <EditorPreferencesCard />
        <DataCard />
        <ItemTypesCard isPro={user.isPro} initialTypes={itemTypes} />
        <SharedLinksCard links={shareLinks} />
        <ApiKeysCard isPro={user.isPro} initialKeys={apiKeys} />
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
