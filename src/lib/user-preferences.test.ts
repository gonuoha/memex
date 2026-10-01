import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_PREFERENCES,
  parseUserPreferences,
} from "./user-preferences";

describe("parseUserPreferences", () => {
  it("returns defaults for nullish and non-object values", () => {
    expect(parseUserPreferences(null)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(parseUserPreferences(undefined)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(parseUserPreferences("invalid")).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it("returns a valid preferences object unchanged", () => {
    const preferences = {
      showOverview: false,
      typeColorPosition: "top",
      appearance: "light",
      itemsView: "list",
      showLinkFavicons: false,
      onboardingDismissed: true,
      sampleDataAddedAt: "2026-01-01T00:00:00.000Z",
    } as const;

    expect(parseUserPreferences(preferences)).toEqual(preferences);
  });

  it("falls back to defaults for invalid field values", () => {
    expect(
      parseUserPreferences({
        showOverview: "yes",
        typeColorPosition: "center",
        appearance: "obsidian",
      }),
    ).toEqual(DEFAULT_USER_PREFERENCES);
  });
});
