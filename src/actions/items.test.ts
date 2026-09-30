import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemDetail } from "@/lib/db/items";

import { defaultStats } from "./__tests__/fixtures";
import { mockAuth, mockUnauthenticated } from "./__tests__/mock-auth";

vi.mock("@/lib/db/collections", () => ({
  validateUserCollectionIds: vi.fn(),
}));

vi.mock("@/lib/db/items", () => ({
  createItem: vi.fn(),
  getItemTypeBySlug: vi.fn(),
  getUserItemStats: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  restoreItem: vi.fn(),
  permanentlyDeleteItem: vi.fn(),
  toggleItemFavorite: vi.fn(),
  toggleItemPin: vi.fn(),
}));

vi.mock("@/lib/db/trash", () => ({
  emptyTrash: vi.fn(),
}));

vi.mock("@/lib/db/user", () => ({
  getUserIsPro: vi.fn(),
  getUserStorageUsageBytes: vi.fn(),
}));

vi.mock("@/lib/db/free-tier-limits", () => ({
  FreeTierLimitExceededError: class FreeTierLimitExceededError extends Error {
    readonly kind: "item" | "collection";

    constructor(kind: "item" | "collection") {
      super(`Free tier ${kind} limit exceeded`);
      this.name = "FreeTierLimitExceededError";
      this.kind = kind;
    }
  },
  runWithFreeTierItemGuard: vi.fn(),
  runWithFreeTierItemRestoreGuard: vi.fn(),
}));

vi.mock("@/lib/db/pending-uploads", () => ({
  PendingUploadNotFoundError: class PendingUploadNotFoundError extends Error {
    constructor() {
      super("Pending upload not found");
      this.name = "PendingUploadNotFoundError";
    }
  },
  consumePendingUpload: vi.fn(),
  findPendingUpload: vi.fn(),
  releasePendingUpload: vi.fn(),
}));

vi.mock("@/lib/r2/storage", () => ({
  deleteObject: vi.fn(),
  getObjectByteRange: vi.fn(),
  getObjectMetadata: vi.fn(),
}));

import { validateUserCollectionIds } from "@/lib/db/collections";
import {
  createItem as createItemInDb,
  deleteItem as deleteItemInDb,
  getItemTypeBySlug,
  getUserItemStats,
  permanentlyDeleteItem as permanentlyDeleteItemInDb,
  restoreItem as restoreItemInDb,
  toggleItemFavorite as toggleItemFavoriteInDb,
  toggleItemPin as toggleItemPinInDb,
} from "@/lib/db/items";
import { emptyTrash as emptyTrashInDb } from "@/lib/db/trash";
import {
  FreeTierLimitExceededError,
  runWithFreeTierItemGuard,
  runWithFreeTierItemRestoreGuard,
} from "@/lib/db/free-tier-limits";
import {
  consumePendingUpload,
  findPendingUpload,
  PendingUploadNotFoundError,
  releasePendingUpload,
} from "@/lib/db/pending-uploads";
import { getUserIsPro, getUserStorageUsageBytes } from "@/lib/db/user";
import {
  deleteObject,
  getObjectByteRange,
  getObjectMetadata,
} from "@/lib/r2/storage";
import { itemLimitErrorMessage } from "@/lib/subscription-limits";

import {
  createItem,
  deleteItem,
  emptyTrash,
  permanentlyDeleteItem,
  restoreItem,
  toggleItemFavorite,
  toggleItemPin,
} from "./items";

const mockValidateUserCollectionIds = vi.mocked(validateUserCollectionIds);
const mockGetItemTypeBySlug = vi.mocked(getItemTypeBySlug);
const mockGetUserItemStats = vi.mocked(getUserItemStats);
const mockCreateItemInDb = vi.mocked(createItemInDb);
const mockDeleteItemInDb = vi.mocked(deleteItemInDb);
const mockRestoreItemInDb = vi.mocked(restoreItemInDb);
const mockPermanentlyDeleteItemInDb = vi.mocked(permanentlyDeleteItemInDb);
const mockEmptyTrashInDb = vi.mocked(emptyTrashInDb);
const mockRunWithFreeTierItemRestoreGuard = vi.mocked(
  runWithFreeTierItemRestoreGuard,
);
const mockToggleItemFavoriteInDb = vi.mocked(toggleItemFavoriteInDb);
const mockToggleItemPinInDb = vi.mocked(toggleItemPinInDb);
const mockGetUserIsPro = vi.mocked(getUserIsPro);
const mockRunWithFreeTierItemGuard = vi.mocked(runWithFreeTierItemGuard);
const mockDeleteObject = vi.mocked(deleteObject);
const mockGetObjectByteRange = vi.mocked(getObjectByteRange);
const mockGetObjectMetadata = vi.mocked(getObjectMetadata);
const mockConsumePendingUpload = vi.mocked(consumePendingUpload);
const mockFindPendingUpload = vi.mocked(findPendingUpload);
const mockReleasePendingUpload = vi.mocked(releasePendingUpload);

