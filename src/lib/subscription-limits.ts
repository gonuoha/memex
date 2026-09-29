export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;
export const PRO_STORAGE_QUOTA_BYTES = 1 * 1024 * 1024 * 1024;

const PRO_ONLY_ITEM_TYPES = new Set(["file", "image"]);

export function isProOnlyItemType(typeName: string): boolean {
  return PRO_ONLY_ITEM_TYPES.has(typeName.toLowerCase());
}

export function isAtItemLimit(count: number, isPro: boolean): boolean {
  return !isPro && count >= FREE_ITEM_LIMIT;
}

export function isAtCollectionLimit(count: number, isPro: boolean): boolean {
  return !isPro && count >= FREE_COLLECTION_LIMIT;
}

export function isAtStorageLimit(
  usedBytes: number,
  incomingBytes: number,
  isPro: boolean,
): boolean {
  if (!isPro) {
    return false;
  }

  return usedBytes + incomingBytes > PRO_STORAGE_QUOTA_BYTES;
}

export function storageQuotaErrorMessage(): string {
  const quotaGb = PRO_STORAGE_QUOTA_BYTES / (1024 * 1024 * 1024);

  return `Storage quota exceeded. Pro accounts are limited to ${quotaGb} GB of uploads.`;
}

export function formatStorageUsage(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function itemLimitErrorMessage(): string {
  return `Free plan is limited to ${FREE_ITEM_LIMIT} items. Upgrade to Pro for unlimited items.`;
}

export function collectionLimitErrorMessage(): string {
  return `Free plan is limited to ${FREE_COLLECTION_LIMIT} collections. Upgrade to Pro for unlimited collections.`;
}
