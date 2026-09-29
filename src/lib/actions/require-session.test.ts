import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

import { requireSession } from "./require-session";

const mockAuth = vi.mocked(auth);

describe("requireSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);

    const result = await requireSession();

    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns unauthorized when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} } as never);

    const result = await requireSession();

    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns userId when session is valid", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await requireSession();

    expect(result).toEqual({ success: true, userId: "user-1" });
  });
});
