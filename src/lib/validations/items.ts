import { z } from "zod";

import { parseItemTypeSlug } from "@/lib/item-type-slugs";

function emptyToNull(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function nullableTrimmedStringMax(maxLength: number) {
  return z.preprocess(
    emptyToNull,
    z.string().trim().max(maxLength).nullable().optional(),
  );
}

const titleSchema = z.string().trim().min(1, "Title is required").max(200);
const descriptionSchema = nullableTrimmedStringMax(2000);
const contentSchema = nullableTrimmedStringMax(100_000);
const languageSchema = nullableTrimmedStringMax(50);

const httpHttpsUrlSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(2048)
    .url("Enter a valid URL")
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    }, "URL must use http or https")
    .nullable(),
);

const tagListSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([])
  .transform((tags) => {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const tag of tags) {
      const key = tag.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(tag);
      }
    }

    return unique;
  });

const collectionIdListSchema = z
  .array(z.string().trim().min(1))
  .max(50)
  .default([])
  .transform((ids) => [...new Set(ids)]);

export const creatableItemTypeSchema = z.enum([
  "snippet",
  "prompt",
  "command",
  "note",
  "link",
  "file",
  "image",
]);

export const updateItemSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  content: contentSchema,
  language: languageSchema,
  url: httpHttpsUrlSchema.optional(),
  tags: tagListSchema,
  collectionIds: collectionIdListSchema,
});

export const createItemSchema = z
  .object({
    type: creatableItemTypeSchema,
    title: titleSchema,
    description: descriptionSchema,
    content: contentSchema,
    language: languageSchema,
    url: httpHttpsUrlSchema.optional(),
    fileUrl: z.string().trim().min(1).optional(),
    fileName: z.string().trim().min(1).max(255).optional(),
    fileSize: z.number().int().positive().optional(),
    tags: tagListSchema,
    collectionIds: collectionIdListSchema,
  })
  .superRefine((data, ctx) => {
    if (data.type === "link" && !data.url) {
      ctx.addIssue({
        code: "custom",
        message: "URL is required",
        path: ["url"],
      });
    }

    if (
      (data.type === "file" || data.type === "image") &&
      (!data.fileUrl || !data.fileName || !data.fileSize)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "File upload is required",
        path: ["fileUrl"],
      });
    }
  });

export type CreatableItemType = z.infer<typeof creatableItemTypeSchema>;

export function parseCreatableItemTypeFromPathname(
  pathname: string,
): CreatableItemType | undefined {
  const match = pathname.match(/^\/items\/([^/]+)$/);
  if (!match) {
    return undefined;
  }

  const typeName = parseItemTypeSlug(match[1]);
  if (!typeName) {
    return undefined;
  }

  const parsed = creatableItemTypeSchema.safeParse(typeName);
  return parsed.success ? parsed.data : undefined;
}

export function resolveDefaultCreateType(
  defaultType: CreatableItemType | undefined,
  isPro: boolean,
): CreatableItemType {
  if (!defaultType) {
    return "snippet";
  }

  if ((defaultType === "file" || defaultType === "image") && !isPro) {
    return "snippet";
  }

  return defaultType;
}
