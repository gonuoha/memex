import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/db/settings", () => ({
  updateUserPreferences: vi.fn(),
}));

vi.mock("@/lib/db/items", () => ({
  getSystemItemTypes: vi.fn(),
  createItem: vi.fn(),
}));

vi.mock("@/lib/db/collections", () => ({
  createCollection: vi.fn(),
}));

vi.mock("@/lib/db/advisory-lock", () => ({
  takeUserAdvisoryLock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireSession } from "@/lib/actions/require-session";
import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { createCollection } from "@/lib/db/collections";
import { createItem, getSystemItemTypes } from "@/lib/db/items";
import { updateUserPreferences } from "@/lib/db/settings";
import { prisma } from "@/lib/prisma";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/subscription-limits";

import { addSampleItems, dismissOnboarding } from "./onboarding";

const mockRequireSession = vi.mocked(requireSession);
const mockUpdateUserPreferences = vi.mocked(updateUserPreferences);
const mockGetSystemItemTypes = vi.mocked(getSystemItemTypes);
const mockCreateCollection = vi.mocked(createCollection);
const mockCreateItem = vi.mocked(createItem);
const mockTransaction = vi.mocked(prisma.$transaction);

function createTx(options: {
  isPro?: boolean;
  sampleDataAddedAt?: string | null;
  itemCount?: number;
  collectionCount?: number;
}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        isPro: options.isPro ?? false,
        userPreferences: { sampleDataAddedAt: options.sampleDataAddedAt ?? null },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    item: { count: vi.fn().mockResolvedValue(options.itemCount ?? 0) },
    collection: {
      count: vi.fn().mockResolvedValue(options.collectionCount ?? 0),
    },
  };
}

function useTx(tx: ReturnType<typeof createTx>) {
  mockTransaction.mockImplementation((async (
    fn: (client: typeof tx) => Promise<unknown>,
  ) => fn(tx)) as never);
}

describe("onboarding actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      success: true,
      userId: "user-1",
    });
    mockGetSystemItemTypes.mockResolvedValue([
      { id: "t1", name: "snippet", kind: "code", slug: "snippets", isSystem: true, icon: "Code", color: null },
      { id: "t2", name: "command", kind: "code", slug: "commands", isSystem: true, icon: "Terminal", color: null },
      { id: "t3", name: "prompt", kind: "markdown", slug: "prompts", isSystem: true, icon: "Sparkles", color: null },
      { id: "t4", name: "note", kind: "markdown", slug: "notes", isSystem: true, icon: "StickyNote", color: null },
      { id: "t5", name: "link", kind: "link", slug: "links", isSystem: true, icon: "Link", color: null },
    ]);
    mockCreateCollection.mockResolvedValue({
      id: "col-1",
      name: "Getting started",
      description: null,
      isFavorite: false,
    });
    mockCreateItem.mockResolvedValue({} as never);
  });

  it("dismisses onboarding", async () => {
    const result = await dismissOnboarding();
    expect(result.success).toBe(true);
    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("user-1", {
      onboardingDismissed: true,
    });
  });

  it("skips adding samples when already added", async () => {
    const tx = createTx({ sampleDataAddedAt: "2026-01-01T00:00:00.000Z" });
    useTx(tx);

    const result = await addSampleItems();

    expect(result).toEqual({ success: true, data: { added: false } });
    expect(takeUserAdvisoryLock).toHaveBeenCalledWith(tx, "user-1");
    expect(mockCreateCollection).not.toHaveBeenCalled();
    expect(mockCreateItem).not.toHaveBeenCalled();
  });

  it("refuses when samples would exceed the free item limit", async () => {
    useTx(createTx({ itemCount: FREE_ITEM_LIMIT - 2 }));

    const result = await addSampleItems();

    expect(result.success).toBe(false);
    expect(mockCreateItem).not.toHaveBeenCalled();
  });

  it("adds items without a collection when the free collection limit is reached", async () => {
    useTx(createTx({ collectionCount: FREE_COLLECTION_LIMIT }));

    const result = await addSampleItems();

    expect(result).toEqual({ success: true, data: { added: true } });
    expect(mockCreateCollection).not.toHaveBeenCalled();
    expect(mockCreateItem).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ collectionIds: [] }),
      expect.anything(),
    );
  });

  it("creates the collection, items and marker in one transaction", async () => {
    const tx = createTx({});
    useTx(tx);

    const result = await addSampleItems();

    expect(result).toEqual({ success: true, data: { added: true } });
    expect(mockCreateCollection).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "Getting started" }),
      tx,
    );
    expect(mockCreateItem).toHaveBeenCalledTimes(5);
    expect(mockCreateItem).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ collectionIds: ["col-1"] }),
      tx,
    );
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        userPreferences: expect.objectContaining({
          sampleDataAddedAt: expect.any(String),
        }),
      },
    });
  });
});
