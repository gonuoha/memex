import type { CSSProperties } from "react";
import {
  Code,
  File,
  Image,
  Link as LinkIcon,
  Sparkles,
  StickyNote,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import { adaptTypeColor, typeColorTint } from "@/lib/item-type-color";

const itemTypeIcons: Record<string, LucideIcon> = {
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link: LinkIcon,
};

const mutedTypeStyle = {
  textClassName: "text-muted-foreground",
  bgClassName: "bg-muted",
} as const;

export { getTypeSlug } from "@/lib/item-type-slugs";

export const SYSTEM_ITEM_TYPE_ORDER = [
  "snippet",
  "prompt",
  "command",
  "note",
  "file",
  "image",
  "link",
] as const;

export function sortItemTypesBySystemOrder<T extends { name: string }>(
  itemTypes: T[],
): T[] {
  const orderIndex = new Map<string, number>(
    SYSTEM_ITEM_TYPE_ORDER.map((name, index) => [name, index]),
  );

  return [...itemTypes].sort((a, b) => {
    const aIndex = orderIndex.get(a.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndex.get(b.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}

type ItemTypeStyle = {
  textClassName?: string;
  bgClassName?: string;
  textStyle?: CSSProperties;
  bgStyle?: CSSProperties;
};

export function getItemTypeIcon(icon: string | null): LucideIcon {
  if (!icon) {
    return File;
  }

  return itemTypeIcons[icon] ?? File;
}

export function getItemTypeLabel(
  name: string,
  options?: { plural?: boolean },
): string {
  const normalized = name.toLowerCase();

  if (options?.plural) {
    if (normalized === "link") {
      return "Links";
    }

    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}s`;
  }

  if (normalized === "link") {
    return "Link";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getItemTypeStyles(color: string | null): ItemTypeStyle {
  if (!color?.startsWith("#")) {
    return mutedTypeStyle;
  }

  return {
    textStyle: { color: adaptTypeColor(color) },
    bgStyle: { backgroundColor: typeColorTint(color, "10%") },
  };
}
