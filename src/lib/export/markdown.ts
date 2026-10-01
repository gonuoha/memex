import type { MemexExport, MemexExportItem } from "@/lib/validations/export-import";

const CODE_TYPES = new Set(["snippet", "command"]);
const MARKDOWN_TYPES = new Set(["note", "prompt"]);

const WINDOWS_RESERVED = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

export function slugifyExportFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const base = slug || "item";
  const stem = base.replace(/\.md$/i, "");

  if (WINDOWS_RESERVED.has(stem)) {
    return `_${stem}`;
  }

  return stem;
}

export function buildUniqueMarkdownFilenames(
  items: MemexExportItem[],
): Map<MemexExportItem, string> {
  const used = new Set<string>();
  const result = new Map<MemexExportItem, string>();

  for (const item of items) {
    const base = slugifyExportFilename(item.title);
    let candidate = `${base}.md`;
    let counter = 2;

    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}-${counter}.md`;
      counter += 1;
    }

    used.add(candidate.toLowerCase());
    result.set(item, candidate);
  }

  return result;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function formatYamlList(values: string[]): string {
  if (values.length === 0) {
    return "[]";
  }

  return `\n${values.map((value) => `  - ${yamlString(value)}`).join("\n")}`;
}

function longestBacktickRun(content: string): number {
  let max = 0;
  let current = 0;

  for (const character of content) {
    if (character === "`") {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }

  return max;
}

function codeFenceFor(content: string, language: string): string {
  const fenceLength = Math.max(3, longestBacktickRun(content) + 1);
  const fence = "`".repeat(fenceLength);

  return `${fence}${language}\n${content}\n${fence}`;
}

export function buildItemMarkdownFile(item: MemexExportItem): string {
  const frontMatter = [
    `title: ${yamlString(item.title)}`,
    `type: ${yamlString(item.type)}`,
    `tags:${formatYamlList(item.tags)}`,
    `collections:${formatYamlList(item.collections)}`,
    item.language ? `language: ${yamlString(item.language)}` : null,
    item.url ? `url: ${yamlString(item.url)}` : null,
    `created: ${yamlString(item.createdAt)}`,
    `updated: ${yamlString(item.updatedAt)}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  let body = "";

  if (item.description?.trim()) {
    body += `${item.description.trim()}\n\n`;
  }

  const typeName = item.type.toLowerCase();

  if (typeName === "link" && item.url) {
    body += item.url;
  } else if (CODE_TYPES.has(typeName) && item.content) {
    const lang = item.language?.trim() || typeName;
    body += codeFenceFor(item.content, lang);
  } else if (MARKDOWN_TYPES.has(typeName) && item.content) {
    body += item.content;
  } else if (item.content) {
    body += item.content;
  }

  return `---\n${frontMatter}\n---\n\n${body.trimEnd()}\n`;
}

export function buildCollectionsJson(exportData: MemexExport): string {
  return `${JSON.stringify(exportData.collections)}\n`;
}

export function groupItemsByTypeFolder(
  items: MemexExportItem[],
): Map<string, MemexExportItem[]> {
  const groups = new Map<string, MemexExportItem[]>();

  for (const item of items) {
    const folder = item.type.toLowerCase();
    const list = groups.get(folder) ?? [];
    list.push(item);
    groups.set(folder, list);
  }

  return groups;
}
