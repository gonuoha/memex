import { createHash } from "node:crypto";

export function buildImportDuplicateFingerprint(
  typeName: string,
  title: string,
  content: string | null,
  url: string | null,
): string {
  const type = typeName.toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();
  const contentHash = createHash("md5")
    .update(content ?? "")
    .digest("hex");
  const urlPart = url ?? "";

  return `${type}|${normalizedTitle}|${contentHash}|${urlPart}`;
}
