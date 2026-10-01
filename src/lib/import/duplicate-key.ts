import type { MemexExportItem } from "@/lib/validations/export-import";

export function buildItemDuplicateKey(
  typeName: string,
  title: string,
  content: string | null,
  url: string | null,
): string {
  const type = typeName.toLowerCase();
  const normalizedTitle = title.trim();

  if (type === "link") {
    return `${type}\0${normalizedTitle}\0${(url ?? "").trim()}`;
  }

  return `${type}\0${normalizedTitle}\0${content ?? ""}`;
}

export function duplicateKeyFromExportItem(item: MemexExportItem): string {
  return buildItemDuplicateKey(item.type, item.title, item.content, item.url);
}

export function buildDuplicateKeySet(
  items: Array<{
    title: string;
    content: string | null;
    url: string | null;
    type: { name: string };
  }>,
): Set<string> {
  const keys = new Set<string>();

  for (const item of items) {
    keys.add(
      buildItemDuplicateKey(
        item.type.name,
        item.title,
        item.content,
        item.url,
      ),
    );
  }

  return keys;
}
