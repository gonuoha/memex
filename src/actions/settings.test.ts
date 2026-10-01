import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";

import type { EditorPreferences } from "@/lib/editor-preferences";
import type { UserPreferences } from "@/lib/user-preferences";
import { APPEARANCE_COOKIE_NAME } from "@/lib/appearance";

import { mockAuth, mockUnauthenticated } from "./__tests__/mock-auth";

vi.mock("@/lib/db/settings", () => ({
  updateEditorPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  updateEditorPreferences as updateEditorPreferencesInDb,
  updateUserPreferences as updateUserPreferencesInDb,
} from "@/lib/db/settings";
import { revalidatePath } from "next/cache";

import { updateEditorPreferences, updateUserPreferences } from "./settings";

const mockUpdateEditorPreferencesInDb = vi.mocked(updateEditorPreferencesInDb);
const mockUpdateUserPreferencesInDb = vi.mocked(updateUserPreferencesInDb);
const mockRevalidatePath = vi.mocked(revalidatePath);
const mockCookies = vi.mocked(cookies);

const preferences: EditorPreferences = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  theme: "monokai",
};

const userPreferences: UserPreferences = {
  showOverview: false,
  typeColorPosition: "left",
  appearance: "light",
  itemsView: "grid",
  showLinkFavicons: true,
  onboardingDismissed: false,
  sampleDataAddedAt: null,
};

describe("updateEditorPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await updateEditorPreferences(preferences);

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockUpdateEditorPreferencesInDb).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns a validation error for invalid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await updateEditorPreferences({
      ...preferences,
      theme: "invalid-theme",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
    expect(mockUpdateEditorPreferencesInDb).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("saves preferences and revalidates settings", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpdateEditorPreferencesInDb.mockResolvedValue(preferences);

    const result = await updateEditorPreferences(preferences);

    expect(result).toEqual({ success: true, data: preferences });
    expect(mockUpdateEditorPreferencesInDb).toHaveBeenCalledWith(
      "user-1",
      preferences,
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("returns an error when the database update fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpdateEditorPreferencesInDb.mockRejectedValue(new Error("db error"));

    const result = await updateEditorPreferences(preferences);

    expect(result).toEqual({
      success: false,
      error: "Failed to save editor preferences",
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateUserPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when there is no session", async () => {
    mockUnauthenticated();

    const result = await updateUserPreferences(userPreferences);

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mockUpdateUserPreferencesInDb).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns a validation error for invalid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const result = await updateUserPreferences({
      showOverview: "no",
      typeColorPosition: "left",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
    expect(mockUpdateUserPreferencesInDb).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("saves preferences and revalidates settings and dashboard", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpdateUserPreferencesInDb.mockResolvedValue(userPreferences);
    const mockSet = vi.fn();
    mockCookies.mockReturnValue({
      get: vi.fn(),
      set: mockSet,
      delete: vi.fn(),
    } as never);

    const result = await updateUserPreferences({
      ...userPreferences,
      sampleDataAddedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result).toEqual({ success: true, data: userPreferences });
    expect(mockUpdateUserPreferencesInDb).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        showOverview: userPreferences.showOverview,
        appearance: userPreferences.appearance,
        showLinkFavicons: userPreferences.showLinkFavicons,
      }),
    );
    expect(mockUpdateUserPreferencesInDb.mock.calls[0][1]).not.toHaveProperty(
      "sampleDataAddedAt",
    );
    expect(mockSet).toHaveBeenCalledWith(
      APPEARANCE_COOKIE_NAME,
      userPreferences.appearance,
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/items", "layout");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/collections", "layout");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("returns an error when the database update fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpdateUserPreferencesInDb.mockRejectedValue(new Error("db error"));

    const result = await updateUserPreferences(userPreferences);

    expect(result).toEqual({
      success: false,
      error: "Failed to save user preferences",
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
