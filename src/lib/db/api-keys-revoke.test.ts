import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUpdateMany } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      updateMany: mockUpdateMany,
    },
  },
}));

import { revokeAllActiveApiKeysForUser } from "./api-keys";

describe("revokeAllActiveApiKeysForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 2 });
  });

  it("revokes active keys for the user", async () => {
    await revokeAllActiveApiKeysForUser("user-1");

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });
});
