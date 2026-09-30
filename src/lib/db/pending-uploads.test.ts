import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  $executeRaw: vi.fn(),
  pendingUpload: {
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    pendingUpload: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/user", () => ({
  getUserStorageUsageBytes: vi.fn(),
}));

vi.mock("@/lib/r2/storage", () => ({
  deleteObjects: vi.fn(),
}));

import type { Prisma } from "@/generated/prisma/client";
import { getUserStorageUsageBytes } from "@/lib/db/user";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/r2/storage";
import { PRO_STORAGE_QUOTA_BYTES } from "@/lib/subscription-limits";

import {
  consumePendingUpload,
  MAX_PENDING_UPLOADS_PER_USER,
  PENDING_UPLOAD_TTL_MS,
  PendingUploadNotFoundError,
  purgeExpiredPendingUploads,
  releasePendingUpload,
  reservePendingUpload,
} from "./pending-uploads";

const mockTransaction = vi.mocked(prisma.$transaction);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockDeleteMany = vi.mocked(prisma.pendingUpload.deleteMany);
const mockCreateMany = vi.mocked(prisma.pendingUpload.createMany);
const mockGetUserStorageUsageBytes = vi.mocked(getUserStorageUsageBytes);
const mockDeleteObjects = vi.mocked(deleteObjects);
const txClient = tx as unknown as Prisma.TransactionClient;

const reserveInput = {
  userId: "user-1",
  key: "users/user-1/abc/notes.pdf",
  size: 4096,
  category: "file" as const,
  isPro: true,
};

function purgedRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `pending-${index}`,
    userId: "user-1",
    key: `users/user-1/${index}/file.pdf`,
    size: 100,
    category: "file",
    createdAt: new Date("2026-09-30T10:00:00.000Z"),
  }));
}

describe("reservePendingUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(((callback: (client: typeof tx) => unknown) =>
      callback(tx)) as never);
    tx.pendingUpload.count.mockResolvedValue(0);
    mockGetUserStorageUsageBytes.mockResolvedValue(0);
  });

  it("locks the user, then records the reservation with an expiry", async () => {
    const before = Date.now();

    const result = await reservePendingUpload(reserveInput);

    expect(result).toEqual({ success: true });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(mockGetUserStorageUsageBytes).toHaveBeenCalledWith("user-1", tx);

    const { data } = tx.pendingUpload.create.mock.calls[0][0];
    expect(data).toMatchObject({
      userId: "user-1",
      key: reserveInput.key,
      size: 4096,
      category: "file",
    });
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + PENDING_UPLOAD_TTL_MS,
    );
  });

  it("rejects when the user already has the maximum active pending uploads", async () => {
    tx.pendingUpload.count.mockResolvedValue(MAX_PENDING_UPLOADS_PER_USER);

    const result = await reservePendingUpload(reserveInput);

    expect(result).toEqual({ success: false, reason: "too_many_pending" });
    expect(tx.pendingUpload.create).not.toHaveBeenCalled();
  });

  it("counts only unexpired reservations toward the concurrency cap", async () => {
    await reservePendingUpload(reserveInput);

    expect(tx.pendingUpload.count).toHaveBeenCalledWith({
      where: { userId: "user-1", expiresAt: { gt: expect.any(Date) } },
    });
  });

  it("rejects when existing usage plus pending uploads would exceed the quota", async () => {
    mockGetUserStorageUsageBytes.mockResolvedValue(PRO_STORAGE_QUOTA_BYTES - 1000);

    const result = await reservePendingUpload(reserveInput);

    expect(result).toEqual({ success: false, reason: "storage_quota" });
    expect(tx.pendingUpload.create).not.toHaveBeenCalled();
  });
});

describe("consumePendingUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the user's reservation for the key", async () => {
    tx.pendingUpload.deleteMany.mockResolvedValue({ count: 1 });

    await consumePendingUpload(txClient, "user-1", "users/user-1/a/b.pdf");

    expect(tx.pendingUpload.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", key: "users/user-1/a/b.pdf" },
    });
  });

  it("throws when the reservation no longer exists", async () => {
    tx.pendingUpload.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      consumePendingUpload(txClient, "user-1", "users/user-1/a/b.pdf"),
    ).rejects.toBeInstanceOf(PendingUploadNotFoundError);
  });
});

describe("releasePendingUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports whether a reservation was removed", async () => {
    mockDeleteMany.mockResolvedValueOnce({ count: 1 });
    mockDeleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(releasePendingUpload("user-1", "k")).resolves.toBe(true);
    await expect(releasePendingUpload("user-1", "k")).resolves.toBe(false);
  });
});

describe("purgeExpiredPendingUploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("deletes objects only for rows it actually removed", async () => {
    const rows = purgedRows(2);
    mockQueryRaw.mockResolvedValueOnce(rows);

    const purged = await purgeExpiredPendingUploads();

    expect(purged).toBe(2);
    expect(mockDeleteObjects).toHaveBeenCalledWith(rows.map((row) => row.key));
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("keeps purging full batches up to the batch limit", async () => {
    mockQueryRaw.mockResolvedValue(purgedRows(100));

    const purged = await purgeExpiredPendingUploads({ maxBatches: 3 });

    expect(purged).toBe(300);
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it("does nothing when no reservations have expired", async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    const purged = await purgeExpiredPendingUploads({ userId: "user-1" });

    expect(purged).toBe(0);
    expect(mockDeleteObjects).not.toHaveBeenCalled();
  });

  it("restores rows as expired when R2 deletion fails so the next run retries", async () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    const rows = purgedRows(1);
    mockQueryRaw.mockResolvedValueOnce(rows);
    mockDeleteObjects.mockRejectedValueOnce(new Error("R2 down"));

    const purged = await purgeExpiredPendingUploads({ now });

    expect(purged).toBe(0);
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [{ ...rows[0], expiresAt: now }],
      skipDuplicates: true,
    });
  });
});
