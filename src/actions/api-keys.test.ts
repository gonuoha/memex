import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockAuth, mockUnauthenticated } from "./__tests__/mock-auth";

vi.mock("@/lib/db/api-keys", () => ({
  countActiveApiKeysForUser: vi.fn(),
  createApiKeyRecord: vi.fn(),
  listApiKeysForUser: vi.fn(),
  revokeApiKeyForUser: vi.fn(),
}));

vi.mock("@/lib/db/user", () => ({
  getUserIsPro: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiKeyCreateRateLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/advisory-lock", () => ({
  takeUserAdvisoryLock: vi.fn(),
}));

import {
  countActiveApiKeysForUser,
  createApiKeyRecord,
  revokeApiKeyForUser,
} from "@/lib/db/api-keys";
import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { getUserIsPro } from "@/lib/db/user";
import { prisma } from "@/lib/prisma";
import { checkApiKeyCreateRateLimit } from "@/lib/rate-limit";

import { createApiKey, revokeApiKey } from "./api-keys";

const mockCountActive = vi.mocked(countActiveApiKeysForUser);
const mockCreateRecord = vi.mocked(createApiKeyRecord);
const mockRevoke = vi.mocked(revokeApiKeyForUser);
const mockGetUserIsPro = vi.mocked(getUserIsPro);
const mockRateLimit = vi.mocked(checkApiKeyCreateRateLimit);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockTakeLock = vi.mocked(takeUserAdvisoryLock);

describe("api-keys actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserIsPro.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue({ success: true, remaining: 5, reset: 0 });
    mockCountActive.mockResolvedValue(0);
    mockTakeLock.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (callback) =>
      callback({} as never),
    );
    mockCreateRecord.mockResolvedValue({
      id: "key-1",
      name: "CI",
      prefix: "mx_live_ab",
      expiresAt: null,
      createdAt: new Date("2026-01-01"),
    });
  });

  it("requires authentication", async () => {
    mockUnauthenticated();

    const result = await createApiKey({ name: "CI" });

    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("blocks free users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetUserIsPro.mockResolvedValue(false);

    const result = await createApiKey({ name: "CI" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Pro");
    }
  });

  it("enforces the active key limit inside the advisory lock", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockCountActive.mockResolvedValue(10);

    const result = await createApiKey({ name: "CI" });

    expect(result.success).toBe(false);
    expect(mockCreateRecord).not.toHaveBeenCalled();
    expect(mockTakeLock).toHaveBeenCalled();
  });

  it("creates a key and returns the plaintext once", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await createApiKey({ name: "CI" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plaintextKey.startsWith("mx_")).toBe(true);
    }
    expect(mockCreateRecord).toHaveBeenCalled();
  });

  it("revokes keys for the current user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockRevoke.mockResolvedValue(true);

    const result = await revokeApiKey("key-1");

    expect(result).toEqual({ success: true, data: { id: "key-1" } });
  });
});
