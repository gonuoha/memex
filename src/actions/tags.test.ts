import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockAuth, mockUnauthenticated } from "./__tests__/mock-auth";

vi.mock("@/lib/db/tags", () => ({
  renameTag: vi.fn(),
  deleteTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  deleteTag as deleteTagInDb,
  renameTag as renameTagInDb,
} from "@/lib/db/tags";

import { deleteTag, renameTag } from "./tags";

const mockRenameTagInDb = vi.mocked(renameTagInDb);
const mockDeleteTagInDb = vi.mocked(deleteTagInDb);

describe("renameTag action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized without a session", async () => {
    mockUnauthenticated();

    const result = await renameTag("tag-1", { name: "api" });

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockRenameTagInDb).not.toHaveBeenCalled();
  });

  it("returns not found when the tag is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockRenameTagInDb.mockResolvedValue(null);

    const result = await renameTag("tag-1", { name: "api" });

    expect(result).toEqual({ success: false, error: "Tag not found" });
  });

  it("maps unique constraint errors to a friendly message", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockRenameTagInDb.mockRejectedValue({ code: "P2002" });

    const result = await renameTag("tag-1", { name: "api" });

    expect(result).toEqual({
      success: false,
      error: "A tag with this name already exists",
    });
  });
});

describe("deleteTag action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not found when the tag is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteTagInDb.mockResolvedValue(null);

    const result = await deleteTag("tag-1");

    expect(result).toEqual({ success: false, error: "Tag not found" });
  });

  it("returns failure when the db layer throws", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteTagInDb.mockRejectedValue(new Error("db down"));

    const result = await deleteTag("tag-1");

    expect(result).toEqual({ success: false, error: "Failed to delete tag" });
  });
});
