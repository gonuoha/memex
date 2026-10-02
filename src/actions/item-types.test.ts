import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/db/user", () => ({
  getUserIsPro: vi.fn(),
}));

vi.mock("@/lib/db/item-types", () => ({
  createCustomItemType: vi.fn(),
  updateCustomItemType: vi.fn(),
  deleteCustomItemType: vi.fn(),
  CustomItemTypeLimitError: class CustomItemTypeLimitError extends Error {},
}));

vi.mock("@/lib/db/prisma-errors", () => ({
  isUniqueConstraintError: vi.fn(),
}));

import { requireSession } from "@/lib/actions/require-session";
import {
  createCustomItemType,
  deleteCustomItemType,
  updateCustomItemType,
} from "@/lib/db/item-types";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { getUserIsPro } from "@/lib/db/user";

import {
  createItemType,
  deleteItemType,
  updateItemType,
} from "./item-types";

const mockRequireSession = vi.mocked(requireSession);
const mockGetUserIsPro = vi.mocked(getUserIsPro);
const mockCreateCustomItemType = vi.mocked(createCustomItemType);
const mockUpdateCustomItemType = vi.mocked(updateCustomItemType);
const mockDeleteCustomItemType = vi.mocked(deleteCustomItemType);
const mockIsUniqueConstraintError = vi.mocked(isUniqueConstraintError);

describe("createItemType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      success: true,
      userId: "user-1",
    });
  });

  it("requires Pro to create custom types", async () => {
    mockGetUserIsPro.mockResolvedValue(false);

    const result = await createItemType({
      name: "Widgets",
      kind: "code",
      icon: "Code",
      color: "#6366F1",
    });

    expect(result).toEqual({
      success: false,
      error: "Custom item types require a Pro subscription",
    });
  });

  it("creates a custom type for Pro users", async () => {
    mockGetUserIsPro.mockResolvedValue(true);
    mockCreateCustomItemType.mockResolvedValue({
      id: "type-1",
      name: "Widgets",
      kind: "code",
      slug: "widgets",
      icon: "Code",
      color: "#6366F1",
    });

    const result = await createItemType({
      name: "Widgets",
      kind: "code",
      icon: "Code",
      color: "#6366F1",
    });

    expect(result.success).toBe(true);
  });

  it("maps unique constraint failures to a friendly name error", async () => {
    mockGetUserIsPro.mockResolvedValue(true);
    mockCreateCustomItemType.mockRejectedValue(new Error("P2002"));
    mockIsUniqueConstraintError.mockReturnValue(true);

    const result = await createItemType({
      name: "Widgets",
      kind: "code",
      icon: "Code",
      color: "#6366F1",
    });

    expect(result).toEqual({
      success: false,
      error: "An item type with this name already exists",
    });
  });
});

describe("updateItemType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      success: true,
      userId: "user-1",
    });
  });

  it("returns kind immutability error when items exist", async () => {
    mockUpdateCustomItemType.mockRejectedValue(new Error("KIND_IMMUTABLE"));

    const result = await updateItemType("type-1", { kind: "link" });

    expect(result).toEqual({
      success: false,
      error: "Kind cannot be changed while items use this type",
    });
  });
});

describe("deleteItemType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      success: true,
      userId: "user-1",
    });
  });

  it("requires a move target when items remain", async () => {
    mockDeleteCustomItemType.mockRejectedValue(new Error("MOVE_REQUIRED"));

    const result = await deleteItemType("type-1", { typeId: "type-1" });

    expect(result).toEqual({
      success: false,
      error: "Choose a destination type for existing items",
    });
  });

  it("rejects incompatible move targets", async () => {
    mockDeleteCustomItemType.mockRejectedValue(new Error("INCOMPATIBLE_MOVE"));

    const result = await deleteItemType("type-1", {
      typeId: "type-1",
      moveToTypeId: "type-2",
    });

    expect(result).toEqual({
      success: false,
      error: "Destination type must have the same kind",
    });
  });

  it("rejects invalid move targets", async () => {
    mockDeleteCustomItemType.mockRejectedValue(new Error("INVALID_MOVE_TARGET"));

    const result = await deleteItemType("type-1", {
      typeId: "type-1",
      moveToTypeId: "other-user-type",
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid destination type",
    });
  });
});