function mockPendingUpload(key: string, size: number, category: "image" | "file") {
  mockFindPendingUpload.mockResolvedValue({ key, size, category });
}

const pngHeader = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
]);
const mockGetUserStorageUsageBytes = vi.mocked(getUserStorageUsageBytes);

const createdItem: ItemDetail = {
  id: "item-1",
  title: "Test",
  description: null,
  contentType: "text",
  content: null,
  url: null,
  language: null,
  fileUrl: null,
  fileName: null,
  fileSize: null,
  isFavorite: false,
  isPinned: false,
  type: {
    id: "type-snippet",
    name: "snippet",
    icon: "Code",
    color: "#3b82f6",
  },
  tags: [],
  collections: [],
  createdAt: new Date("2026-08-05T00:00:00.000Z"),
  updatedAt: new Date("2026-08-05T00:00:00.000Z"),
};

describe("createItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateUserCollectionIds.mockResolvedValue(true);
    mockGetUserIsPro.mockResolvedValue(false);
    mockGetUserItemStats.mockResolvedValue(defaultStats);
    mockRunWithFreeTierItemGuard.mockImplementation(async (_userId, _isPro, create) =>
      create({} as never),
    );
    mockFindPendingUpload.mockResolvedValue(null);
    mockReleasePendingUpload.mockResolvedValue(true);
    mockConsumePendingUpload.mockResolvedValue(undefined);
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await createItem({ type: "snippet", title: "Test" });

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("returns a validation error for invalid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await createItem({ type: "snippet", title: "" });

    expect(result).toEqual({ success: false, error: "Title is required" });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("returns an error when the item type cannot be resolved", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue(null);

    const result = await createItem({ type: "snippet", title: "Test" });

    expect(result).toEqual({ success: false, error: "Invalid item type" });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("creates an item and returns the created record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-snippet",
      name: "snippet",
      icon: "Code",
      color: "#3b82f6",
    });
    mockCreateItemInDb.mockResolvedValue(createdItem);

    const result = await createItem({
      type: "snippet",
      title: "Test",
      tags: ["js"],
    });

    expect(result).toEqual({ success: true, data: createdItem });
    expect(mockGetItemTypeBySlug).toHaveBeenCalledWith("user-1", "snippet");
    expect(mockCreateItemInDb).toHaveBeenCalledWith(
      "user-1",
      {
        typeId: "type-snippet",
        title: "Test",
        description: null,
        content: null,
        url: null,
        language: null,
        fileUrl: null,
        fileName: null,
        fileSize: null,
        tags: ["js"],
        collectionIds: [],
        contentType: "text",
      },
      {},
    );
  });

  it("rejects invalid collection selections", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-snippet",
      name: "snippet",
      icon: "Code",
      color: "#3b82f6",
    });
    mockValidateUserCollectionIds.mockResolvedValue(false);

    const result = await createItem({
      type: "snippet",
      title: "Test",
      collectionIds: ["collection-1"],
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid collection selection",
    });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("creates an item with collection assignments", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-snippet",
      name: "snippet",
      icon: "Code",
      color: "#3b82f6",
    });
    mockCreateItemInDb.mockResolvedValue(createdItem);

    const result = await createItem({
      type: "snippet",
      title: "Test",
      collectionIds: ["collection-1", "collection-2"],
    });

    expect(result).toEqual({ success: true, data: createdItem });
    expect(mockValidateUserCollectionIds).toHaveBeenCalledWith("user-1", [
      "collection-1",
      "collection-2",
    ]);
    expect(mockCreateItemInDb).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        collectionIds: ["collection-1", "collection-2"],
      }),
      expect.anything(),
    );
  });

  it("rejects file references that do not belong to the user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-image",
      name: "image",
      icon: "Image",
      color: "#ec4899",
    });
    mockGetUserIsPro.mockResolvedValue(true);

    const result = await createItem({
      type: "image",
      title: "Screenshot",
      fileUrl: "users/user-2/abc123/photo.png",
      fileName: "photo.png",
      fileSize: 1024,
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid file reference",
    });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("rejects image item creation for non-Pro users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-image",
      name: "image",
      icon: "Image",
      color: "#ec4899",
    });
    mockGetUserIsPro.mockResolvedValue(false);

    const result = await createItem({
      type: "image",
      title: "Screenshot",
      fileUrl: "users/user-1/abc123/photo.png",
      fileName: "photo.png",
      fileSize: 1024,
    });

    expect(result).toEqual({
      success: false,
      error: "File and image uploads require a Pro subscription",
    });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("rejects file item creation for non-Pro users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-file",
      name: "file",
      icon: "File",
      color: "#64748b",
    });
    mockGetUserIsPro.mockResolvedValue(false);

    const result = await createItem({
      type: "file",
      title: "Notes",
      fileUrl: "users/user-1/abc123/notes.pdf",
      fileName: "notes.pdf",
      fileSize: 1024,
    });

    expect(result).toEqual({
      success: false,
      error: "File and image uploads require a Pro subscription",
    });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("creates a file item for Pro users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-file",
      name: "file",
      icon: "File",
      color: "#64748b",
    });
    mockGetUserIsPro.mockResolvedValue(true);
    mockGetUserItemStats.mockResolvedValue({ ...defaultStats, itemCount: 50 });
    mockCreateItemInDb.mockResolvedValue(createdItem);
    mockPendingUpload("users/user-1/abc123/notes.pdf", 4096, "file");
    mockGetObjectMetadata.mockResolvedValue({
      size: 4096,
      contentType: "application/pdf",
    });
    mockGetUserStorageUsageBytes.mockResolvedValue(4096);

    const result = await createItem({
      type: "file",
      title: "Notes",
      fileUrl: "users/user-1/abc123/notes.pdf",
      fileName: "notes.pdf",
      fileSize: 1,
    });

    expect(result).toEqual({ success: true, data: createdItem });
    expect(mockGetObjectMetadata).toHaveBeenCalledWith("users/user-1/abc123/notes.pdf");
    expect(mockConsumePendingUpload).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "users/user-1/abc123/notes.pdf",
    );
    expect(mockCreateItemInDb).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        fileUrl: "users/user-1/abc123/notes.pdf",
        fileName: "notes.pdf",
        fileSize: 4096,
        contentType: "file",
      }),
      expect.anything(),
    );
  });

  it("rejects file items whose object does not exist in storage", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-file",
      name: "file",
      icon: "File",
      color: "#64748b",
    });
    mockGetUserIsPro.mockResolvedValue(true);
    mockPendingUpload("users/user-1/abc123/notes.pdf", 1024, "file");
    mockGetObjectMetadata.mockResolvedValue(null);

    const result = await createItem({
      type: "file",
      title: "Notes",
      fileUrl: "users/user-1/abc123/notes.pdf",
      fileName: "notes.pdf",
      fileSize: 1024,
    });

    expect(result).toEqual({ success: false, error: "Invalid file reference" });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("rejects image items that reference a non-image object", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-image",
      name: "image",
      icon: "Image",
      color: "#ec4899",
    });
    mockGetUserIsPro.mockResolvedValue(true);
    mockPendingUpload("users/user-1/abc123/notes.pdf", 1024, "image");
    mockGetObjectMetadata.mockResolvedValue({
      size: 1024,
      contentType: "application/pdf",
    });

    const result = await createItem({
      type: "image",
      title: "Screenshot",
      fileUrl: "users/user-1/abc123/notes.pdf",
      fileName: "notes.pdf",
      fileSize: 1024,
    });

    expect(result).toEqual({ success: false, error: "Invalid file reference" });
    expect(mockDeleteObject).toHaveBeenCalledWith("users/user-1/abc123/notes.pdf");
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("rejects image items whose magic bytes do not match", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-image",
      name: "image",
      icon: "Image",
      color: "#ec4899",
    });
    mockGetUserIsPro.mockResolvedValue(true);
    mockPendingUpload("users/user-1/abc123/photo.png", 1024, "image");
    mockGetObjectMetadata.mockResolvedValue({
      size: 1024,
      contentType: "image/png",
    });
    mockGetObjectByteRange.mockResolvedValue(Buffer.from("not-a-png-file"));

    const result = await createItem({
      type: "image",
      title: "Screenshot",
      fileUrl: "users/user-1/abc123/photo.png",
      fileName: "photo.png",
      fileSize: 1024,
    });

    expect(result).toEqual({
      success: false,
      error: "File contents do not match the declared image type",
    });
    expect(mockDeleteObject).toHaveBeenCalledWith("users/user-1/abc123/photo.png");
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("creates an image item when magic bytes match the declared type", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-image",
      name: "image",
      icon: "Image",
      color: "#ec4899",
    });
    mockGetUserIsPro.mockResolvedValue(true);
    mockCreateItemInDb.mockResolvedValue(createdItem);
    mockPendingUpload("users/user-1/abc123/photo.png", 2048, "image");
    mockGetObjectMetadata.mockResolvedValue({
      size: 2048,
      contentType: "image/png",
    });
    mockGetObjectByteRange.mockResolvedValue(pngHeader);
    mockGetUserStorageUsageBytes.mockResolvedValue(2048);

    const result = await createItem({
      type: "image",
      title: "Screenshot",
      fileUrl: "users/user-1/abc123/photo.png",
      fileName: "photo.png",
      fileSize: 2048,
    });

    expect(result).toEqual({ success: true, data: createdItem });
    expect(mockDeleteObject).not.toHaveBeenCalled();
    expect(mockCreateItemInDb).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ fileSize: 2048, contentType: "file" }),
      expect.anything(),
    );
  });

  it("rejects uploads larger than the category limit reported by R2", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-file",
      name: "file",
      icon: "File",
      color: "#64748b",
    });
    mockGetUserIsPro.mockResolvedValue(true);
    mockPendingUpload("users/user-1/abc123/huge.pdf", 11 * 1024 * 1024, "file");
    mockGetObjectMetadata.mockResolvedValue({
      size: 11 * 1024 * 1024,
      contentType: "application/pdf",
    });

    const result = await createItem({
      type: "file",
      title: "Huge",
      fileUrl: "users/user-1/abc123/huge.pdf",
      fileName: "huge.pdf",
      fileSize: 1,
    });

    expect(result).toEqual({
      success: false,
      error: "Uploaded file exceeds the size limit",
    });
    expect(mockDeleteObject).toHaveBeenCalled();
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("rejects file items that would exceed the Pro storage quota", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-file",
      name: "file",
      icon: "File",
      color: "#64748b",
    });
    mockGetUserIsPro.mockResolvedValue(true);
    mockPendingUpload("users/user-1/abc123/notes.pdf", 2048, "file");
    mockGetObjectMetadata.mockResolvedValue({
      size: 2048,
      contentType: "application/pdf",
    });
    mockGetUserStorageUsageBytes.mockResolvedValue(1024 * 1024 * 1024 + 1024);

    const result = await createItem({
      type: "file",
      title: "Notes",
      fileUrl: "users/user-1/abc123/notes.pdf",
      fileName: "notes.pdf",
      fileSize: 1,
    });

    expect(result).toEqual({
      success: false,
      error: "Storage quota exceeded. Pro accounts are limited to 1 GB of uploads.",
    });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  describe("pending upload verification", () => {
    const key = "users/user-1/abc123/notes.pdf";

    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockGetItemTypeBySlug.mockResolvedValue({
        id: "type-file",
        name: "file",
        icon: "File",
        color: "#64748b",
      });
      mockGetUserIsPro.mockResolvedValue(true);
      mockCreateItemInDb.mockResolvedValue(createdItem);
      mockGetObjectMetadata.mockResolvedValue({
        size: 4096,
        contentType: "application/pdf",
      });
      mockGetUserStorageUsageBytes.mockResolvedValue(4096);
    });

    function createFileItem() {
      return createItem({
        type: "file",
        title: "Notes",
        fileUrl: key,
        fileName: "notes.pdf",
        fileSize: 4096,
      });
    }

    it("rejects keys without a pending upload and leaves the object untouched", async () => {
      const result = await createFileItem();

      expect(result).toEqual({
        success: false,
        error: "Upload expired. Please upload the file again.",
      });
      expect(mockFindPendingUpload).toHaveBeenCalledWith("user-1", key);
      expect(mockGetObjectMetadata).not.toHaveBeenCalled();
      expect(mockDeleteObject).not.toHaveBeenCalled();
      expect(mockCreateItemInDb).not.toHaveBeenCalled();
    });

    it("rejects pending uploads issued for a different category", async () => {
      mockPendingUpload(key, 4096, "image");

      const result = await createFileItem();

      expect(result).toEqual({ success: false, error: "Invalid file reference" });
      expect(mockDeleteObject).not.toHaveBeenCalled();
      expect(mockCreateItemInDb).not.toHaveBeenCalled();
    });

    it("discards uploads whose stored size differs from the reserved size", async () => {
      mockPendingUpload(key, 1024, "file");

      const result = await createFileItem();

      expect(result).toEqual({ success: false, error: "Invalid file reference" });
      expect(mockReleasePendingUpload).toHaveBeenCalledWith("user-1", key);
      expect(mockDeleteObject).toHaveBeenCalledWith(key);
      expect(mockCreateItemInDb).not.toHaveBeenCalled();
    });

    it("keeps the object when the pending upload was already consumed", async () => {
      mockPendingUpload(key, 1024, "file");
      mockReleasePendingUpload.mockResolvedValue(false);

      const result = await createFileItem();

      expect(result).toEqual({ success: false, error: "Invalid file reference" });
      expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it("excludes the upload's own reservation from the quota check", async () => {
      mockPendingUpload(key, 4096, "file");
      mockGetUserStorageUsageBytes.mockResolvedValue(1024 * 1024 * 1024);

      const result = await createFileItem();

      expect(result).toEqual({ success: true, data: createdItem });
    });

    it("returns an expiry error when the pending upload is purged before the insert", async () => {
      mockPendingUpload(key, 4096, "file");
      mockConsumePendingUpload.mockRejectedValue(new PendingUploadNotFoundError());

      const result = await createFileItem();

      expect(result).toEqual({
        success: false,
        error: "Upload expired. Please upload the file again.",
      });
      expect(mockCreateItemInDb).not.toHaveBeenCalled();
      expect(mockDeleteObject).not.toHaveBeenCalled();
    });
  });

  it("rejects item creation when a free user is at the item limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-snippet",
      name: "snippet",
      icon: "Code",
      color: "#3b82f6",
    });
    mockGetUserIsPro.mockResolvedValue(false);
    mockRunWithFreeTierItemGuard.mockRejectedValue(
      new FreeTierLimitExceededError("item"),
    );

    const result = await createItem({ type: "snippet", title: "Test" });

    expect(result).toEqual({
      success: false,
      error:
        "Free plan is limited to 50 items. Upgrade to Pro for unlimited items.",
    });
    expect(mockCreateItemInDb).not.toHaveBeenCalled();
  });

  it("allows Pro users to create items above the free limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetItemTypeBySlug.mockResolvedValue({
      id: "type-snippet",
      name: "snippet",
      icon: "Code",
      color: "#3b82f6",
    });
    mockGetUserIsPro.mockResolvedValue(true);
    mockGetUserItemStats.mockResolvedValue({ ...defaultStats, itemCount: 50 });
    mockCreateItemInDb.mockResolvedValue(createdItem);

    const result = await createItem({ type: "snippet", title: "Test" });

    expect(result).toEqual({ success: true, data: createdItem });
    expect(mockCreateItemInDb).toHaveBeenCalled();
  });
});

