export const CUSTOM_TYPE_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#64748B",
] as const;

export type CustomTypeColor = (typeof CUSTOM_TYPE_COLORS)[number];

export const CUSTOM_TYPE_COLOR_NAMES: Record<CustomTypeColor, string> = {
  "#6366F1": "Indigo",
  "#8B5CF6": "Violet",
  "#A855F7": "Purple",
  "#D946EF": "Fuchsia",
  "#EC4899": "Pink",
  "#F43F5E": "Rose",
  "#EF4444": "Red",
  "#F97316": "Orange",
  "#F59E0B": "Amber",
  "#EAB308": "Yellow",
  "#84CC16": "Lime",
  "#22C55E": "Green",
  "#10B981": "Emerald",
  "#14B8A6": "Teal",
  "#06B6D4": "Cyan",
  "#0EA5E9": "Sky",
  "#3B82F6": "Blue",
  "#64748B": "Slate",
};

export function getCustomTypeColorLabel(color: string): string {
  if (isCustomTypeColor(color)) {
    return CUSTOM_TYPE_COLOR_NAMES[color];
  }

  return color;
}

export function isCustomTypeColor(value: string): value is CustomTypeColor {
  return (CUSTOM_TYPE_COLORS as readonly string[]).includes(value);
}
