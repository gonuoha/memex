import { z } from "zod";

import {
  emptyToNull,
  httpHttpsUrlSchema,
  tagListSchema,
} from "@/lib/validations/items";
import { createCollectionSchema } from "@/lib/validations/collections";

const exportItemTypeSchema = z.enum([
  "snippet",
  "prompt",
  "command",
  "note",
  "link",
  "file",
  "image",
]);

const exportFileMetaSchema = z.object({
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
});

export const exportItemSchema = z.object({
  type: exportItemTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  url: z.string().nullable(),
  language: z.string().nullable(),
  isFavorite: z.boolean(),
  isPinned: z.boolean(),
  tags: z.array(z.string()),
  collections: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  file: exportFileMetaSchema.optional(),
});

export const exportCollectionSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  isFavorite: z.boolean(),
});

export const memexExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  items: z.array(exportItemSchema).max(10_000),
  collections: z.array(exportCollectionSchema).max(1_000),
});

export type MemexExport = z.infer<typeof memexExportSchema>;
export type MemexExportItem = z.infer<typeof exportItemSchema>;

export const exportFormatSchema = z.enum(["json", "markdown"]);

const nullableDescriptionSchema = z
  .preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional())
  .transform((value) => value ?? null);

const nullableLanguageSchema = z
  .preprocess(emptyToNull, z.string().trim().max(50).nullable().optional())
  .transform((value) => value ?? null);

export const importCollectionInputSchema = createCollectionSchema.extend({
  isFavorite: z.boolean().default(false),
});

export const importItemInputSchema = z
  .object({
    type: exportItemTypeSchema,
    title: z.string().trim().min(1).max(200),
    description: nullableDescriptionSchema,
    content: z
      .string()
      .max(100_000)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    url: httpHttpsUrlSchema.optional(),
    language: nullableLanguageSchema,
    isFavorite: z.boolean().default(false),
    isPinned: z.boolean().default(false),
    tags: tagListSchema,
    collections: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    file: exportFileMetaSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "link" && !data.url) {
      ctx.addIssue({
        code: "custom",
        message: "URL is required for link items",
        path: ["url"],
      });
    }
  });

export type ImportItemInput = z.infer<typeof importItemInputSchema>;

export function parseMemexExport(raw: unknown): MemexExport | null {
  const parsed = memexExportSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function isExportArrayCapExceeded(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }

  const record = raw as { items?: unknown; collections?: unknown };

  if (Array.isArray(record.items) && record.items.length > 10_000) {
    return true;
  }

  if (
    Array.isArray(record.collections) &&
    record.collections.length > 1_000
  ) {
    return true;
  }

  return false;
}