describe("deleteItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await deleteItem("item-1");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockDeleteItemInDb).not.toHaveBeenCalled();
  });

  it("returns an error when the item is not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteItemInDb.mockResolvedValue(null);

    const result = await deleteItem("item-1");

    expect(result).toEqual({ success: false, error: "Item not found" });
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it("moves an item to trash without deleting R2 objects", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteItemInDb.mockResolvedValue({ typeName: "snippet" });

    const result = await deleteItem("item-1");

    expect(result.success).toBe(true);
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });
});

describe("restoreItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await restoreItem("item-1");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockRunWithFreeTierItemRestoreGuard).not.toHaveBeenCalled();
  });

  it("returns not found when the trashed item does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetUserIsPro.mockResolvedValue(false);
    mockRunWithFreeTierItemRestoreGuard.mockImplementation(
      async (_userId, _isPro, restore) => restore({} as never),
    );
    mockRestoreItemInDb.mockResolvedValue(null);

    const result = await restoreItem("item-1");

    expect(result).toEqual({ success: false, error: "Item not found" });
  });

  it("returns the free-tier limit message when restore is blocked", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetUserIsPro.mockResolvedValue(false);
    mockRunWithFreeTierItemRestoreGuard.mockRejectedValue(
      new FreeTierLimitExceededError("item"),
    );

    const result = await restoreItem("item-1");

    expect(result).toEqual({
      success: false,
      error: itemLimitErrorMessage(),
    });
  });

  it("restores a trashed item", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetUserIsPro.mockResolvedValue(true);
    mockRunWithFreeTierItemRestoreGuard.mockImplementation(
      async (_userId, _isPro, restore) => restore({} as never),
    );
    mockRestoreItemInDb.mockResolvedValue({
      id: "item-1",
      typeName: "snippet",
    });

    const result = await restoreItem("item-1");

    expect(result).toEqual({
      success: true,
      data: { id: "item-1", typeName: "snippet" },
    });
  });
});

