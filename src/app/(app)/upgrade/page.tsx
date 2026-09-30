import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
  PageContainer,
  PageContent,
  PageHeader,
} from "@/components/layout/page-container";
import { UpgradePlans } from "@/components/upgrade/upgrade-plans";
import { getCurrentUser } from "@/lib/db/user";

export default async function UpgradePage() {
  const user = await getCurrentUser();

  if (user.isPro) {
    redirect("/settings");
  }

  return (
    <PageContainer wide className="items-center">
      <PageHeader
        title="Upgrade to Pro"
        description="Unlock unlimited items, collections, file uploads, and more."
        className="mx-auto max-w-3xl text-center"
      />
      <PageContent className="w-full">
        <Suspense fallback={null}>
          <UpgradePlans />
        </Suspense>
      </PageContent>
    </PageContainer>
  );
}
