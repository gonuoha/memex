import { z } from "zod";

import { parseItemTypeSlug } from "@/lib/item-type-slugs";
import { createItemSchema, updateItemSchema } from "@/lib/validations/items";

const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;

export type ApiV1ValidationDetail = {
  path: string;
  message: string;
};

export function formatZodValidationDetails(
  error: z.ZodError,
): ApiV1ValidationDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "_",
    message: issue.message,
  }));
}

const listTypeSchema = z
  .string()
  .trim()
  .min(1)
  .optional()
  .refine((value) => !value || parseItemTypeSlug(value) !== null, {
    message: "Unknown item type",
  });

export const apiV1ListItemsQuerySchema = z.object({
  type: listTypeSchema,
  tag: z.string().trim().min(1).max(40).optional(),
  collection: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LIST_LIMIT)
    .optional()
    .default(DEFAULT_LIST_LIMIT),
  cursor: z.string().trim().min(1).optional(),
});

export type ApiV1ListItemsQuery = z.infer<typeof apiV1ListItemsQuerySchema>;

export const apiV1CreateItemSchema = createItemSchema
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === "file" || data.type === "image") {
      ctx.addIssue({
        code: "custom",
        message: "File and image items are not supported by the API",
        path: ["type"],
      });
    }
  });

export const apiV1UpdateItemSchema = updateItemSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type ApiV1UpdateItemInput = z.infer<typeof apiV1UpdateItemSchema>;

export function parseApiV1ListItemsQuery(searchParams: URLSearchParams) {
  return apiV1ListItemsQuerySchema.safeParse({
    type: searchParams.get("type") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    collection: searchParams.get("collection") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
}