describe("permanentlyDeleteItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the R2 object when the trashed item had a file", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockPermanentlyDeleteItemInDb.mockResolvedValue({
      typeName: "file",
      fileUrl: "users/user-1/abc123/notes.pdf",
    });

    const result = await permanentlyDeleteItem("item-1");

    expect(result.success).toBe(true);
    expect(mockDeleteObject).toHaveBeenCalledWith(
      "users/user-1/abc123/notes.pdf",
    );
  });

  it("returns not found when the item is not in trash", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockPermanentlyDeleteItemInDb.mockResolvedValue(null);

    const result = await permanentlyDeleteItem("item-1");

    expect(result).toEqual({ success: false, error: "Item not found" });
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it("succeeds even when R2 deletion fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockPermanentlyDeleteItemInDb.mockResolvedValue({
      typeName: "file",
      fileUrl: "users/user-1/abc123/notes.pdf",
    });
    mockDeleteObject.mockRejectedValueOnce(new Error("R2 unavailable"));

    const result = await permanentlyDeleteItem("item-1");

    expect(result.success).toBe(true);
  });
});

describe("emptyTrash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await emptyTrash();

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockEmptyTrashInDb).not.toHaveBeenCalled();
  });

  it("empties the signed-in user's trash", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockEmptyTrashInDb.mockResolvedValue({ deletedCount: 2 });

    const result = await emptyTrash();

    expect(result).toEqual({ success: true, data: { deletedCount: 2 } });
    expect(mockEmptyTrashInDb).toHaveBeenCalledWith("user-1");
  });
});

