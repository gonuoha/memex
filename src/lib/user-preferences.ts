export const TYPE_COLOR_POSITIONS = [
  "top",
  "bottom",
  "left",
  "right",
  "none",
] as const;

export type TypeColorPosition = (typeof TYPE_COLOR_POSITIONS)[number];

export const TYPE_COLOR_POSITION_LABELS: Record<TypeColorPosition, string> = {
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
  none: "None",
};

export const APPEARANCES = ["light", "dark", "dark-blue", "system"] as const;

export type Appearance = (typeof APPEARANCES)[number];

export const APPEARANCE_LABELS: Record<Appearance, string> = {
  light: "Light",
  dark: "Dark",
  "dark-blue": "Dark Blue",
  system: "System",
};

export const ITEMS_VIEWS = ["grid", "list"] as const;

export type ItemsView = (typeof ITEMS_VIEWS)[number];

export type UserPreferences = {
  showOverview: boolean;
  typeColorPosition: TypeColorPosition;
  appearance: Appearance;
  itemsView: ItemsView;
  showLinkFavicons: boolean;
  onboardingDismissed: boolean;
  sampleDataAddedAt: string | null;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  showOverview: true,
  typeColorPosition: "left",
  appearance: "dark",
  itemsView: "grid",
  showLinkFavicons: true,
  onboardingDismissed: false,
  sampleDataAddedAt: null,
};

function isTypeColorPosition(value: unknown): value is TypeColorPosition {
  return (
    typeof value === "string" &&
    TYPE_COLOR_POSITIONS.includes(value as TypeColorPosition)
  );
}

export function isAppearance(value: unknown): value is Appearance {
  return typeof value === "string" && APPEARANCES.includes(value as Appearance);
}

function isItemsView(value: unknown): value is ItemsView {
  return typeof value === "string" && ITEMS_VIEWS.includes(value as ItemsView);
}

export function parseUserPreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_USER_PREFERENCES;
  }

  const value = raw as Record<string, unknown>;

  return {
    showOverview:
      typeof value.showOverview === "boolean"
        ? value.showOverview
        : DEFAULT_USER_PREFERENCES.showOverview,
    typeColorPosition: isTypeColorPosition(value.typeColorPosition)
      ? value.typeColorPosition
      : DEFAULT_USER_PREFERENCES.typeColorPosition,
    appearance: isAppearance(value.appearance)
      ? value.appearance
      : DEFAULT_USER_PREFERENCES.appearance,
    itemsView: isItemsView(value.itemsView)
      ? value.itemsView
      : DEFAULT_USER_PREFERENCES.itemsView,
    showLinkFavicons:
      typeof value.showLinkFavicons === "boolean"
        ? value.showLinkFavicons
        : DEFAULT_USER_PREFERENCES.showLinkFavicons,
    onboardingDismissed:
      typeof value.onboardingDismissed === "boolean"
        ? value.onboardingDismissed
        : DEFAULT_USER_PREFERENCES.onboardingDismissed,
    sampleDataAddedAt:
      typeof value.sampleDataAddedAt === "string"
        ? value.sampleDataAddedAt
        : DEFAULT_USER_PREFERENCES.sampleDataAddedAt,
  };
}

export function mergeUserPreferences(
  current: UserPreferences,
  patch: Partial<UserPreferences>,
): UserPreferences {
  return parseUserPreferences({ ...current, ...patch });
}
