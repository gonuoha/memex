import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SidebarContent } from "@/components/dashboard/sidebar-content";
import { ensureAppSession } from "@/lib/auth/ensure-app-session";
import { getDashboardLayoutData } from "@/lib/db/dashboard";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAppSession();

  const {
    sidebarData,
    user,
    collections,
    editorPreferences,
    userPreferences,
    usage,
  } = await getDashboardLayoutData();

  return (
    <DashboardShell
      sidebar={<SidebarContent sidebarData={sidebarData} />}
      isPro={user.isPro}
      collections={collections}
      editorPreferences={editorPreferences}
      userPreferences={userPreferences}
      itemCount={usage.itemCount}
      collectionCount={usage.collectionCount}
    >
      {children}
    </DashboardShell>
  );
}