describe("toggleItemFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await toggleItemFavorite("item-1");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockToggleItemFavoriteInDb).not.toHaveBeenCalled();
  });

  it("returns not found when the item does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockToggleItemFavoriteInDb.mockResolvedValue(null);

    const result = await toggleItemFavorite("item-1");

    expect(result).toEqual({ success: false, error: "Item not found" });
  });

  it("toggles favorite state and returns the updated record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockToggleItemFavoriteInDb.mockResolvedValue({
      id: "item-1",
      isFavorite: true,
      typeName: "snippet",
    });

    const result = await toggleItemFavorite("item-1");

    expect(result).toEqual({
      success: true,
      data: { id: "item-1", isFavorite: true, typeName: "snippet" },
    });
    expect(mockToggleItemFavoriteInDb).toHaveBeenCalledWith(
      "user-1",
      "item-1",
    );
  });
});

describe("toggleItemPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await toggleItemPin("item-1");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockToggleItemPinInDb).not.toHaveBeenCalled();
  });

  it("returns not found when the item does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockToggleItemPinInDb.mockResolvedValue(null);

    const result = await toggleItemPin("item-1");

    expect(result).toEqual({ success: false, error: "Item not found" });
  });

  it("toggles pin state and returns the updated record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockToggleItemPinInDb.mockResolvedValue({
      id: "item-1",
      isPinned: true,
      typeName: "snippet",
    });

    const result = await toggleItemPin("item-1");

    expect(result).toEqual({
      success: true,
      data: { id: "item-1", isPinned: true, typeName: "snippet" },
    });
    expect(mockToggleItemPinInDb).toHaveBeenCalledWith("user-1", "item-1");
  });
});
