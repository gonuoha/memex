import { describe, expect, it } from "vitest";

import {
  FREE_COLLECTION_LIMIT,
  FREE_ITEM_LIMIT,
  PRO_STORAGE_QUOTA_BYTES,
  collectionLimitErrorMessage,
  formatStorageUsage,
  isAtCollectionLimit,
  isAtItemLimit,
  isAtStorageLimit,
  isProOnlyItemType,
  itemLimitErrorMessage,
  storageQuotaErrorMessage,
} from "./subscription-limits";

describe("subscription-limits", () => {
  it("exports free tier constants", () => {
    expect(FREE_ITEM_LIMIT).toBe(50);
    expect(FREE_COLLECTION_LIMIT).toBe(3);
  });

  describe("isAtItemLimit", () => {
    it("returns false below the item limit for free users", () => {
      expect(isAtItemLimit(49, false)).toBe(false);
    });

    it("returns true at the item limit for free users", () => {
      expect(isAtItemLimit(50, false)).toBe(true);
    });

    it("returns true above the item limit for free users", () => {
      expect(isAtItemLimit(51, false)).toBe(true);
    });

    it("returns false for pro users regardless of count", () => {
      expect(isAtItemLimit(50, true)).toBe(false);
    });
  });

  describe("isAtCollectionLimit", () => {
    it("returns false below the collection limit for free users", () => {
      expect(isAtCollectionLimit(2, false)).toBe(false);
    });

    it("returns true at the collection limit for free users", () => {
      expect(isAtCollectionLimit(3, false)).toBe(true);
    });

    it("returns true above the collection limit for free users", () => {
      expect(isAtCollectionLimit(4, false)).toBe(true);
    });

    it("returns false for pro users regardless of count", () => {
      expect(isAtCollectionLimit(3, true)).toBe(false);
    });
  });

  describe("itemLimitErrorMessage", () => {
    it("returns the free tier item limit message", () => {
      expect(itemLimitErrorMessage()).toBe(
        "Free plan is limited to 50 items. Upgrade to Pro for unlimited items.",
      );
    });
  });

  describe("isProOnlyItemType", () => {
    it("identifies file and image types", () => {
      expect(isProOnlyItemType("file")).toBe(true);
      expect(isProOnlyItemType("IMAGE")).toBe(true);
      expect(isProOnlyItemType("snippet")).toBe(false);
    });
  });

  describe("isAtStorageLimit", () => {
    it("enforces the pro storage quota", () => {
      expect(isAtStorageLimit(PRO_STORAGE_QUOTA_BYTES - 1, 2, true)).toBe(
        true,
      );
      expect(isAtStorageLimit(0, PRO_STORAGE_QUOTA_BYTES, true)).toBe(false);
      expect(isAtStorageLimit(PRO_STORAGE_QUOTA_BYTES, 1, false)).toBe(false);
    });
  });

  describe("formatStorageUsage", () => {
    it("formats storage values", () => {
      expect(formatStorageUsage(2048)).toBe("2.0 KB");
      expect(storageQuotaErrorMessage()).toContain("1 GB");
    });
  });

  describe("collectionLimitErrorMessage", () => {
    it("returns the free tier collection limit message", () => {
      expect(collectionLimitErrorMessage()).toBe(
        "Free plan is limited to 3 collections. Upgrade to Pro for unlimited collections.",
      );
    });
  });
});
