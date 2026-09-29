import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreatedCollection } from "@/lib/db/collections";

import { defaultStats } from "./__tests__/fixtures";
import { mockAuth, mockUnauthenticated } from "./__tests__/mock-auth";

vi.mock("@/lib/db/collections", () => ({
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  toggleCollectionFavorite: vi.fn(),
}));

vi.mock("@/lib/db/items", () => ({
  getUserItemStats: vi.fn(),
}));

vi.mock("@/lib/db/user", () => ({
  getUserIsPro: vi.fn(),
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
  runWithFreeTierCollectionGuard: vi.fn(),
}));

import {
  createCollection as createCollectionInDb,
  deleteCollection as deleteCollectionInDb,
  toggleCollectionFavorite as toggleCollectionFavoriteInDb,
  updateCollection as updateCollectionInDb,
} from "@/lib/db/collections";
import { getUserItemStats } from "@/lib/db/items";
import {
  FreeTierLimitExceededError,
  runWithFreeTierCollectionGuard,
} from "@/lib/db/free-tier-limits";
import { getUserIsPro } from "@/lib/db/user";

import {
  createCollection,
  deleteCollection,
  toggleCollectionFavorite,
  updateCollection,
} from "./collections";

const mockCreateCollectionInDb = vi.mocked(createCollectionInDb);
const mockUpdateCollectionInDb = vi.mocked(updateCollectionInDb);
const mockDeleteCollectionInDb = vi.mocked(deleteCollectionInDb);
const mockToggleCollectionFavoriteInDb = vi.mocked(toggleCollectionFavoriteInDb);
const mockGetUserItemStats = vi.mocked(getUserItemStats);
const mockGetUserIsPro = vi.mocked(getUserIsPro);
const mockRunWithFreeTierCollectionGuard = vi.mocked(runWithFreeTierCollectionGuard);

const createdCollection: CreatedCollection = {
  id: "collection-1",
  name: "My Collection",
  description: "A useful collection",
  isFavorite: false,
};

describe("createCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserIsPro.mockResolvedValue(false);
    mockGetUserItemStats.mockResolvedValue(defaultStats);
    mockRunWithFreeTierCollectionGuard.mockImplementation(
      async (_userId, _isPro, create) => create({} as never),
    );
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await createCollection({
      name: "My Collection",
      description: "A useful collection",
    });

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockCreateCollectionInDb).not.toHaveBeenCalled();
  });

  it("returns a validation error for invalid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await createCollection({
      name: "",
      description: "A useful collection",
    });

    expect(result).toEqual({ success: false, error: "Name is required" });
    expect(mockCreateCollectionInDb).not.toHaveBeenCalled();
  });

  it("creates a collection and returns the created record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockCreateCollectionInDb.mockResolvedValue(createdCollection);

    const result = await createCollection({
      name: "My Collection",
      description: "A useful collection",
    });

    expect(result).toEqual({ success: true, data: createdCollection });
    expect(mockCreateCollectionInDb).toHaveBeenCalledWith(
      "user-1",
      {
        name: "My Collection",
        description: "A useful collection",
      },
      {},
    );
  });

  it("returns an error when the collection name already exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockCreateCollectionInDb.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const result = await createCollection({
      name: "My Collection",
      description: "A useful collection",
    });

    expect(result).toEqual({
      success: false,
      error: "A collection with this name already exists",
    });
  });

  it("rejects collection creation when a free user is at the collection limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetUserIsPro.mockResolvedValue(false);
    mockRunWithFreeTierCollectionGuard.mockRejectedValue(
      new FreeTierLimitExceededError("collection"),
    );

    const result = await createCollection({
      name: "My Collection",
      description: "A useful collection",
    });

    expect(result).toEqual({
      success: false,
      error:
        "Free plan is limited to 3 collections. Upgrade to Pro for unlimited collections.",
    });
    expect(mockCreateCollectionInDb).not.toHaveBeenCalled();
  });

  it("allows Pro users to create collections above the free limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetUserIsPro.mockResolvedValue(true);
    mockGetUserItemStats.mockResolvedValue({ ...defaultStats, collectionCount: 3 });
    mockCreateCollectionInDb.mockResolvedValue(createdCollection);

    const result = await createCollection({
      name: "My Collection",
      description: "A useful collection",
    });

    expect(result).toEqual({ success: true, data: createdCollection });
    expect(mockCreateCollectionInDb).toHaveBeenCalled();
  });
});

describe("updateCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await updateCollection("collection-1", {
      name: "Updated Collection",
      description: "Updated description",
    });

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockUpdateCollectionInDb).not.toHaveBeenCalled();
  });

  it("returns a validation error for invalid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await updateCollection("collection-1", {
      name: "",
      description: "Updated description",
    });

    expect(result).toEqual({ success: false, error: "Name is required" });
    expect(mockUpdateCollectionInDb).not.toHaveBeenCalled();
  });

  it("updates a collection and returns the updated record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpdateCollectionInDb.mockResolvedValue({
      ...createdCollection,
      name: "Updated Collection",
    });

    const result = await updateCollection("collection-1", {
      name: "Updated Collection",
      description: "Updated description",
    });

    expect(result).toEqual({
      success: true,
      data: { ...createdCollection, name: "Updated Collection" },
    });
    expect(mockUpdateCollectionInDb).toHaveBeenCalledWith(
      "user-1",
      "collection-1",
      {
        name: "Updated Collection",
        description: "Updated description",
      },
    );
  });

  it("returns not found when the collection does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpdateCollectionInDb.mockResolvedValue(null);

    const result = await updateCollection("collection-1", {
      name: "Updated Collection",
      description: "Updated description",
    });

    expect(result).toEqual({ success: false, error: "Collection not found" });
  });

  it("returns an error when the collection name already exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpdateCollectionInDb.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const result = await updateCollection("collection-1", {
      name: "Updated Collection",
      description: "Updated description",
    });

    expect(result).toEqual({
      success: false,
      error: "A collection with this name already exists",
    });
  });
});

describe("deleteCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await deleteCollection("collection-1");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockDeleteCollectionInDb).not.toHaveBeenCalled();
  });

  it("deletes a collection and returns the deleted record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteCollectionInDb.mockResolvedValue({
      id: "collection-1",
      name: "My Collection",
    });

    const result = await deleteCollection("collection-1");

    expect(result).toEqual({
      success: true,
      data: { id: "collection-1", name: "My Collection" },
    });
    expect(mockDeleteCollectionInDb).toHaveBeenCalledWith(
      "user-1",
      "collection-1",
    );
  });

  it("returns not found when the collection does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteCollectionInDb.mockResolvedValue(null);

    const result = await deleteCollection("collection-1");

    expect(result).toEqual({ success: false, error: "Collection not found" });
  });
});

describe("toggleCollectionFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await toggleCollectionFavorite("collection-1");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockToggleCollectionFavoriteInDb).not.toHaveBeenCalled();
  });

  it("returns not found when the collection does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockToggleCollectionFavoriteInDb.mockResolvedValue(null);

    const result = await toggleCollectionFavorite("collection-1");

    expect(result).toEqual({ success: false, error: "Collection not found" });
  });

  it("toggles favorite state and returns the updated record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockToggleCollectionFavoriteInDb.mockResolvedValue({
      id: "collection-1",
      isFavorite: true,
    });

    const result = await toggleCollectionFavorite("collection-1");

    expect(result).toEqual({
      success: true,
      data: { id: "collection-1", isFavorite: true },
    });
    expect(mockToggleCollectionFavoriteInDb).toHaveBeenCalledWith(
      "user-1",
      "collection-1",
    );
  });
});
