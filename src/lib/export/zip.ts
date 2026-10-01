import { strToU8, zip } from "fflate";

import type { MemexExport } from "@/lib/validations/export-import";

import {
  buildCollectionsJson,
  buildItemMarkdownFile,
  buildUniqueMarkdownFilenames,
  groupItemsByTypeFolder,
} from "./markdown";

export function buildMarkdownExportZip(
  exportData: MemexExport,
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const filenames = buildUniqueMarkdownFilenames(exportData.items);
  const groups = groupItemsByTypeFolder(exportData.items);

  for (const [folder, items] of groups) {
    for (const item of items) {
      const name = filenames.get(item);
      if (!name) {
        continue;
      }

      files[`${folder}/${name}`] = strToU8(buildItemMarkdownFile(item));
    }
  }

  files["collections.json"] = strToU8(buildCollectionsJson(exportData));

  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(data);
    });
  });
}
