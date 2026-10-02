import type { ItemTypeKind } from "@/lib/item-types/kinds";
import { getSystemKindForName, normalizeItemTypeKind } from "@/lib/item-types/kinds";

const MARKDOWN_STRIP_PATTERN =
  /```[\s\S]*?```|`[^`]*`|\[([^\]]*)\]\([^)]*\)|[#>*_~\-]+/g;

export function stripSimpleMarkdown(value: string): string {
  return value
    .replace(MARKDOWN_STRIP_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SNIPPET_PREVIEW_LINES = 4;

export type ItemPreviewInput = {
  kind: ItemTypeKind;
  description: string | null;
  contentExcerpt: string | null;
  url: string | null;
  fileName: string | null;
};

export function buildItemListPreview(input: ItemPreviewInput): string | null {
  const kind = input.kind;
  const description = input.description?.trim();
  const content = input.contentExcerpt?.trim();

  if (kind === "link" && input.url) {
    try {
      const parsed = new URL(input.url);
      const path = parsed.pathname === "/" ? "" : parsed.pathname;
      return `${parsed.hostname}${path}${parsed.search}`;
    } catch {
      return input.url;
    }
  }

  if (kind === "file" && input.fileName) {
    return input.fileName;
  }

  if (kind === "code") {
    const body = input.contentExcerpt ?? input.description;
    if (!body?.trim()) {
      return null;
    }
    const lines = body.replace(/^\s*\n/, "").split("\n");
    return lines.slice(0, SNIPPET_PREVIEW_LINES).join("\n").trimEnd();
  }

  if (kind === "markdown") {
    const raw = content ?? description;
    return raw ? stripSimpleMarkdown(raw) : null;
  }

  if (description) {
    return description;
  }

  return content ?? null;
}

export function getItemPreviewLineClamp(kind: ItemTypeKind): number {
  if (kind === "code") {
    return 4;
  }
  if (kind === "markdown") {
    return 2;
  }
  return 2;
}

export function resolvePreviewKind(
  type: { name: string; kind?: string | null; isSystem?: boolean },
): ItemTypeKind {
  if (type.kind) {
    return normalizeItemTypeKind(type.kind);
  }

  if (type.isSystem === false) {
    return "markdown";
  }

  return getSystemKindForName(type.name);
}
