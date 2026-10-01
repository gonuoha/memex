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
  typeName: string;
  description: string | null;
  contentExcerpt: string | null;
  url: string | null;
  fileName: string | null;
};

export function buildItemListPreview(input: ItemPreviewInput): string | null {
  const type = input.typeName.toLowerCase();
  const description = input.description?.trim();
  const content = input.contentExcerpt?.trim();

  if (type === "link" && input.url) {
    try {
      const parsed = new URL(input.url);
      const path = parsed.pathname === "/" ? "" : parsed.pathname;
      return `${parsed.hostname}${path}${parsed.search}`;
    } catch {
      return input.url;
    }
  }

  if (type === "file" && input.fileName) {
    return input.fileName;
  }

  if (type === "snippet") {
    const body = input.contentExcerpt ?? input.description;
    if (!body?.trim()) {
      return null;
    }
    const lines = body.replace(/^\s*\n/, "").split("\n");
    return lines.slice(0, SNIPPET_PREVIEW_LINES).join("\n").trimEnd();
  }

  if (type === "command") {
    const body = content ?? description;
    if (!body) {
      return null;
    }
    const line = body.split("\n").find((entry) => entry.trim().length > 0) ?? body;
    return line.trimStart().startsWith("$") ? line.trim() : `$ ${line.trim()}`;
  }

  if (type === "prompt" || type === "note") {
    const raw = content ?? description;
    return raw ? stripSimpleMarkdown(raw) : null;
  }

  if (description) {
    return description;
  }

  return content ?? null;
}

export function getItemPreviewLineClamp(typeName: string): number {
  const type = typeName.toLowerCase();
  if (type === "snippet" || type === "command") {
    return 4;
  }
  if (type === "prompt" || type === "note") {
    return 2;
  }
  return 2;
}
