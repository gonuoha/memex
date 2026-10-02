import { z } from "zod";

import { tagNameSchema } from "@/lib/validations/tags";

export function emptyToNull(value: unknown) {
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

export const httpHttpsUrlSchema = z.preprocess(
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

export const tagListSchema = z
  .array(tagNameSchema)
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

export const createItemTypeSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(40);

export type CreateItemTypeSlug = z.infer<typeof createItemTypeSlugSchema>;

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
    type: createItemTypeSlugSchema,
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
    const systemType = creatableItemTypeSchema.safeParse(data.type);

    if (!systemType.success) {
      return;
    }

    if (systemType.data === "link" && !data.url) {
      ctx.addIssue({
        code: "custom",
        message: "URL is required",
        path: ["url"],
      });
    }

    if (
      (systemType.data === "file" || systemType.data === "image") &&
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
export type CreateItemInput = z.infer<typeof createItemSchema>;

export function parseCreatableItemTypeFromPathname(
  pathname: string,
): CreateItemTypeSlug | undefined {
  const match = pathname.match(/^\/items\/([^/]+)$/);
  if (!match) {
    return undefined;
  }

  return match[1].toLowerCase();
}

export function resolveDefaultCreateType(
  defaultType: CreateItemTypeSlug | CreatableItemType | undefined,
  isPro: boolean,
): CreateItemTypeSlug {
  if (!defaultType) {
    return "snippet";
  }

  const normalized = defaultType.toLowerCase();
  const systemType = creatableItemTypeSchema.safeParse(normalized);

  if (
    systemType.success &&
    (systemType.data === "file" || systemType.data === "image") &&
    !isPro
  ) {
    return "snippet";
  }

  return normalized;
}
