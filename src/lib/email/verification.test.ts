import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
  },
}));

import { prisma } from "@/lib/prisma";

import { verifyEmailToken } from "./verification";

const mockFindUnique = vi.mocked(prisma.verificationToken.findUnique);

describe("verifyEmailToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects password-reset identifiers", async () => {
    mockFindUnique.mockResolvedValue({
      identifier: "password-reset:user@example.com",
      token: "token-1",
      expires: new Date(Date.now() + 60_000),
    } as never);

    const result = await verifyEmailToken("token-1");

    expect(result).toEqual({ status: "invalid" });
  });

  it("accepts legacy unprefixed email identifiers", async () => {
    mockFindUnique.mockResolvedValue({
      identifier: "user@example.com",
      token: "token-1",
      expires: new Date(Date.now() + 60_000),
    } as never);

    const result = await verifyEmailToken("token-1");

    expect(result).toEqual({ status: "success" });
  });
});
