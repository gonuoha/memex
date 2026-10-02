import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    itemType: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    item: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

import {
  deleteCustomItemType,
  updateCustomItemType,
} from "./item-types";

const mockFindFirst = vi.mocked(prisma.itemType.findFirst);
const mockItemCount = vi.mocked(prisma.item.count);
const mockUpdate = vi.mocked(prisma.itemType.update);
const mockTransaction = vi.mocked(prisma.$transaction);

describe("updateCustomItemType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks kind changes when the type has items", async () => {
    mockFindFirst.mockResolvedValue({
      id: "type-1",
      name: "Runbooks",
      kind: "markdown",
      slug: "runbooks",
      icon: "BookOpen",
      color: "#6366F1",
    } as never);
    mockItemCount.mockResolvedValue(2);

    await expect(
      updateCustomItemType("user-1", "type-1", { kind: "code" }),
    ).rejects.toThrow("KIND_IMMUTABLE");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows kind changes when item count is zero", async () => {
    mockFindFirst.mockResolvedValue({
      id: "type-1",
      name: "Runbooks",
      kind: "markdown",
      slug: "runbooks",
      icon: "BookOpen",
      color: "#6366F1",
    } as never);
    mockItemCount.mockResolvedValue(0);
    mockUpdate.mockResolvedValue({
      id: "type-1",
      name: "Runbooks",
      kind: "code",
      slug: "runbooks",
      icon: "BookOpen",
      color: "#6366F1",
    } as never);

    const updated = await updateCustomItemType("user-1", "type-1", {
      kind: "code",
    });

    expect(updated?.kind).toBe("code");
  });
});

describe("deleteCustomItemType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (callback) => {
      if (typeof callback === "function") {
        return callback({
          itemType: {
            findFirst: mockFindFirst,
            delete: vi.fn(),
          },
          item: {
            count: mockItemCount,
            updateMany: vi.fn(),
          },
        } as never);
      }

      return undefined;
    });
  });

  it("requires a move target when items exist only in trash", async () => {
    mockFindFirst.mockResolvedValue({
      id: "type-1",
      name: "Runbooks",
      kind: "markdown",
    } as never);
    mockItemCount.mockResolvedValue(2);

    await expect(deleteCustomItemType("user-1", "type-1")).rejects.toThrow(
      "MOVE_REQUIRED",
    );
  });

  it("rejects moving items to the same type", async () => {
    mockFindFirst.mockResolvedValue({
      id: "type-1",
      name: "Runbooks",
      kind: "markdown",
    } as never);
    mockItemCount.mockResolvedValue(3);

    await expect(
      deleteCustomItemType("user-1", "type-1", "type-1"),
    ).rejects.toThrow("INVALID_MOVE_TARGET");
  });
});
