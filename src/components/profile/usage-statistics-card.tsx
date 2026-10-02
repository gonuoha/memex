import { Code2, Folder, HardDrive } from "lucide-react";

import { PageSection } from "@/components/layout/page-container";
import { getItemTypeIcon, getItemTypeLabel, getItemTypeStyles } from "@/lib/item-type-styles";
import type { ProfileItemTypeCount } from "@/lib/db/profile";
import {
  FREE_COLLECTION_LIMIT,
  FREE_ITEM_LIMIT,
  formatStorageUsage,
} from "@/lib/subscription-limits";

type UsageStatisticsCardProps = {
  itemCount: number;
  collectionCount: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  itemTypeCounts: ProfileItemTypeCount[];
  isPro: boolean;
};

function StatCard({
  icon: Icon,
  iconClassName,
  iconBgClassName,
  value,
  label,
}: {
  icon: typeof Code2;
  iconClassName: string;
  iconBgClassName: string;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconBgClassName}`}
      >
        <Icon className={`size-4 ${iconClassName}`} />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function UsageStatisticsCard({
  itemCount,
  collectionCount,
  storageUsedBytes,
  storageQuotaBytes,
  itemTypeCounts,
  isPro,
}: UsageStatisticsCardProps) {
  const itemLabel = isPro
    ? "Total Items"
    : `Total Items (${itemCount} / ${FREE_ITEM_LIMIT})`;
  const collectionLabel = isPro
    ? "Collections"
    : `Collections (${collectionCount} / ${FREE_COLLECTION_LIMIT})`;
  const storageLabel = isPro
    ? `Storage (${formatStorageUsage(storageUsedBytes)} / ${formatStorageUsage(storageQuotaBytes)})`
    : "Storage";

  return (
    <PageSection title="Usage Statistics" className="p-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StatCard
          icon={Code2}
          iconClassName="text-blue-500"
          iconBgClassName="bg-blue-500/15"
          value={itemCount}
          label={itemLabel}
        />
        <StatCard
          icon={Folder}
          iconClassName="text-purple-500"
          iconBgClassName="bg-purple-500/15"
          value={collectionCount}
          label={collectionLabel}
        />
        {isPro ? (
          <StatCard
            icon={HardDrive}
            iconClassName="text-emerald-500"
            iconBgClassName="bg-emerald-500/15"
            value={formatStorageUsage(storageUsedBytes)}
            label={storageLabel}
          />
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">Items by Type</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {itemTypeCounts.map((type) => {
            const Icon = getItemTypeIcon(type.icon);
            const styles = getItemTypeStyles(type.color);

            return (
              <div
                key={type.name}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2"
              >
                <Icon
                  className={`size-3.5 shrink-0 ${styles.textClassName ?? "text-muted-foreground"}`}
                  style={styles.textStyle}
                />
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {getItemTypeLabel(type.name, {
                    plural: true,
                    isSystem: type.isSystem,
                  })}
                </span>
                <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">
                  {type.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </PageSection>
  );
}
