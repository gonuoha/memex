import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { aggregate: vi.fn() },
    pendingUpload: { aggregate: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

import { getUserStorageUsageBytes } from "./user";

const mockItemAggregate = vi.mocked(prisma.item.aggregate);
const mockPendingAggregate = vi.mocked(prisma.pendingUpload.aggregate);

describe("getUserStorageUsageBytes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds unattached pending uploads to attached file sizes", async () => {
    mockItemAggregate.mockResolvedValue({ _sum: { fileSize: 3000 } } as never);
    mockPendingAggregate.mockResolvedValue({ _sum: { size: 500 } } as never);

    await expect(getUserStorageUsageBytes("user-1")).resolves.toBe(3500);
    expect(mockItemAggregate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      _sum: { fileSize: true },
    });
    expect(mockPendingAggregate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      _sum: { size: true },
    });
  });

  it("treats missing sums as zero", async () => {
    mockItemAggregate.mockResolvedValue({ _sum: { fileSize: null } } as never);
    mockPendingAggregate.mockResolvedValue({ _sum: { size: null } } as never);

    await expect(getUserStorageUsageBytes("user-1")).resolves.toBe(0);
  });
});
