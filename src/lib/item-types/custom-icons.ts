import {
  BookOpen,
  Box,
  Braces,
  Bug,
  Cloud,
  Code,
  Database,
  File,
  FileCode,
  Folder,
  GitBranch,
  Globe,
  Hash,
  Image,
  Layers,
  Link as LinkIcon,
  Package,
  Puzzle,
  Rocket,
  Server,
  Sparkles,
  StickyNote,
  Terminal,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const CUSTOM_TYPE_ICON_NAMES = [
  "Code",
  "Terminal",
  "FileCode",
  "Braces",
  "Sparkles",
  "StickyNote",
  "BookOpen",
  "Link",
  "Globe",
  "Database",
  "Server",
  "Cloud",
  "GitBranch",
  "Package",
  "Box",
  "Layers",
  "Puzzle",
  "Wrench",
  "Bug",
  "Rocket",
  "Zap",
  "Hash",
  "Folder",
  "File",
] as const;

export type CustomTypeIconName = (typeof CUSTOM_TYPE_ICON_NAMES)[number];

const customTypeIcons: Record<CustomTypeIconName, LucideIcon> = {
  Code,
  Terminal,
  FileCode,
  Braces,
  Sparkles,
  StickyNote,
  BookOpen,
  Link: LinkIcon,
  Globe,
  Database,
  Server,
  Cloud,
  GitBranch,
  Package,
  Box,
  Layers,
  Puzzle,
  Wrench,
  Bug,
  Rocket,
  Zap,
  Hash,
  Folder,
  File,
};

const systemTypeIcons: Record<string, LucideIcon> = {
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link: LinkIcon,
};

export function isCustomTypeIconName(value: string): value is CustomTypeIconName {
  return (CUSTOM_TYPE_ICON_NAMES as readonly string[]).includes(value);
}

export function resolveItemTypeLucideIcon(
  icon: string | null | undefined,
): LucideIcon {
  if (!icon) {
    return File;
  }

  if (isCustomTypeIconName(icon)) {
    return customTypeIcons[icon];
  }

  return systemTypeIcons[icon] ?? File;
}
